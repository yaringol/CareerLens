/**
 * Registers the Inter faces the CV PDF template uses. Browser-only: relies on
 * Vite's `?url` asset imports. The node smoke test registers the same faces
 * from file paths instead (scripts/render-cv-pdf-sample.mjs).
 */
import { Font } from '@react-pdf/renderer'
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url'

let registered = false

export function registerPdfFonts(): void {
  if (registered) return
  registered = true
  Font.register({
    family: 'Inter',
    fonts: [
      { src: inter400, fontWeight: 400 },
      { src: inter500, fontWeight: 500 },
      { src: inter600, fontWeight: 600 },
      { src: inter700, fontWeight: 700 },
    ],
  })
}
