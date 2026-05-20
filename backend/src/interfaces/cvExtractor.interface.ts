// Concrete implementation: src/infra/cvExtractor.ts (using pdf-parse)
// Wrapped in interface to allow swapping implementations.
//
// TBD: Minimum text length threshold (currently: 50 chars)
// TBD: Maximum text length (currently: 50,000 chars — truncate or reject)

export interface ICvTextExtractor {
  /**
   * Extracts and normalizes plain text from a PDF buffer.
   *
   * @param fileBuffer  Raw PDF file bytes
   * @param fileName    Original filename (for error context)
   * @returns Normalized text string (whitespace collapsed, artifacts removed)
   * @throws CvExtractionError  On unreadable PDF, empty output, or corrupt file
   */
  extractText(fileBuffer: Buffer, fileName: string): Promise<string>;
}
