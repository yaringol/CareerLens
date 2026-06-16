import commonWords from './commonWords.json';

const COMMON_WORDS = new Set(commonWords.map((word) => word.toLowerCase()));
const MIN_WORDS = 5;
const MIN_COMMON_RATIO = 0.3;

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z]{3,}/g) ?? [];
}

export function isGibberish(text: string): boolean {
  const words = extractWords(text);
  if (words.length < MIN_WORDS) return true;

  const commonCount = words.filter((word) => COMMON_WORDS.has(word)).length;
  return commonCount / words.length < MIN_COMMON_RATIO;
}
