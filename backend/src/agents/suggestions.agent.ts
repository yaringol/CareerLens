import { llmCall } from '../infra/llm/llmCall';
import type { MergeInput } from '../services/cvImprove.service';
import { groupForMerge } from '../services/cvImprove.service';

const AGENT_NAME = 'suggestions';
const MERGE_AGENT_NAME = 'cv-merge';

export type Proficiency = 'no_knowledge' | 'beginner' | 'intermediate' | 'proficient' | 'expert';

const PROFICIENCY_GUIDE = `Proficiency levels guide:
- no_knowledge  → subtle mention only; do NOT imply hands-on experience
- beginner      → "basic familiarity", "learning", "entry-level exposure"
- intermediate  → "applied in projects", "working knowledge"
- proficient    → "experienced with", "used in production/team settings"
- expert        → "deep expertise", "led", "designed", "architected"`;

export async function rephraseSkill(
  skill: string,
  proficiency: Proficiency,
  oldText: string,
  jobTitle: string
): Promise<string> {
  const prompt = `You are a CV editor. Your task is to REPHRASE an existing sentence — not rewrite or invent new experience.

Original sentence from CV:
"${oldText}"

Skill to highlight: ${skill}
Candidate's proficiency in this skill: ${proficiency}
Target job: ${jobTitle}

${PROFICIENCY_GUIDE}

STRICT RULES:
1. Keep the same facts and experience — do NOT add or remove accomplishments
2. Keep the same sentence structure and CV flow where possible
3. Only adjust wording so "${skill}" is mentioned naturally and at the right proficiency level
4. Return ONLY the rephrased sentence — no explanation, no extra text, no quotes
5. If "${skill}" is already clearly present in the original, make minimal changes

Rephrased sentence:`;

  const result = await llmCall(AGENT_NAME, [
    { role: 'system', content: 'You are a professional CV editor. Return only the requested text.' },
    { role: 'user', content: prompt },
  ]);

  return result.trim().replace(/^["']|["']$/g, '');
}

export async function addSkillSentence(
  skill: string,
  proficiency: Proficiency,
  jobTitle: string
): Promise<string> {
  if (proficiency === 'no_knowledge') return '';

  const prompt = `You are a CV editor. The skill "${skill}" was not mentioned in this candidate's CV.

Candidate's proficiency in this skill: ${proficiency}
Target job: ${jobTitle}

${PROFICIENCY_GUIDE}

STRICT RULES:
1. Write ONE short sentence only — not a paragraph
2. Do NOT invent projects, companies, or specific achievements
3. Return ONLY the sentence — no explanation, no quotes

Added sentence:`;

  const result = await llmCall(AGENT_NAME, [
    { role: 'system', content: 'You are a professional CV editor. Return only the requested text.' },
    { role: 'user', content: prompt },
  ]);

  return result.trim().replace(/^["']|["']$/g, '');
}

export async function mergeCv(input: MergeInput): Promise<string> {
  const { sectionGroups, newAdditions } = groupForMerge(input);

  // Build the section replacement instructions
  const replacementsText = sectionGroups
    .map((group, i) => {
      const single = group.improvements.length === 1;

      if (single) {
        // One skill → simple replacement
        const imp = group.improvements[0];
        return `${i + 1}. REPLACE this exact text:
"${group.originalText}"

   WITH:
"${imp.finalText}"`;
      }

      // Multiple skills from different tabs rephrased the same paragraph independently.
      // Each finalText is a standalone version — we must SYNTHESIZE them, not pick one.
      const improvementsList = group.improvements
        .map((imp) => `   • Skill: ${imp.skill} (level: ${imp.proficiency})
     Independent rephrasing: "${imp.finalText}"`)
        .join('\n');

      return `${i + 1}. SMART MERGE — multiple skills from different tabs all improved this paragraph:
   Original: "${group.originalText}"

   Each entry below is an INDEPENDENT rephrasing of the original, focused on one skill.
   They were written separately and may overlap or conflict.

${improvementsList}

   YOUR TASK: Write ONE cohesive paragraph that:
   a) Starts from the original text as the base
   b) Naturally incorporates EVERY skill listed above — do NOT drop any
   c) Resolves conflicts by combining both mentions (e.g. "Docker and Kubernetes" not just one)
   d) Preserves the original facts — do not add achievements that weren't there
   e) Matches the CV's writing style (first person / third person / bullet)`;
    })
    .join('\n\n');

  const additionsText =
    newAdditions.length > 0
      ? `\nADDITIONS — append to the Skills or Summary section:\n${newAdditions.map((a) => `- "${a.finalText}"`).join('\n')}`
      : '';

  const prompt = `You are a professional CV editor. Apply the improvements below to the original CV.
Preserve ALL other content exactly — same structure, same formatting, same wording.

ORIGINAL CV:
${input.originalCvText}

IMPROVEMENTS TO APPLY:
${replacementsText || '(none)'}
${additionsText}

RULES:
1. For each REPLACE: find the exact original text and substitute the new version
2. For each SMART MERGE: produce a synthesized paragraph — every listed skill must appear
3. For ADDITIONS: insert into Skills section (add the section if absent)
4. Do NOT change any part of the CV that is not listed above
5. Return ONLY the complete updated CV text — no commentary, no markdown

Updated CV:`;

  const result = await llmCall(MERGE_AGENT_NAME, [
    {
      role: 'system',
      content: 'You are a professional CV editor. Follow instructions precisely. Return only the complete updated CV text.',
    },
    { role: 'user', content: prompt },
  ]);

  return result.trim();
}
