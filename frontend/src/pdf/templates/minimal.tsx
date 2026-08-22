/**
 * "Minimal Executive" template: single column, Swiss whitespace, hairline
 * rules, accent used only for dates and bullet dashes.
 */
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { StructuredCv, StructuredCvEducation, StructuredCvExperience, StructuredCvProject } from '../cvPdfTypes'
import { ACCENT_DEEP, BODY, INK, MUTED, configurePdfHyphenation, contactValues } from '../shared'

const styles = StyleSheet.create({
  page: { fontFamily: 'Inter', paddingTop: 56, paddingBottom: 48, paddingHorizontal: 64, backgroundColor: '#ffffff' },
  name: { fontSize: 30, fontWeight: 700, letterSpacing: -0.6, color: INK, lineHeight: 1.05 },
  headline: { fontSize: 10.5, fontWeight: 500, letterSpacing: 3.2, textTransform: 'uppercase', color: ACCENT_DEEP, marginTop: 7 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  contactItem: { fontSize: 8.6, color: MUTED },
  contactSep: { fontSize: 8.6, color: MUTED, marginHorizontal: 6 },
  nameRule: { height: 2, backgroundColor: INK, marginTop: 18 },
  section: { marginTop: 22 },
  sectionHeading: { fontSize: 8.5, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase', color: INK, marginBottom: 10 },
  entry: { marginBottom: 13 },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  entryTitle: { fontSize: 11, fontWeight: 600, color: INK },
  entryDates: { fontSize: 8.6, fontWeight: 600, color: ACCENT_DEEP },
  entrySub: { fontSize: 9, color: MUTED, marginTop: 1.5 },
  bullet: { flexDirection: 'row', marginTop: 3.5 },
  bulletDash: { width: 12, fontSize: 9.2, color: ACCENT_DEEP },
  bulletText: { flex: 1, fontSize: 9.2, lineHeight: 1.5, color: BODY },
  paragraph: { fontSize: 9.4, lineHeight: 1.6, color: BODY },
  skillLine: { fontSize: 9.2, lineHeight: 1.55, color: BODY, marginBottom: 3 },
  skillCat: { fontWeight: 600, color: INK },
  footer: { position: 'absolute', bottom: 14, left: 64, right: 64, textAlign: 'right', fontSize: 7.5, color: '#9b8ec4' },
})

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDash}>–</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

function Entry({ title, sub, dates, bullets }: { title: string; sub?: string; dates?: string; bullets: string[] }) {
  return (
    <View style={styles.entry}>
      <View style={styles.entryRow}>
        <Text style={styles.entryTitle}>{title}</Text>
        {dates ? <Text style={styles.entryDates}>{dates}</Text> : null}
      </View>
      {sub ? <Text style={styles.entrySub}>{sub}</Text> : null}
      {bullets.map((b, i) => (
        <Bullet key={i} text={b} />
      ))}
    </View>
  )
}

function experienceEntry(e: StructuredCvExperience) {
  return <Entry title={e.title} sub={[e.company, e.location].filter(Boolean).join(', ')} dates={e.dates} bullets={e.bullets} />
}
function projectEntry(p: StructuredCvProject) {
  return <Entry title={p.name} dates={p.dates} bullets={p.bullets} />
}
function educationEntry(e: StructuredCvEducation) {
  return <Entry title={e.degree} sub={e.institution} dates={e.dates} bullets={e.details} />
}

function Section({ title, blocks }: { title: string; blocks: JSX.Element[] }) {
  if (blocks.length === 0) return null
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionHeading}>{title}</Text>
        {blocks[0]}
      </View>
      {blocks.slice(1).map((block, i) => (
        <View key={i} wrap={false}>{block}</View>
      ))}
    </View>
  )
}

export default function MinimalCvPdf({ cv }: { cv: StructuredCv }) {
  configurePdfHyphenation()
  const contacts = contactValues(cv)
  return (
    <Document title={`${cv.name} - CV`} author={cv.name} creator="CareerLens">
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{cv.name}</Text>
        {cv.headline ? <Text style={styles.headline}>{cv.headline}</Text> : null}
        <View style={styles.contactRow}>
          {contacts.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row' }}>
              {i > 0 && <Text style={styles.contactSep}>·</Text>}
              <Text style={styles.contactItem}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.nameRule} />

        {cv.summary ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>Profile</Text>
            <Text style={styles.paragraph}>{cv.summary}</Text>
          </View>
        ) : null}

        <Section title="Experience" blocks={cv.experience.map((e, i) => <View key={i}>{experienceEntry(e)}</View>)} />
        <Section title="Projects" blocks={cv.projects.map((p, i) => <View key={i}>{projectEntry(p)}</View>)} />

        {cv.skills.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>Skills</Text>
            {cv.skills.map((g, i) => (
              <Text key={i} style={styles.skillLine}>
                {g.category ? <Text style={styles.skillCat}>{g.category}:  </Text> : null}
                {g.items.join('  ·  ')}
              </Text>
            ))}
          </View>
        )}

        <Section title="Education" blocks={cv.education.map((e, i) => <View key={i}>{educationEntry(e)}</View>)} />

        {(cv.certifications.length > 0 || cv.languages.length > 0) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>Certifications & Languages</Text>
            {cv.certifications.map((c, i) => (
              <Bullet key={i} text={c} />
            ))}
            {cv.languages.length > 0 && (
              <Text style={[styles.skillLine, { marginTop: 4 }]}>{cv.languages.join('  ·  ')}</Text>
            )}
          </View>
        )}

        {cv.extras.map((x, i) => (
          <View key={i} style={styles.section} wrap={false}>
            <Text style={styles.sectionHeading}>{x.label}</Text>
            {x.items.map((item, j) => (
              <Bullet key={j} text={item} />
            ))}
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${cv.name}  ·  ${pageNumber} / ${totalPages}` : '')}
        />
      </Page>
    </Document>
  )
}
