import { llmCall } from '../infra/llm/llmCall';
import type { MergeInput } from '../services/cvImprove.service';
import { groupForMerge } from '../services/cvImprove.service';

const AGENT_NAME = 'suggestions';
const MERGE_AGENT_NAME = 'cv-merge';

export type Proficiency = 'no_knowledge' | 'beginner' | 'intermediate' | 'proficient' | 'expert';

const EDITOR_SYSTEM_PROMPT = `You are a senior CV/resume editor specializing in technical hiring and ATS-friendly resumes.

Your craft:
- You sharpen wording so a target skill reads clearly and at the candidate's true level of mastery.
- You are an EDITOR, not a ghostwriter: never invent experience, employers, projects, metrics, dates, or titles.
- Preserve the candidate's authentic voice, verb tense, point of view (first vs third person), and the section's existing formatting (bullets, line breaks, capitalization).

Honesty is non-negotiable:
- The stated proficiency level governs how strongly a skill may be framed. Never imply hands-on or production experience the candidate did not claim.
- If the skill is already well represented, prefer minimal edits over rewriting.

Output discipline:
- Return ONLY the text requested - no preamble, no explanation, no markdown fences, no surrounding quotes.`;

const MERGE_SYSTEM_PROMPT = `You are a senior CV editor performing a precise, surgical merge of approved edits.

Principles:
- Apply ONLY the listed changes. Every other part of the CV must stay unchanged - same sections, order, wording, formatting, and whitespace.
- When several edits touch the same paragraph, weave them into ONE natural paragraph that keeps all original facts and reads in the candidate's voice.
- Never invent experience, employers, projects, metrics, or dates.

Output discipline:
- Return ONLY the complete updated CV text - no commentary, no markdown fences, no quotes.`;

const PROFICIENCY_GUIDE = `Proficiency levels guide:
- no_knowledge  -> subtle mention only; do NOT imply hands-on experience
- beginner      -> "basic familiarity", "learning", "entry-level exposure"
- intermediate  -> "applied in projects", "working knowledge"
- proficient    -> "experienced with", "used in production/team settings"
- expert        -> "deep expertise", "led", "designed", "architected"`;

export async function rephraseSkill(
  skill: string,
  proficiency: Proficiency,
  currentSectionText: string,
  jobTitle: string,
  originalSectionText?: string
): Promise<string> {
  const originalContext = originalSectionText
    ? `Original section before this improvement flow:\n"${originalSectionText}"\n\n`
    : '';

  const prompt = `You are a CV editor. Your task is to improve ONE CV section, not the whole CV.

${originalContext}Current section text to edit:
"${currentSectionText}"

Skill to highlight: ${skill}
Candidate's proficiency in this skill: ${proficiency}
Target job: ${jobTitle}

${PROFICIENCY_GUIDE}

STRICT RULES:
1. Return the COMPLETE updated section text, not only the edited sentence
2. Keep the same facts and experience; do NOT add or remove accomplishments
3. Preserve the section's formatting, bullets, line breaks, and CV flow where possible
4. Only adjust wording so "${skill}" is mentioned naturally and at the right proficiency level
5. Return ONLY the updated section text; no explanation, no markdown, no quotes
6. If "${skill}" is already clearly present, make minimal changes

Updated section:`;

  const result = await llmCall(AGENT_NAME, [
    { role: 'system', content: EDITOR_SYSTEM_PROMPT },
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
1. Write ONE short sentence only, not a paragraph
2. Do NOT invent projects, companies, or specific achievements
3. Return ONLY the sentence; no explanation, no quotes

Added sentence:`;

  const result = await llmCall(AGENT_NAME, [
    { role: 'system', content: EDITOR_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);

  return result.trim().replace(/^["']|["']$/g, '');
}

export function appendSkillSentenceToSection(sectionText: string, sentence: string): string {
  const trimmedSentence = sentence.trim();
  if (!trimmedSentence) return sectionText;
  const trimmedSection = sectionText.trimEnd();
  return `${trimmedSection}\n${trimmedSentence}`;
}

/**
 * Legacy helper retained for older callers. The new improvement flow composes the
 * final CV from updated sections in /cv-improve/merge instead of doing a full rewrite.
 */
export async function mergeCv(input: MergeInput): Promise<string> {
  const { sectionGroups, newAdditions } = groupForMerge(input);

  const replacementsText = sectionGroups
    .map((group, i) => {
      const single = group.improvements.length === 1;

      if (single) {
        const imp = group.improvements[0];
        return `${i + 1}. REPLACE this exact text:
"${group.originalText}"

   WITH:
"${imp.finalText}"`;
      }

      const improvementsList = group.improvements
        .map((imp) => `   - Skill: ${imp.skill} (level: ${imp.proficiency})
     Independent rephrasing: "${imp.finalText}"`)
        .join('\n');

      return `${i + 1}. SMART MERGE: multiple skills from different tabs all improved this paragraph:
   Original: "${group.originalText}"

${improvementsList}

   YOUR TASK: Write ONE cohesive paragraph that preserves the original facts and includes every listed skill.`;
    })
    .join('\n\n');

  const additionsText =
    newAdditions.length > 0
      ? `\nADDITIONS: append to the Skills or Summary section:\n${newAdditions.map((a) => `- "${a.finalText}"`).join('\n')}`
      : '';

  const prompt = `You are a professional CV editor. Apply the improvements below to the original CV.
Preserve ALL other content exactly.

ORIGINAL CV:
${input.originalCvText}

IMPROVEMENTS TO APPLY:
${replacementsText || '(none)'}
${additionsText}

Return ONLY the complete updated CV text.

Updated CV:`;

  const result = await llmCall(MERGE_AGENT_NAME, [
    { role: 'system', content: MERGE_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);

  return result.trim();
}
