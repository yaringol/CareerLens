import pdfParse from 'pdf-parse'
import { ValidationError } from '../errors'

export async function processUpload(fileBuffer: Buffer, originalName: string) {
  if (!originalName.toLowerCase().endsWith('.pdf')) {
    throw new ValidationError('Only PDF files are supported')
  }

  const parsed = await pdfParse(fileBuffer)
  const rawText = parsed.text || ''

  const cvText = rawText
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cvText) {
    throw new ValidationError('No extractable text found in PDF')
  }

  return {
    fileName: originalName,
    cvText,
  }
}