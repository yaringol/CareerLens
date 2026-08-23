/**
 * Generates the test-fixtures/download-verification/ test kit: plain "incoming CV" PDFs
 * (deliberately NOT the styled export template - these simulate CVs a user
 * uploads) plus their .txt sources. Several are intentionally hostile:
 * letter-spaced headings, no structure, Hebrew/RTL, extreme length.
 *
 * Usage (from frontend/):
 *   node node_modules/esbuild/bin/esbuild scripts/generate-test-cvs.tsx \
 *     --bundle --platform=node --format=cjs --jsx=automatic \
 *     --outfile=scripts/.generate-test-cvs.cjs
 *   node scripts/.generate-test-cvs.cjs
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { Document, Font, Page, StyleSheet, Text, renderToFile } from '@react-pdf/renderer'

const OUT_DIR = path.resolve(__dirname, '../../test-fixtures/download-verification')
const SRC_DIR = path.join(OUT_DIR, 'sources')

// Arial carries Hebrew glyphs; the built-in Helvetica does not.
Font.register({ family: 'Arial', src: 'C:/Windows/Fonts/arial.ttf' })
Font.registerHyphenationCallback((word) => [word])

type Block =
  | { kind: 'name'; text: string }
  | { kind: 'contact'; text: string }
  | { kind: 'heading'; text: string; letterSpacing?: number }
  | { kind: 'para'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'gap' }

interface CvSpec {
  filename: string
  font?: 'Helvetica' | 'Arial'
  blocks: Block[]
}

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10.5, paddingTop: 54, paddingBottom: 54, paddingHorizontal: 58, lineHeight: 1.45 },
  name: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  contact: { fontSize: 9.5, color: '#444444', marginBottom: 2 },
  heading: { fontSize: 11.5, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4 },
  para: { marginBottom: 3 },
  bullet: { marginBottom: 2, paddingLeft: 12 },
  gap: { height: 8 },
})

function CvDoc({ spec }: { spec: CvSpec }) {
  const fontFamily = spec.font ?? 'Helvetica'
  const bold = fontFamily === 'Helvetica' ? 'Helvetica-Bold' : 'Arial'
  return (
    <Document title={spec.filename}>
      <Page size="A4" style={[styles.page, { fontFamily }]}>
        {spec.blocks.map((block, i) => {
          switch (block.kind) {
            case 'name':
              return <Text key={i} style={[styles.name, { fontFamily: bold }]}>{block.text}</Text>
            case 'contact':
              return <Text key={i} style={styles.contact}>{block.text}</Text>
            case 'heading':
              return (
                <Text key={i} style={[styles.heading, { fontFamily: bold, letterSpacing: block.letterSpacing ?? 0 }]}>
                  {block.text}
                </Text>
              )
            case 'para':
              return <Text key={i} style={styles.para}>{block.text}</Text>
            case 'bullet':
              return <Text key={i} style={styles.bullet}>• {block.text}</Text>
            case 'gap':
              return <Text key={i} style={styles.gap}> </Text>
          }
        })}
      </Page>
    </Document>
  )
}

function blockToText(block: Block): string {
  switch (block.kind) {
    case 'bullet': return `• ${block.text}`
    case 'gap': return ''
    default: return block.text
  }
}

// ─── The seven test CVs ──────────────────────────────────────────────

const clean: CvSpec = {
  filename: '01-clean-standard',
  blocks: [
    { kind: 'name', text: 'Dana Cohen' },
    { kind: 'contact', text: 'dana.cohen@email.com | +972-54-987-6543 | Tel Aviv | linkedin.com/in/danacohen' },
    { kind: 'heading', text: 'SUMMARY' },
    { kind: 'para', text: 'Full-stack developer with 4 years of experience building web applications with React, Node.js and PostgreSQL. Strong focus on clean architecture and testing.' },
    { kind: 'heading', text: 'EXPERIENCE' },
    { kind: 'para', text: 'Full-Stack Developer - Wix (2022-Present)' },
    { kind: 'bullet', text: 'Built customer-facing dashboard features in React and TypeScript used by 200k sites.' },
    { kind: 'bullet', text: 'Designed REST APIs in Node.js with PostgreSQL, cutting page load times by 35%.' },
    { kind: 'bullet', text: 'Wrote unit and integration tests with Jest, raising coverage from 40% to 85%.' },
    { kind: 'para', text: 'Junior Developer - Fiverr (2020-2022)' },
    { kind: 'bullet', text: 'Developed internal tools with Vue.js and Express.' },
    { kind: 'bullet', text: 'Migrated legacy jQuery pages to modern components.' },
    { kind: 'heading', text: 'SKILLS' },
    { kind: 'para', text: 'JavaScript, TypeScript, React, Node.js, PostgreSQL, MongoDB, Jest, Docker, Git' },
    { kind: 'heading', text: 'EDUCATION' },
    { kind: 'para', text: 'B.Sc. Computer Science - Technion (2016-2020)' },
    { kind: 'heading', text: 'LANGUAGES' },
    { kind: 'para', text: 'Hebrew (native), English (fluent)' },
  ],
}

const titleCase: CvSpec = {
  filename: '02-title-case-headings',
  blocks: [
    { kind: 'name', text: 'Amir Levi' },
    { kind: 'contact', text: 'amir.levi@gmail.com | 052-111-2233 | github.com/amirlevi' },
    { kind: 'heading', text: 'Professional Summary' },
    { kind: 'para', text: 'Data engineer specializing in batch and streaming pipelines on AWS. Comfortable owning systems end to end, from ingestion to serving.' },
    { kind: 'heading', text: 'Work Experience:' },
    { kind: 'para', text: 'Data Engineer, Riskified - Tel Aviv, 2021 to now' },
    { kind: 'bullet', text: 'Own Airflow pipelines processing 2TB/day into Snowflake.' },
    { kind: 'bullet', text: 'Moved batch jobs to Spark on EMR, reducing runtime from 6h to 50m.' },
    { kind: 'para', text: 'BI Developer, Bank Hapoalim, 2018-2021' },
    { kind: 'bullet', text: 'Built SSIS ETLs and Power BI dashboards for the credit division.' },
    { kind: 'heading', text: 'Core Skills' },
    { kind: 'para', text: 'Python | SQL | Spark | Airflow | Snowflake | AWS (S3, EMR, Glue) | dbt | Kafka' },
    { kind: 'heading', text: 'Education' },
    { kind: 'para', text: 'B.A. Information Systems, College of Management, 2015-2018' },
    { kind: 'heading', text: 'Certifications' },
    { kind: 'para', text: 'AWS Certified Data Analytics - Specialty (2023)' },
  ],
}

const letterSpaced: CvSpec = {
  filename: '03-letter-spaced-headings',
  blocks: [
    { kind: 'name', text: 'Noa Barak' },
    { kind: 'contact', text: 'noa.barak@outlook.com | +972-50-333-4455 | Haifa' },
    { kind: 'heading', text: 'P R O F I L E', letterSpacing: 2 },
    { kind: 'para', text: 'QA automation engineer with a passion for breaking things politely. 6 years across web and mobile.' },
    { kind: 'heading', text: 'E X P E R I E N C E', letterSpacing: 2 },
    { kind: 'para', text: 'Senior QA Automation Engineer - Playtika (2021-Present)' },
    { kind: 'bullet', text: 'Built a Playwright test suite of 900 scenarios running on every merge.' },
    { kind: 'bullet', text: 'Cut flaky-test rate from 12% to under 1% with retry analytics and quarantine flows.' },
    { kind: 'para', text: 'QA Engineer - Ironsource (2018-2021)' },
    { kind: 'bullet', text: 'Automated SDK regression tests in Python and Appium across 40 device models.' },
    { kind: 'heading', text: 'S K I L L S', letterSpacing: 2 },
    { kind: 'para', text: 'Playwright, Selenium, Appium, Python, TypeScript, Jenkins, Docker, JMeter' },
    { kind: 'heading', text: 'M I L I T A R Y   S E R V I C E', letterSpacing: 2 },
    { kind: 'para', text: 'IDF - Ofek unit, software QA specialist (2015-2017).' },
    { kind: 'heading', text: 'E D U C A T I O N', letterSpacing: 2 },
    { kind: 'para', text: 'B.Sc. Software Engineering - Ort Braude (2017-2021)' },
  ],
}

const longRoles = Array.from({ length: 7 }, (_, i) => {
  const year = 2024 - i * 2
  return [
    { kind: 'para', text: `Backend Engineer - MegaCorp Division ${i + 1} (${year - 2}-${year})` } as Block,
    { kind: 'bullet', text: `Designed and delivered a distributed order-processing service handling ${(i + 2) * 10}k requests per minute with strict idempotency guarantees, exactly-once semantics over Kafka, and a full saga-based compensation model for multi-step failures across downstream systems.` } as Block,
    { kind: 'bullet', text: `Led the migration of ${i + 3} legacy services from on-premise VMs to Kubernetes on GKE, including zero-downtime traffic cutover, workload identity, and cost tuning that saved $${(i + 1) * 40}k annually.` } as Block,
    { kind: 'bullet', text: 'Mentored junior engineers through design reviews, pair programming sessions and a weekly internal reading group on distributed systems papers.' } as Block,
  ]
}).flat()

const multipage: CvSpec = {
  filename: '04-multipage-long',
  blocks: [
    { kind: 'name', text: 'Alexander Konstantinopolsky-Rosenbaum' },
    { kind: 'contact', text: 'alexander.konstantinopolsky.rosenbaum@very-long-domain-example.engineering | +972-58-777-8899' },
    { kind: 'contact', text: 'linkedin.com/in/alexander-konstantinopolsky-rosenbaum-1a2b3c4d5e | github.com/alexkonstantinopolsky' },
    { kind: 'heading', text: 'SUMMARY' },
    { kind: 'para', text: 'Backend engineer with 14 years of experience across fintech, e-commerce and infrastructure teams. Deep expertise in distributed systems, event-driven architectures, observability and cost engineering. Known for taking ambiguous, cross-team problems and landing them as boring, reliable systems.' },
    { kind: 'heading', text: 'EXPERIENCE' },
    ...longRoles,
    { kind: 'heading', text: 'PROJECTS' },
    { kind: 'bullet', text: 'open-source: kafka-saga-orchestrator - a compensation-first saga library for Node.js with 1.2k GitHub stars, documented at github.com/alexkonstantinopolsky/kafka-saga-orchestrator-with-a-very-long-repository-name.' },
    { kind: 'heading', text: 'SKILLS' },
    { kind: 'para', text: 'Java, Kotlin, Go, Node.js, Kafka, PostgreSQL, Redis, Kubernetes, Terraform, GCP, AWS, Prometheus, Grafana, OpenTelemetry, ArgoCD, Bazel, gRPC, GraphQL, Elasticsearch, RabbitMQ, Cassandra' },
    { kind: 'heading', text: 'EDUCATION' },
    { kind: 'para', text: 'M.Sc. Computer Science - Ben-Gurion University (2010-2012)' },
    { kind: 'para', text: 'B.Sc. Computer Science - Ben-Gurion University (2007-2010)' },
    { kind: 'heading', text: 'PUBLICATIONS' },
    { kind: 'bullet', text: '"Taming Exactly-Once: Practical Idempotency Patterns for Event-Driven Payments" - talk, Reversim Summit 2023.' },
    { kind: 'bullet', text: '"Cost-Aware Autoscaling in Multi-Tenant Kubernetes Clusters" - blog series, 2022.' },
  ],
}

const minimal: CvSpec = {
  filename: '05-minimal-sparse',
  blocks: [
    { kind: 'name', text: 'Tom Adler' },
    { kind: 'contact', text: 'tom.adler@email.com' },
    { kind: 'gap' },
    { kind: 'para', text: 'Skills: Python, SQL, Excel' },
  ],
}

const messy: CvSpec = {
  filename: '06-messy-no-structure',
  blocks: [
    { kind: 'para', text: 'josé álvarez-cohen // devops&platform // josealvarez@proton.me // tel-aviv–jaffa' },
    { kind: 'gap' },
    { kind: 'para', text: 'i do infra. 2019→2021 worked at some startup (SRE-ish role, mostly firefighting, pagerduty at 3am, you know how it is), terraform + aws, then 2021→now @ bigco doing k8s / argocd / golang controllers — built the internal PaaS everyone complains about but uses daily; also: reduced cloud bill ~30% (rightsizing, spot, savings plans), on-call lead, hiring loop for platform team. before all that: 3 years helpdesk & networking (ccna). random: speak spanish/hebrew/english, marathon runner, i like emacs. education?? dropped out of CS after 2 years (open university), plenty of certs though: CKA, CKAD, terraform associate, aws SAA.' },
  ],
}

const hebrew: CvSpec = {
  filename: '07-hebrew-rtl',
  font: 'Arial',
  blocks: [
    { kind: 'name', text: 'יעל מזרחי' },
    { kind: 'contact', text: 'yael.mizrahi@gmail.com | 054-123-4567 | רמת גן' },
    { kind: 'heading', text: 'תקציר' },
    { kind: 'para', text: 'מפתחת תוכנה עם 5 שנות ניסיון בפיתוח צד שרת, התמחות ב-Java ו-Spring. מחפשת תפקיד עם אתגרים טכנולוגיים בסביבת מיקרו-שירותים.' },
    { kind: 'heading', text: 'ניסיון תעסוקתי' },
    { kind: 'para', text: 'מפתחת Backend - אלביט מערכות (2021-היום)' },
    { kind: 'bullet', text: 'פיתוח שירותי Java Spring Boot במערכת הפצת נתונים בזמן אמת.' },
    { kind: 'bullet', text: 'שדרוג תשתית ההודעות ל-Kafka והורדת זמני עיבוד ב-40%.' },
    { kind: 'para', text: 'מפתחת Full Stack - מטריקס (2019-2021)' },
    { kind: 'bullet', text: 'פיתוח ממשקי Angular ושירותי REST עבור לקוחות בתחום הביטוח.' },
    { kind: 'heading', text: 'כישורים' },
    { kind: 'para', text: 'Java, Spring Boot, Kafka, PostgreSQL, Angular, Docker, Jenkins' },
    { kind: 'heading', text: 'השכלה' },
    { kind: 'para', text: 'תואר ראשון במדעי המחשב - אוניברסיטת בר אילן (2016-2019)' },
  ],
}

const specs: CvSpec[] = [clean, titleCase, letterSpaced, multipage, minimal, messy, hebrew]

async function main() {
  fs.mkdirSync(SRC_DIR, { recursive: true })
  for (const spec of specs) {
    await renderToFile(<CvDoc spec={spec} />, path.join(OUT_DIR, `${spec.filename}.pdf`))
    fs.writeFileSync(path.join(SRC_DIR, `${spec.filename}.txt`), spec.blocks.map(blockToText).join('\n'), 'utf8')
    console.log(`rendered ${spec.filename}.pdf`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
