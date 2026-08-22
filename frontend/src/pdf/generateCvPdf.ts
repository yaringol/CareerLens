/**
 * Renders the structured CV into a PDF blob with the chosen template. Kept in
 * its own module so the screen can `import()` it on demand - @react-pdf/renderer
 * is heavy and only needed when the user actually exports a PDF.
 */
import { createElement } from 'react'
import { pdf, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { registerPdfFonts } from './registerPdfFonts'
import { getTemplateComponent } from './templates'
import type { CvPdfTemplateId } from './templateMeta'
import type { StructuredCv } from './cvPdfTypes'

export async function generateCvPdfBlob(cv: StructuredCv, templateId?: CvPdfTemplateId): Promise<Blob> {
  registerPdfFonts()
  // pdf() wants ReactElement<DocumentProps>; our wrappers' own prop is `cv`,
  // but the element each one renders is a <Document>, so the cast is sound.
  const element = createElement(getTemplateComponent(templateId), { cv }) as unknown as ReactElement<DocumentProps>
  return pdf(element).toBlob()
}
