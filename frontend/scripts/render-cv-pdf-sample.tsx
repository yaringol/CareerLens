/**
 * Dev preview for the CV PDF template: renders CvPdfDocument with realistic
 * sample data (a short one-pager and a long two-pager) so design changes can
 * be reviewed without running the full app.
 *
 * Usage (from frontend/):
 *   node node_modules/esbuild/bin/esbuild scripts/render-cv-pdf-sample.tsx \
 *     --bundle --platform=node --format=cjs --jsx=automatic \
 *     --outfile=scripts/.render-cv-pdf-sample.cjs
 *   node scripts/.render-cv-pdf-sample.cjs [outputDir]
 */
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

const sample: StructuredCv = {
  name: 'John Smith',
  headline: 'DevOps Engineer',
  contact: {
    email: 'john.smith@email.com',
    phone: '+972-52-123-4567',
    location: 'Tel Aviv, Israel',
    linkedin: 'https://www.linkedin.com/in/john-smith-devops',
    github: 'https://github.com/johnsmith',
  },
  summary:
    'DevOps engineer with 5 years of experience building CI/CD pipelines, automating infrastructure and improving deployment reliability across cloud environments. Passionate about developer experience, observability and shipping infrastructure as code that teams can actually maintain.',
  skills: [
    {
      category: 'Cloud & Infrastructure',
      items: ['AWS', 'Terraform', 'Kubernetes', 'Docker', 'Linux'],
    },
    {
      category: 'CI/CD & Automation',
      items: ['Jenkins', 'GitHub Actions', 'ArgoCD', 'Ansible'],
    },
    {
      category: 'Monitoring & Scripting',
      items: ['Prometheus', 'Grafana', 'Python', 'Bash'],
    },
  ],
  experience: [
    {
      title: 'DevOps Engineer',
      company: 'CloudTech Solutions',
      location: 'Tel Aviv',
      dates: '2021 - Present',
      bullets: [
        'Built and maintained CI/CD pipelines with Jenkins and GitHub Actions serving 40+ microservices.',
        'Managed AWS infrastructure with Terraform: EC2, EKS, RDS, S3 and CloudFront across three environments.',
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
        'On-call incident response for production systems with 99.9% uptime SLA.',
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
      bullets: [
        'Designed a self-service platform on ArgoCD and Backstage that lets developers spin up preview environments in one click.',
      ],
    },
  ],
  certifications: ['AWS Certified Solutions Architect - Associate', 'CKA: Certified Kubernetes Administrator'],
  languages: ['Hebrew (native)', 'English (fluent)'],
  extras: [
    {
      label: 'Military Service',
      items: ['IDF, Mamram - infrastructure unit. Administered mission-critical Linux systems (2013-2016).'],
    },
  ],
}

// Long variant: stresses pagination and the fixed sidebar band on page 2.
const longSample: StructuredCv = {
  ...sample,
  experience: [
    ...sample.experience,
    {
      title: 'Site Reliability Engineer (contract)',
      company: 'FinPay',
      location: 'Ramat Gan',
      dates: '2018 - 2019',
      bullets: [
        'Hardened a payment platform for PCI-DSS compliance, closing 30+ audit findings across network and host layers.',
        'Wrote Python tooling to reconcile infrastructure state against Terraform, catching drift in nightly runs.',
        'Cut cloud spend 25% by right-sizing instances and moving batch workloads to spot fleets.',
      ],
    },
    {
      title: 'IT Support Specialist',
      company: 'TechStart',
      location: 'Tel Aviv',
      dates: '2017 - 2018',
      bullets: [
        'Supported a 200-seat office: identity management, imaging, network troubleshooting.',
        'Automated onboarding with PowerShell, cutting laptop setup from a day to under an hour.',
      ],
    },
  ],
  projects: [
    ...sample.projects,
    {
      name: 'Open-source Terraform modules',
      dates: '2022',
      bullets: [
        'Published reusable modules for EKS blueprints with 300+ GitHub stars; maintained through two provider major versions.',
      ],
    },
  ],
}

const outDir = process.argv[2] ?? __dirname

async function main() {
  await renderToFile(<CvPdfDocument cv={sample} />, path.join(outDir, 'cv-sample-short.pdf'))
  await renderToFile(<CvPdfDocument cv={longSample} />, path.join(outDir, 'cv-sample-long.pdf'))
  console.log(`rendered cv-sample-short.pdf and cv-sample-long.pdf to ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
