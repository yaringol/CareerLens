import { PDFParse } from 'pdf-parse';
import { ValidationError } from '../errors';
import { logDebugText, logUploadOk, logUploadWarn } from '../utils/logger';

function normalizeCvText(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/[\n\r\t]/g, ' ');
  t = t.replace(/[^a-z0-9\s]/g, ' ');
  t = t.replace(/\s+/g, ' ');
  return t.trim();
}

// normalizeCvText() is deliberately aggressive (lowercased, punctuation stripped,
// newlines flattened to spaces) for the consumers that were built around it
// (scoring, skill matching). But that same flattening also destroyed the one
// thing CV-title extraction needs: real line breaks — "Alex Cohen\nSoftware
// Engineer" and "alex cohen software engineer" are not the same input. Rather
// than touch the normalized text every other consumer depends on, this keeps a
// small, separately-preserved slice of the ORIGINAL lines (case and punctuation
// intact) for title detection only.
//
// Kept to a modest window (not the whole CV) to bound the size sent to the LLM
// extractor that reads this text — wide enough that a title stated further down
// (e.g. inside a summary paragraph rather than the very first lines) is still
// visible to it, which a hand-written line-position heuristic could never
// safely assume.
const HEADER_TEXT_MAX_LINES = 25;

function extractHeaderText(raw: string, maxLines = HEADER_TEXT_MAX_LINES): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length <= 200);
  return lines.slice(0, maxLines).join('\n');
}

export async function processUpload(
  buffer: Buffer,
  originalName: string
): Promise<{ cvText: string; headerText: string }> {
  let raw: string;
  let parser: PDFParse | undefined;
  try {
    parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    raw = data.text.trim();
  } catch (err) {
    logUploadWarn(err instanceof Error ? err.message : 'PDF parse failed');
    throw new ValidationError('Could not parse PDF file');
  } finally {
    await parser?.destroy();
  }
  if (!raw) {
    logUploadWarn('no extractable text layer');
    throw new ValidationError('No extractable text from PDF');
  }
  logDebugText('CV raw (pre-normalize)', raw);
  const cvText = normalizeCvText(raw);
  logDebugText('CV normalized', cvText);
  if (cvText.length < 50) {
    logUploadWarn(`normalized text too short (${cvText.length} chars)`);
    throw new ValidationError('Extracted CV text is too short to analyze');
  }
  logUploadOk(originalName, cvText.length);
  const headerText = extractHeaderText(raw);
  return { cvText, headerText };
}
