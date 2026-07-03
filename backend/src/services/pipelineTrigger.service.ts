import { spawn, type ChildProcess } from 'child_process';
import type { ObjectId } from 'mongodb';
import { getJobsConnection } from '../config/jobsDb';

export type PipelineRunStatus = 'running' | 'completed' | 'failed' | 'aborted';

interface PipelineRunDoc {
  _id?: ObjectId;
  status: PipelineRunStatus;
  triggeredBy: string;
  command: string;
  containerName?: string;
  startedAt: Date;
  finishedAt?: Date;
  exitCode?: number;
  logTail?: string;
  abortedBy?: string;
}

const LOG_TAIL_MAX = 8000;
const ABORT_KILL_MS = 8000;

let inMemoryRunning = false;
let abortRequested = false;
let activeChild: ChildProcess | null = null;
let activeRunId: ObjectId | null = null;
let activeLogBuffer = '';
let activeContainerName: string | null = null;
let activeAbortedBy: string | null = null;
let killTimer: ReturnType<typeof setTimeout> | null = null;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildDefaultCommand(containerName?: string): string | null {
  if (process.env.PIPELINE_TRIGGER_CMD?.trim()) {
    return process.env.PIPELINE_TRIGGER_CMD.trim();
  }

  const image = process.env.PIPELINE_DOCKER_IMAGE?.trim();
  if (!image) return null;

  const network = process.env.PIPELINE_DOCKER_NETWORK ?? 'app-network';
  const mongoUri = process.env.JOBS_MONGO_URI ?? process.env.MONGO_URI ?? '';
  const dsContainer = process.env.DS_CONTAINER ?? 'careerlens-ds';
  if (!mongoUri) return null;

  const parts = [
    'docker run --rm',
    containerName ? `--name ${containerName}` : '',
    `--network ${network}`,
    `-e MONGO_URI=${shellQuote(mongoUri)}`,
    '-e MODEL_OUT_DIR=/models',
    `-e DS_CONTAINER=${shellQuote(dsContainer)}`,
    '-e TRAIN_USE_UNIFIED=1',
    '-e SOURCE_WEIGHTS=linkedin:1.0,lang_uk:0.3',
    '-v model_data:/models',
    '-v /var/run/docker.sock:/var/run/docker.sock',
    image,
    '/app/run_daily.sh',
  ];

  return parts.filter(Boolean).join(' ');
}

function pipelineContainerName(): string {
  return `careerlens-pipeline-${Date.now()}`;
}

async function getRunsCollection() {
  const conn = await getJobsConnection();
  return conn.collection<PipelineRunDoc>('pipeline_runs');
}

async function findActiveRun() {
  const runs = await getRunsCollection();
  return runs.findOne({ status: 'running' }, { sort: { startedAt: -1 } });
}

function clearActiveProcessState() {
  inMemoryRunning = false;
  activeChild = null;
  activeRunId = null;
  activeLogBuffer = '';
  activeContainerName = null;
  activeAbortedBy = null;
  if (killTimer) {
    clearTimeout(killTimer);
    killTimer = null;
  }
}

function appendActiveLog(chunk: Buffer) {
  activeLogBuffer = (activeLogBuffer + chunk.toString()).slice(-LOG_TAIL_MAX);
}

function resolveFinalStatus(exitCode: number | null): PipelineRunStatus {
  if (abortRequested) return 'aborted';
  return exitCode === 0 ? 'completed' : 'failed';
}

async function finalizeRun(
  runId: ObjectId,
  status: PipelineRunStatus,
  exitCode: number,
  extraLog = '',
  abortedBy?: string,
) {
  const runs = await getRunsCollection();
  const logTail = extraLog
    ? `${activeLogBuffer}\n${extraLog}`.slice(-LOG_TAIL_MAX)
    : activeLogBuffer;

  await runs.updateOne(
    { _id: runId },
    {
      $set: {
        status,
        finishedAt: new Date(),
        exitCode,
        logTail,
        ...(abortedBy ? { abortedBy } : {}),
      },
    },
  ).catch(() => undefined);

  abortRequested = false;
  clearActiveProcessState();
}

function stopDockerContainer(containerName: string): void {
  spawn('docker', ['stop', '-t', '10', containerName], { stdio: 'ignore' })
    .on('error', () => undefined);
}

function serializeRun(doc: PipelineRunDoc & { _id?: ObjectId }) {
  return {
    id: String(doc._id),
    status: doc.status,
    triggeredBy: doc.triggeredBy,
    command: doc.command,
    startedAt: doc.startedAt.toISOString(),
    finishedAt: doc.finishedAt?.toISOString() ?? null,
    exitCode: doc.exitCode ?? null,
    logTail: doc.logTail ?? '',
    abortedBy: doc.abortedBy ?? null,
  };
}

export async function getPipelineStatus() {
  const runs = await getRunsCollection();
  const active = await findActiveRun();
  const last = await runs.find({}).sort({ startedAt: -1 }).limit(1).toArray();
  const command = buildDefaultCommand();

  return {
    enabled: Boolean(command),
    manualCommand: command ?? 'docker compose --profile batch run --rm pipeline',
    activeRun: active ? serializeRun(active) : null,
    lastRun: last[0] ? serializeRun(last[0]) : null,
  };
}

export async function triggerPipeline(triggeredBy: string) {
  const containerName = pipelineContainerName();
  const command = buildDefaultCommand(containerName);
  if (!command) {
    const err = new Error('Pipeline trigger is not configured on this server');
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  if (inMemoryRunning || await findActiveRun()) {
    const err = new Error('A pipeline run is already in progress');
    (err as Error & { statusCode?: number }).statusCode = 409;
    throw err;
  }

  const runs = await getRunsCollection();
  const startedAt = new Date();
  const insert = await runs.insertOne({
    status: 'running',
    triggeredBy,
    command,
    containerName,
    startedAt,
    logTail: '',
  });

  const runId = insert.insertedId;
  inMemoryRunning = true;
  activeRunId = runId;
  activeLogBuffer = '';
  activeContainerName = containerName;
  abortRequested = false;
  activeAbortedBy = null;

  const cwd = process.env.PIPELINE_WORKDIR?.trim() || process.cwd();
  const child = spawn('sh', ['-c', command], {
    cwd,
    env: process.env,
    detached: false,
  });
  activeChild = child;

  child.stdout?.on('data', appendActiveLog);
  child.stderr?.on('data', appendActiveLog);

  child.on('close', (code) => {
    if (!activeRunId || !runId.equals(activeRunId)) return;
    const exitCode = code ?? 1;
    const status = resolveFinalStatus(code);
    const abortedBy = status === 'aborted' ? (activeAbortedBy ?? 'admin') : undefined;
    finalizeRun(
      runId,
      status,
      status === 'aborted' ? 130 : exitCode,
      status === 'aborted' ? 'Aborted by user' : '',
      abortedBy,
    ).catch(() => undefined);
  });

  child.on('error', (spawnErr) => {
    if (!activeRunId || !runId.equals(activeRunId)) return;
    finalizeRun(
      runId,
      abortRequested ? 'aborted' : 'failed',
      abortRequested ? 130 : 1,
      spawnErr.message,
      abortRequested ? (activeAbortedBy ?? 'admin') : undefined,
    ).catch(() => undefined);
  });

  return {
    id: String(runId),
    status: 'running' as const,
    triggeredBy,
    command,
    startedAt: startedAt.toISOString(),
  };
}

export async function abortPipeline(abortedBy: string) {
  const active = await findActiveRun();
  if (!active && !inMemoryRunning) {
    const err = new Error('No pipeline run is in progress');
    (err as Error & { statusCode?: number }).statusCode = 409;
    throw err;
  }

  abortRequested = true;
  activeAbortedBy = abortedBy;

  if (activeChild) {
    activeChild.kill('SIGTERM');
    killTimer = setTimeout(() => {
      activeChild?.kill('SIGKILL');
    }, ABORT_KILL_MS);
  }

  const containerName = activeContainerName ?? active?.containerName;
  if (containerName) {
    stopDockerContainer(containerName);
  }

  if (!activeChild && active?._id) {
    await finalizeRun(
      active._id,
      'aborted',
      130,
      `Aborted by ${abortedBy} (no live process ù stale run cleared)`,
      abortedBy,
    );
  }

  return {
    id: active?._id ? String(active._id) : activeRunId ? String(activeRunId) : '',
    status: 'aborted' as const,
    abortedBy,
  };
}
