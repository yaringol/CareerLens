/**
 * Template metadata only - safe to import from UI code. The template
 * components themselves live behind the lazy generateCvPdf chunk (they pull
 * in @react-pdf/renderer, which must stay out of the main bundle).
 */
export type CvPdfTemplateId = 'sidebar' | 'headerBand' | 'minimal' | 'timeline'

export interface CvPdfTemplateMeta {
  id: CvPdfTemplateId
  name: string
  description: string
}

export const CV_PDF_TEMPLATE_META: CvPdfTemplateMeta[] = [
  { id: 'sidebar', name: 'Classic Sidebar', description: 'Deep indigo sidebar with skill chips' },
  { id: 'headerBand', name: 'Header Band', description: 'Bold header band, light skills rail' },
  { id: 'minimal', name: 'Minimal', description: 'Clean single column, lots of air' },
  { id: 'timeline', name: 'Timeline', description: 'Career story on a vertical timeline' },
]

export const DEFAULT_TEMPLATE_ID: CvPdfTemplateId = 'sidebar'

export function asTemplateId(value: string | null | undefined): CvPdfTemplateId {
  return CV_PDF_TEMPLATE_META.some((t) => t.id === value) ? (value as CvPdfTemplateId) : DEFAULT_TEMPLATE_ID
}
