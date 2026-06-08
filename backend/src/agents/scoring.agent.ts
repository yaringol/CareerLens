import { llmCall } from '../infra/llm/llmCall';

const AGENT_NAME = 'scoring';

const SYSTEM_PROMPT = `You are a professional CV evaluator.
Score the resume below against each listed skill.

Scoring guide:
  0   : Not present
  1-3 : Barely mentioned
  4-6 : Mentioned but limited evidence
  7-9 : Clear evidence with examples
  10  : Extensive, prominent, repeated evidence

Return ONLY valid JSON - no markdown, no explanation:
{
  "skills": [
    { "skill": "<skill name>", "score": <integer 0-10> }
  ]
}`;

export async function scoreSkills(cvText: string, skills: string[]): Promise<string> {
  const skillsList = skills.map((s, i) => `${i + 1}. ${s}`).join('\n');

  return llmCall(AGENT_NAME, [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Skills to score (all supplied skills, in order):\n${skillsList}\n\nCV text:\n${cvText}`,
    },
  ]);
}
