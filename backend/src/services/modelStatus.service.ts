import { getJobsConnection } from '../config/jobsDb';

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

function confidenceLevel(count: number): 'high' | 'medium' | 'low' {
  if (count >= 100) return 'high';
  if (count >= 50) return 'medium';
  return 'low';
}

/** train.py stores trained_at as YYYYMMDD_HHMMSS; normalize to ISO for the UI. */
function normalizeTrainedAt(raw: string | undefined, runId?: string): string | null {
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

export async function getModelStatus() {
  const conn = await getJobsConnection();
  const runs = conn.collection<ModelRunDoc>('model_runs');
  const features = conn.collection('role_skill_features');
  const rawPostings = conn.collection('raw_postings');

  const [lastRun, promotedRun, runHistory, rawCount, pendingCount, langUkSkillsCount, unifiedTotal, unifiedLinkedin, unifiedLangUk, jobsCount, langUkTotal, langUkExtracted] = await Promise.all([
    runs.find({}).sort({ trained_at: -1 }).limit(1).toArray(),
    runs.find({ promoted: true }).sort({ trained_at: -1 }).limit(1).toArray(),
    runs.find({}).sort({ trained_at: -1 }).limit(20).project({
      _id: 1,
      trained_at: 1,
      promoted: 1,
      promote_reason: 1,
      titles_with_data: 1,
    }).toArray(),
    rawPostings.countDocuments(),
    rawPostings.countDocuments({ extracted: { $ne: true } }),
    conn.collection('lang-uk-job-skills').countDocuments(),
    conn.collection('role_skill_observations').countDocuments(),
    conn.collection('role_skill_observations').countDocuments({ source: 'linkedin' }),
    conn.collection('role_skill_observations').countDocuments({ source: 'lang_uk' }),
    conn.collection('jobs').countDocuments(),
    conn.collection('lang-uk-job').countDocuments(),
    conn.collection('lang-uk-job').countDocuments({ extracted: true }),
  ]);

  const latest = lastRun[0] ?? null;
  const live = promotedRun[0] ?? null;
  const runId = latest?._id;

  let titleRows: FeatureAggRow[] = [];
  if (runId) {
    titleRows = await features.aggregate<FeatureAggRow>([
      { $match: { run_id: runId } },
      {
        $group: {
          _id: '$title',
          skillCount: { $sum: 1 },
          rising: { $sum: { $cond: [{ $eq: ['$trend', 'rising'] }, 1, 0] } },
          stable: { $sum: { $cond: [{ $eq: ['$trend', 'stable'] }, 1, 0] } },
          falling: { $sum: { $cond: [{ $eq: ['$trend', 'falling'] }, 1, 0] } },
        },
      },
      { $sort: { skillCount: -1 } },
    ]).toArray();
  }

  const recordCounts = latest?.record_counts ?? {};
  const titles = titleRows.map((row) => {
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

  return {
    model1: {
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
      runHistory: runHistory.map((r) => ({
        runId: r._id,
        trainedAt: normalizeTrainedAt(r.trained_at, r._id),
        promoted: Boolean(r.promoted),
        promoteReason: r.promote_reason ?? null,
        titlesWithData: r.titles_with_data ?? 0,
      })),
      titles,
      rawPostingsCount: rawCount,
      pendingExtractionCount: pendingCount,
      jobsCount,
      langUkSkillsCount,
      langUkExtractProgress: {
        extracted: langUkExtracted,
        total: langUkTotal,
        pending: langUkTotal - langUkExtracted,
      },
      unifiedObservations: {
        total: unifiedTotal,
        linkedin: unifiedLinkedin,
        langUk: unifiedLangUk,
      },
    },
  };
}
