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

export async function processUpload(
  buffer: Buffer,
  originalName: string
): Promise<{ cvText: string }> {
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
  return { cvText };
}
