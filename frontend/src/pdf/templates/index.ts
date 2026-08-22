/**
 * Maps template ids to their components. Only imported from the lazy
 * generateCvPdf chunk - every component here pulls in @react-pdf/renderer.
 * UI code that needs names/descriptions imports ../templateMeta instead.
 */
import type { ComponentType } from 'react'
import type { StructuredCv } from '../cvPdfTypes'
import { DEFAULT_TEMPLATE_ID, type CvPdfTemplateId } from '../templateMeta'
import SidebarCvPdf from '../CvPdfDocument'
import MinimalCvPdf from './minimal'
import HeaderBandCvPdf from './headerBand'
import TimelineCvPdf from './timeline'

const COMPONENTS: Record<CvPdfTemplateId, ComponentType<{ cv: StructuredCv }>> = {
  sidebar: SidebarCvPdf,
  headerBand: HeaderBandCvPdf,
  minimal: MinimalCvPdf,
  timeline: TimelineCvPdf,
}

export function getTemplateComponent(id: string | null | undefined): ComponentType<{ cv: StructuredCv }> {
  return COMPONENTS[(id as CvPdfTemplateId) ?? DEFAULT_TEMPLATE_ID] ?? COMPONENTS[DEFAULT_TEMPLATE_ID]
}
