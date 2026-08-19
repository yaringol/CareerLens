/**
 * Renders a StructuredCv JSON file through the real PDF template - handy for
 * debugging what a live /cv-improve/structure response will look like.
 *
 * Usage (from frontend/):
 *   node node_modules/esbuild/bin/esbuild scripts/render-structured-cv.tsx \
 *     --bundle --platform=node --format=cjs --jsx=automatic \
 *     --outfile=scripts/.render-structured-cv.cjs
 *   node scripts/.render-structured-cv.cjs <structured.json> <out.pdf>
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { Font, renderToFile } from '@react-pdf/renderer'
import CvPdfDocument from '../src/pdf/CvPdfDocument'
import type { StructuredCv } from '../src/pdf/cvPdfTypes'

const FONT_DIR = path.resolve(__dirname, '../node_modules/@fontsource/inter/files')

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(FONT_DIR, 'inter-latin-400-normal.woff'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'inter-latin-500-normal.woff'), fontWeight: 500 },
    { src: path.join(FONT_DIR, 'inter-latin-600-normal.woff'), fontWeight: 600 },
    { src: path.join(FONT_DIR, 'inter-latin-700-normal.woff'), fontWeight: 700 },
  ],
})

const [jsonPath, outPath] = process.argv.slice(2)
if (!jsonPath || !outPath) {
  console.error('usage: render-structured-cv <structured.json> <out.pdf>')
  process.exit(1)
}

const cv = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as StructuredCv

renderToFile(<CvPdfDocument cv={cv} />, outPath)
  .then(() => console.log(`rendered ${outPath}`))
  .catch((err) => { console.error(err); process.exit(1) })
