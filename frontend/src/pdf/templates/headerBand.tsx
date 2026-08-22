/**
 * "Header Band" template: full-width deep-indigo header with name and contact,
 * main column beside a light lavender rail (skills, education, certifications).
 */
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { StructuredCv, StructuredCvExperience } from '../cvPdfTypes'
import { ACCENT, ACCENT_DEEP, ACCENT_LIGHT, BODY, INDIGO, INK, MUTED, configurePdfHyphenation, contactValues, isSentenceLike } from '../shared'

const styles = StyleSheet.create({
  page: { fontFamily: 'Inter', paddingBottom: 40, backgroundColor: '#ffffff' },
  band: { backgroundColor: INDIGO, paddingTop: 34, paddingBottom: 26, paddingHorizontal: 44 },
  bandName: { fontSize: 26, fontWeight: 700, letterSpacing: -0.4, color: '#ffffff' },
  bandHeadline: { fontSize: 10, fontWeight: 600, letterSpacing: 2.6, textTransform: 'uppercase', color: '#beb3fa', marginTop: 5 },
  bandContact: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  bandContactItem: { fontSize: 8.2, color: 'rgba(255,255,255,0.85)', marginRight: 14, marginBottom: 2 },
  bandAccent: { height: 3.5, backgroundColor: ACCENT },
  body: { flexDirection: 'row', paddingTop: 24, paddingHorizontal: 44 },
  main: { flex: 1, paddingRight: 24 },
  rail: { width: 168, backgroundColor: '#f6f4fe', borderRadius: 8, padding: 14, alignSelf: 'flex-start' },
  sectionHeading: { fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: INDIGO, marginBottom: 8 },
  section: { marginBottom: 18 },
  paragraph: { fontSize: 9.3, lineHeight: 1.55, color: BODY },
  entry: { marginBottom: 11 },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  entryTitle: { fontSize: 10.4, fontWeight: 600, color: INK },
  entrySub: { fontSize: 8.7, fontWeight: 500, color: MUTED, marginTop: 1.5 },
  datePill: { backgroundColor: ACCENT_LIGHT, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 7, marginTop: 1 },
  datePillText: { fontSize: 8, fontWeight: 600, color: ACCENT_DEEP },
  bullet: { flexDirection: 'row', marginTop: 3.5 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: ACCENT, marginTop: 4.2, marginRight: 6 },
  bulletText: { flex: 1, fontSize: 9.1, lineHeight: 1.45, color: BODY },
  railHeading: { fontSize: 8, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: INDIGO, marginBottom: 7 },
  railSection: { marginBottom: 14 },
  railCat: { fontSize: 7.6, fontWeight: 600, color: ACCENT_DEEP, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(108, 95, 216, 0.35)', borderRadius: 7, paddingVertical: 2.2, paddingHorizontal: 6, marginRight: 4, marginBottom: 4 },
  chipText: { fontSize: 7.6, color: INK },
  railText: { fontSize: 8.2, lineHeight: 1.45, color: BODY, marginBottom: 4 },
  railItemRow: { flexDirection: 'row', marginBottom: 4 },
  footer: { position: 'absolute', bottom: 12, left: 44, right: 44, textAlign: 'right', fontSize: 7.5, color: '#9b8ec4' },
})

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.dot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

function Entry({ title, sub, dates, bullets }: { title: string; sub?: string; dates?: string; bullets: string[] }) {
  return (
    <View style={styles.entry}>
      <View style={styles.entryRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.entryTitle}>{title}</Text>
          {sub ? <Text style={styles.entrySub}>{sub}</Text> : null}
        </View>
        {dates ? (
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{dates}</Text>
          </View>
        ) : null}
      </View>
      {bullets.map((b, i) => (
        <Bullet key={i} text={b} />
      ))}
    </View>
  )
}

function expSub(e: StructuredCvExperience): string {
  return [e.company, e.location].filter(Boolean).join('  ·  ')
}

function MainSection({ title, blocks }: { title: string; blocks: JSX.Element[] }) {
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

export default function HeaderBandCvPdf({ cv }: { cv: StructuredCv }) {
  configurePdfHyphenation()
  return (
    <Document title={`${cv.name} - CV`} author={cv.name} creator="CareerLens">
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          <Text style={styles.bandName}>{cv.name}</Text>
          {cv.headline ? <Text style={styles.bandHeadline}>{cv.headline}</Text> : null}
          <View style={styles.bandContact}>
            {contactValues(cv).map((item, i) => (
              <Text key={i} style={styles.bandContactItem}>{item}</Text>
            ))}
          </View>
        </View>
        <View style={styles.bandAccent} />

        <View style={styles.body}>
          <View style={styles.main}>
            {cv.summary ? (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionHeading}>Profile</Text>
                <Text style={styles.paragraph}>{cv.summary}</Text>
              </View>
            ) : null}

            <MainSection
              title="Experience"
              blocks={cv.experience.map((e, i) => (
                <Entry key={i} title={e.title} sub={expSub(e)} dates={e.dates} bullets={e.bullets} />
              ))}
            />

            <MainSection
              title="Projects"
              blocks={cv.projects.map((p, i) => (
                <Entry key={i} title={p.name} dates={p.dates} bullets={p.bullets} />
              ))}
            />

            {cv.extras.map((x, i) => (
              <View key={i} style={styles.section} wrap={false}>
                <Text style={styles.sectionHeading}>{x.label}</Text>
                {x.items.map((item, j) => (
                  <Bullet key={j} text={item} />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.rail}>
            {cv.skills.length > 0 && (
              <View style={styles.railSection}>
                <Text style={styles.railHeading}>Skills</Text>
                {cv.skills.map((g, i) => (
                  <View key={i} style={{ marginBottom: 6 }}>
                    {g.category ? <Text style={styles.railCat}>{g.category}</Text> : null}
                    <View style={styles.chipRow}>
                      {g.items.filter((s) => !isSentenceLike(s)).map((s, j) => (
                        <View key={j} style={styles.chip}>
                          <Text style={styles.chipText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                    {g.items.filter(isSentenceLike).map((s, j) => (
                      <View key={`s${j}`} style={styles.railItemRow}>
                        <View style={styles.dot} />
                        <Text style={[styles.railText, { flex: 1, marginBottom: 0 }]}>{s}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {cv.education.length > 0 && (
              <View style={styles.railSection}>
                <Text style={styles.railHeading}>Education</Text>
                {cv.education.map((e, i) => (
                  <View key={i} style={{ marginBottom: 6 }}>
                    <Text style={[styles.railText, { fontWeight: 600, color: INK, marginBottom: 1 }]}>{e.degree}</Text>
                    <Text style={styles.railText}>{[e.institution, e.dates].filter(Boolean).join(' · ')}</Text>
                  </View>
                ))}
              </View>
            )}

            {cv.certifications.length > 0 && (
              <View style={styles.railSection}>
                <Text style={styles.railHeading}>Certifications</Text>
                {cv.certifications.map((c, i) => (
                  <View key={i} style={styles.railItemRow}>
                    <View style={styles.dot} />
                    <Text style={[styles.railText, { flex: 1, marginBottom: 0 }]}>{c}</Text>
                  </View>
                ))}
              </View>
            )}

            {cv.languages.length > 0 && (
              <View style={styles.railSection}>
                <Text style={styles.railHeading}>Languages</Text>
                {cv.languages.map((l, i) => (
                  <Text key={i} style={styles.railText}>{l}</Text>
                ))}
              </View>
            )}
          </View>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${cv.name}  ·  ${pageNumber} / ${totalPages}` : '')}
        />
      </Page>
    </Document>
  )
}
