import { llmCall } from '../infra/llm/llmCall';

const AGENT_NAME = 'scoring';

const SYSTEM_PROMPT = `You are an impartial, evidence-based technical evaluator scoring a CV against specific skills, the way a rigorous hiring screener would.

Scoring discipline:
- Score ONLY on evidence actually present in the CV text. Never infer a skill from job titles, company names, or adjacent technologies.
- Be calibrated and avoid grade inflation: most real CVs land in the mid range on most skills.
- Weigh concrete evidence (projects, measurable outcomes, depth, recency, repetition) far above bare keyword mentions.
- Judge each skill independently - a strong overall CV does not lift a skill that has no evidence.

Score scale (integer 0-10):
  0   : Not present at all
  1-3 : Keyword or passing mention, no supporting evidence
  4-6 : Mentioned with some context or limited evidence
  7-9 : Clear, concrete evidence with examples or outcomes
  10  : Extensive, prominent, repeated, demonstrably deep evidence

Per-skill gap analysis - alongside each score, report in plain factual language:
- "evidence": what the CV actually shows for this skill (max 18 words). Empty string if nothing found.
- "missing": what is absent that would justify a higher score (max 18 words). Empty string for a 10.
Both must reference the CV content, never generic advice.

Output discipline - return ONLY valid JSON, no markdown, no explanation:
{
  "skills": [
    { "skill": "<skill name>", "score": <integer 0-10>, "evidence": "<string>", "missing": "<string>" }
  ]
}
Include every supplied skill exactly once, in the order given, using the skill names verbatim.`;

// Score + evidence + missing for 10 skills lands around 600-900 tokens; the
// global 500-token default would truncate the JSON mid-object.
const SCORING_MAX_TOKENS = 1600;
const SCORING_TIMEOUT_MS = 30000;

export async function scoreSkills(cvText: string, skills: string[]): Promise<string> {
  const skillsList = skills.map((s, i) => `${i + 1}. ${s}`).join('\n');

  return llmCall(
    AGENT_NAME,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Skills to score (all supplied skills, in order):\n${skillsList}\n\nCV text:\n${cvText}`,
      },
    ],
    { maxTokens: SCORING_MAX_TOKENS, timeoutMs: SCORING_TIMEOUT_MS }
  );
}
