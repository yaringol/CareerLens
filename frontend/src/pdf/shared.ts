/**
 * Palette and helpers shared by all CV PDF templates.
 */
import { Font } from '@react-pdf/renderer'
import type { StructuredCv } from './cvPdfTypes'

export const INK = '#17153a'
export const BODY = '#3d3a5c'
export const MUTED = '#6d66ab'
export const INDIGO = '#1e1b6e'
export const ACCENT = '#8b7cf6'
export const ACCENT_DEEP = '#6c5fd8'
export const ACCENT_LIGHT = '#f0edfd'

let hyphenationConfigured = false

/**
 * Default hyphenation inserts breaks mid-word ("Kuber-netes"). Disable it, but
 * still chunk very long unbroken tokens (URLs) so they wrap instead of
 * overflowing their column. Every template calls this before rendering.
 */
export function configurePdfHyphenation(): void {
  if (hyphenationConfigured) return
  hyphenationConfigured = true
  Font.registerHyphenationCallback((word) => {
    if (word.length <= 16) return [word]
    const chunks: string[] = []
    for (let i = 0; i < word.length; i += 12) chunks.push(word.slice(i, i + 12))
    return chunks
  })
}

/** Show URLs as clean handles: no protocol, no www, no trailing slash. */
export function cleanUrl(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

/** A skills item that reads like prose rather than a skill name. */
export function isSentenceLike(item: string): boolean {
  return item.length > 40 || item.trim().split(/\s+/).length > 5 || /[.!?]$/.test(item.trim())
}

/** All present contact values, URLs cleaned, in display order. */
export function contactValues(cv: StructuredCv): string[] {
  const c = cv.contact
  return [
    c.email,
    c.phone,
    c.location,
    c.linkedin && cleanUrl(c.linkedin),
    c.github && cleanUrl(c.github),
    c.website && cleanUrl(c.website),
  ].filter(Boolean) as string[]
}
