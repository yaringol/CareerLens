import pdfParse from 'pdf-parse';
import { ICvTextExtractor } from '../interfaces/cvExtractor.interface';
import { CvExtractionError } from '../errors';

class CvExtractor implements ICvTextExtractor {
  async extractText(fileBuffer: Buffer, fileName: string): Promise<string> {
    let data: { text: string };
    try {
      data = await pdfParse(fileBuffer);
    } catch {
      throw new CvExtractionError(`Could not extract text from PDF: ${fileName}`);
    }

    const normalized = data.text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      throw new CvExtractionError('PDF appears to contain no readable text');
    }

    return normalized;
  }
}

export const cvExtractor = new CvExtractor();
