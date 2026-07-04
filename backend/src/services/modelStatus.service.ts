import type { Collection } from 'mongoose';
import { getJobsConnection } from '../config/jobsDb';

export const MODEL_STATUS_TITLES_PAGE_SIZE = 25;

const SUMMARY_CACHE_MS = 60_000;
const QUERY_TIMEOUT_MS = 12_000;
let summaryCache: { at: number; data: Awaited<ReturnType<typeof buildModelStatusSummary>> } | null = null;

async function withQueryTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function countWithTimeout(collection: Collection, filter: Record<string, unknown> = {}): Promise<number> {
  try {
    return await withQueryTimeout(collection.countDocuments(filter), 'countDocuments');
  } catch {
    return 0;
  }
}

interface ModelRunDoc {
  _id: string;
  trained_at?: string;
  promoted?: boolean;
  promote_reason?: string;
  titles_with_data?: number;
  source_weights?: Record<string, number>;
  record_counts?: Record<string, number>;
}

interface FeatureAggRow {
  _id: string;
  skillCount: number;
  rising: number;
  stable: number;
  falling: number;
}

export interface ModelTitleRow {
  title: string;
  skillCount: number;
  recordsCount: number;
  dataConfidence: 'high' | 'medium' | 'low';
  timeFeaturesReliable: boolean;
  trends: { rising: number; stable: number; falling: number };
}

function confidenceLevel(count: number): 'high' | 'medium' | 'low' {
  if (count >= 100) return 'high';
  if (count >= 50) return 'medium';
  return 'low';
}

/** train.py stores trained_at as YYYYMMDD_HHMMSS; normalize to ISO for the UI. */
export function normalizeTrainedAt(raw: string | undefined, runId?: string): string | null {
  let value = raw?.trim();
  if (!value && runId) {
    const fromId = runId.match(/@(\d{8}_\d{6})$/);
    value = fromId?.[1];
  }
  if (!value) return null;

  const compact = value.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, mo, d, h, mi, s] = compact;
    return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))).toISOString();
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return null;
}

async function estimatedCount(collection: Collection): Promise<number> {
  return collection.estimatedDocumentCount();
}

function mapRunSummary(latest: ModelRunDoc | null, live: ModelRunDoc | null) {
  return {
    lastRun: latest
      ? {
          runId: latest._id,
          trainedAt: normalizeTrainedAt(latest.trained_at, latest._id),
          promoted: Boolean(latest.promoted),
          promoteReason: latest.promote_reason ?? null,
          titlesWithData: latest.titles_with_data ?? 0,
          sourceWeights: latest.source_weights ?? {},
          isLiveModel: live?._id === latest._id,
        }
      : null,
    liveRun: live
      ? {
          runId: live._id,
          trainedAt: normalizeTrainedAt(live.trained_at, live._id),
          titlesWithData: live.titles_with_data ?? 0,
        }
      : null,
  };
}

function mapTitleRows(titleRows: FeatureAggRow[], recordCounts: Record<string, number>): ModelTitleRow[] {
  return titleRows.map((row) => {
    const records = Number(recordCounts[row._id] ?? 0);
    return {
      title: row._id,
      skillCount: row.skillCount,
      recordsCount: records,
      dataConfidence: confidenceLevel(records),
      timeFeaturesReliable: records >= 50,
      trends: { rising: row.rising, stable: row.stable, falling: row.falling },
    };
  });
}

/** Fast dashboard payload: model runs + approximate collection counts (no title aggregation). */
async function buildModelStatusSummary() {
  const conn = await getJobsConnection();
  const runs = conn.collection<ModelRunDoc>('model_runs');
  const rawPostings = conn.collection('raw_postings');
  const observations = conn.collection('role_skill_observations');

  const [lastRun, promotedRun, runHistory, rawCount, unifiedLinkedin, unifiedLangUk, jobsCount, langUkSkillsCount, langUkTotal] =
    await Promise.all([
      runs.find({}).sort({ trained_at: -1 }).limit(1).toArray(),
      runs.find({ promoted: true }).sort({ trained_at: -1 }).limit(1).toArray(),
      runs
        .find({})
        .sort({ trained_at: -1 })
        .limit(20)
        .project({
          _id: 1,
          trained_at: 1,
          promoted: 1,
          promote_reason: 1,
          titles_with_data: 1,
        })
        .toArray(),
      estimatedCount(rawPostings),
      countWithTimeout(observations, { source: 'linkedin' }),
      countWithTimeout(observations, { source: 'lang_uk' }),
      estimatedCount(conn.collection('jobs')),
      estimatedCount(conn.collection('lang-uk-job-skills')),
      estimatedCount(conn.collection('lang-uk-job')),
    ]);

  const latest = lastRun[0] ?? null;
  const live = promotedRun[0] ?? null;

  return {
    model1: {
      ...mapRunSummary(latest, live),
      runHistory: runHistory.map((r) => ({
        runId: r._id,
        trainedAt: normalizeTrainedAt(r.trained_at, r._id),
        promoted: Boolean(r.promoted),
        promoteReason: r.promote_reason ?? null,
        titlesWithData: r.titles_with_data ?? 0,
      })),
      titlesRunId: latest?._id ?? null,
      titlesTotal: Object.keys(latest?.record_counts ?? {}).length || latest?.titles_with_data || 0,
      rawPostingsCount: rawCount,
      jobsCount,
      langUkSkillsCount,
      langUkExtractProgress: {
        extracted: null,
        total: langUkTotal,
        pending: null,
      },
      pendingExtractionCount: null,
      unifiedObservations: {
        total: unifiedLinkedin + unifiedLangUk,
        linkedin: unifiedLinkedin,
        langUk: unifiedLangUk,
      },
      countsAreEstimated: true,
    },
  };
}

export async function getModelStatusSummary() {
  const now = Date.now();
  if (summaryCache && now - summaryCache.at < SUMMARY_CACHE_MS) {
    return summaryCache.data;
  }
  const data = await withQueryTimeout(buildModelStatusSummary(), 'model status summary');
  summaryCache = { at: now, data };
  return data;
}

/** Slower filtered counts loaded after the summary renders. */
export async function getModelStatusCollectionStats() {
  const conn = await getJobsConnection();
  const rawPostings = conn.collection('raw_postings');
  const langUkJob = conn.collection('lang-uk-job');

  const [pendingCount, langUkExtracted, langUkTotal] = await Promise.all([
    countWithTimeout(rawPostings, { extracted: { $ne: true } }),
    countWithTimeout(langUkJob, { extracted: true }),
    estimatedCount(langUkJob),
  ]);

  return {
    pendingExtractionCount: pendingCount,
    langUkExtractProgress: {
      extracted: langUkExtracted,
      total: langUkTotal,
      pending: langUkTotal - langUkExtracted,
    },
  };
}

function sortTitlesByRecordCount(recordCounts: Record<string, number>): string[] {
  return Object.entries(recordCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([title]) => title);
}

export async function getModelStatusTitles(
  runId: string,
  offset: number,
  limit: number = MODEL_STATUS_TITLES_PAGE_SIZE,
) {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const conn = await getJobsConnection();
  const runs = conn.collection<ModelRunDoc>('model_runs');
  const features = conn.collection('role_skill_features');

  const run = await runs.findOne({ _id: runId });
  if (!run) {
    return {
      runId,
      titles: [] as ModelTitleRow[],
      total: 0,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: false,
    };
  }

  const recordCounts = run.record_counts ?? {};
  const orderedTitles = sortTitlesByRecordCount(recordCounts);
  const total = orderedTitles.length || run.titles_with_data || 0;
  const pageTitles = orderedTitles.slice(safeOffset, safeOffset + safeLimit);

  if (pageTitles.length === 0) {
    return {
      runId,
      titles: [] as ModelTitleRow[],
      total,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: safeOffset < total,
    };
  }

  const titleRows = await features
    .aggregate<FeatureAggRow>([
      { $match: { run_id: runId, title: { $in: pageTitles } } },
      {
        $group: {
          _id: '$title',
          skillCount: { $sum: 1 },
          rising: { $sum: { $cond: [{ $eq: ['$trend', 'rising'] }, 1, 0] } },
          stable: { $sum: { $cond: [{ $eq: ['$trend', 'stable'] }, 1, 0] } },
          falling: { $sum: { $cond: [{ $eq: ['$trend', 'falling'] }, 1, 0] } },
        },
      },
    ])
    .toArray();

  const rowsByTitle = new Map(titleRows.map((row) => [row._id, row]));
  const titles = mapTitleRows(
    pageTitles
      .map((title) => rowsByTitle.get(title))
      .filter((row): row is FeatureAggRow => Boolean(row)),
    recordCounts,
  );

  return {
    runId,
    titles,
    total,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + pageTitles.length < total,
  };
}

/** @deprecated Use getModelStatusSummary + chunked endpoints instead. */
export async function getModelStatus() {
  const summary = await getModelStatusSummary();
  const stats = await getModelStatusCollectionStats();
  const runId = summary.model1.titlesRunId;
  const titles = runId
    ? (await getModelStatusTitles(runId, 0, 10_000)).titles
    : [];

  return {
    model1: {
      ...summary.model1,
      ...stats,
      titles,
      countsAreEstimated: false,
    },
  };
}
