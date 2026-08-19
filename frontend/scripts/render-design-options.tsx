/**
 * Renders every production CV PDF template with the same sample data so the
 * designs can be compared side by side (output: repo-root design-options/).
 *
 * Usage (from frontend/):
 *   node node_modules/esbuild/bin/esbuild scripts/render-design-options.tsx \
 *     --bundle --platform=node --format=cjs --jsx=automatic \
 *     --outfile=scripts/.render-design-options.cjs
 *   node scripts/.render-design-options.cjs [outputDir]
 */
import path from 'node:path'
import fs from 'node:fs'
import React from 'react'
import { Font, renderToFile } from '@react-pdf/renderer'
import { getTemplateComponent } from '../src/pdf/templates'
import { CV_PDF_TEMPLATE_META } from '../src/pdf/templateMeta'
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

const sample: StructuredCv = {
  name: 'John Smith',
  headline: 'DevOps Engineer',
  contact: {
    email: 'john.smith@email.com',
    phone: '+972-52-123-4567',
    location: 'Tel Aviv, Israel',
    linkedin: 'linkedin.com/in/john-smith-devops',
    github: 'github.com/johnsmith',
  },
  summary:
    'DevOps engineer with 5 years of experience building CI/CD pipelines, automating infrastructure and improving deployment reliability across cloud environments. Passionate about developer experience and observability.',
  skills: [
    { category: 'Cloud & Infrastructure', items: ['AWS', 'Terraform', 'Kubernetes', 'Docker', 'Linux'] },
    { category: 'CI/CD & Monitoring', items: ['Jenkins', 'GitHub Actions', 'ArgoCD', 'Prometheus', 'Grafana'] },
    { items: ['Proficient in Python scripting, applied across automation and tooling tasks.'] },
  ],
  experience: [
    {
      title: 'DevOps Engineer',
      company: 'CloudTech Solutions',
      location: 'Tel Aviv',
      dates: '2021 - Present',
      bullets: [
        'Built and maintained CI/CD pipelines with Jenkins and GitHub Actions serving 40+ microservices.',
        'Led the migration from self-managed Kubernetes to EKS, cutting cluster maintenance time by 60%.',
        'Introduced Prometheus and Grafana dashboards that reduced mean time to detection from hours to minutes.',
      ],
    },
    {
      title: 'Junior System Administrator',
      company: 'DataServe Ltd',
      location: 'Herzliya',
      dates: '2019 - 2021',
      bullets: [
        'Administered 120 Linux servers, automating patching and backups with Ansible and Bash.',
        'Containerized six legacy applications with Docker, standardizing local development for three teams.',
      ],
    },
  ],
  education: [
    {
      degree: 'B.Sc. Computer Science',
      institution: 'Tel Aviv University',
      dates: '2016 - 2019',
      details: ['Specialization in distributed systems; graduated with honors.'],
    },
  ],
  projects: [
    {
      name: 'Internal Developer Platform',
      dates: '2023',
      bullets: ['Self-service platform on ArgoCD and Backstage for one-click preview environments.'],
    },
  ],
  certifications: ['AWS Certified Solutions Architect - Associate', 'CKA: Certified Kubernetes Administrator'],
  languages: ['Hebrew (native)', 'English (fluent)'],
  extras: [{ label: 'Military Service', items: ['IDF, Mamram - infrastructure unit (2013-2016).'] }],
}

const outDir = process.argv[2] ?? path.resolve(__dirname, '../../design-options')

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  for (const meta of CV_PDF_TEMPLATE_META) {
    const Component = getTemplateComponent(meta.id)
    const file = path.join(outDir, `template-${meta.id}.pdf`)
    await renderToFile(<Component cv={sample} />, file)
    console.log(`rendered ${file}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
