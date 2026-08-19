/**
 * "Timeline" template: single column, experience entries hang on a vertical
 * accent timeline, two-tone accent bar in the header, chip skills.
 */
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { StructuredCv, StructuredCvExperience } from '../cvPdfTypes'
import { ACCENT, ACCENT_DEEP, ACCENT_LIGHT, BODY, INK, MUTED, configurePdfHyphenation, contactValues, isSentenceLike } from '../shared'

const styles = StyleSheet.create({
  page: { fontFamily: 'Inter', paddingTop: 48, paddingBottom: 44, paddingHorizontal: 56, backgroundColor: '#ffffff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: INK, lineHeight: 1.08 },
  headline: { fontSize: 10, fontWeight: 600, letterSpacing: 2.4, textTransform: 'uppercase', color: ACCENT_DEEP, marginTop: 5 },
  contactCol: { alignItems: 'flex-end' },
  contactItem: { fontSize: 8.2, color: MUTED, marginBottom: 2.5 },
  accentBar: { flexDirection: 'row', marginTop: 16, marginBottom: 4 },
  accentA: { width: 64, height: 4, backgroundColor: ACCENT, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  accentB: { width: 26, height: 4, backgroundColor: '#c084fc', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  section: { marginTop: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headingSquare: { width: 7, height: 7, backgroundColor: ACCENT, borderRadius: 2, marginRight: 7 },
  sectionHeading: { fontSize: 9.5, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: INK },
  paragraph: { fontSize: 9.4, lineHeight: 1.55, color: BODY },
  tlEntry: { flexDirection: 'row' },
  tlRail: { width: 20, alignItems: 'center' },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT, borderWidth: 1.5, borderColor: '#ffffff', marginTop: 2.5 },
  tlLine: { flex: 1, width: 2, backgroundColor: 'rgba(139, 124, 246, 0.30)', marginTop: 2 },
  tlBody: { flex: 1, paddingLeft: 8, paddingBottom: 14 },
  tlDates: { fontSize: 8.2, fontWeight: 700, letterSpacing: 0.6, color: ACCENT_DEEP, textTransform: 'uppercase' },
  entryTitle: { fontSize: 10.6, fontWeight: 600, color: INK, marginTop: 2 },
  entrySub: { fontSize: 8.8, fontWeight: 500, color: MUTED, marginTop: 1.5 },
  bullet: { flexDirection: 'row', marginTop: 3.5 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: ACCENT, marginTop: 4.2, marginRight: 6 },
  bulletText: { flex: 1, fontSize: 9.1, lineHeight: 1.45, color: BODY },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: ACCENT_LIGHT, borderRadius: 9, paddingVertical: 3, paddingHorizontal: 8, marginRight: 5, marginBottom: 5 },
  chipText: { fontSize: 8.2, fontWeight: 500, color: ACCENT_DEEP },
  chipCat: { fontSize: 8, fontWeight: 600, color: MUTED, marginBottom: 4, marginTop: 2 },
  twoCol: { flexDirection: 'row', marginTop: 4 },
  colHalf: { flex: 1, paddingRight: 16 },
  smallText: { fontSize: 9, lineHeight: 1.45, color: BODY, marginBottom: 3 },
  smallTitle: { fontSize: 9.6, fontWeight: 600, color: INK },
  footer: { position: 'absolute', bottom: 12, left: 56, right: 56, textAlign: 'right', fontSize: 7.5, color: '#9b8ec4' },
})

function Heading({ title }: { title: string }) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingSquare} />
      <Text style={styles.sectionHeading}>{title}</Text>
    </View>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.dot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

function TimelineEntry({ entry, last }: { entry: StructuredCvExperience; last: boolean }) {
  const sub = [entry.company, entry.location].filter(Boolean).join('  ·  ')
  return (
    <View style={styles.tlEntry}>
      <View style={styles.tlRail}>
        <View style={styles.tlDot} />
        {!last && <View style={styles.tlLine} />}
      </View>
      <View style={styles.tlBody}>
        {entry.dates ? <Text style={styles.tlDates}>{entry.dates}</Text> : null}
        <Text style={styles.entryTitle}>{entry.title}</Text>
        {sub ? <Text style={styles.entrySub}>{sub}</Text> : null}
        {entry.bullets.map((b, j) => (
          <Bullet key={j} text={b} />
        ))}
      </View>
    </View>
  )
}

export default function TimelineCvPdf({ cv }: { cv: StructuredCv }) {
  configurePdfHyphenation()
  return (
    <Document title={`${cv.name} - CV`} author={cv.name} creator="CareerLens">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.name}>{cv.name}</Text>
            {cv.headline ? <Text style={styles.headline}>{cv.headline}</Text> : null}
            <View style={styles.accentBar}>
              <View style={styles.accentA} />
              <View style={styles.accentB} />
            </View>
          </View>
          <View style={styles.contactCol}>
            {contactValues(cv).map((item, i) => (
              <Text key={i} style={styles.contactItem}>{item}</Text>
            ))}
          </View>
        </View>

        {cv.summary ? (
          <View style={styles.section} wrap={false}>
            <Heading title="Profile" />
            <Text style={styles.paragraph}>{cv.summary}</Text>
          </View>
        ) : null}

        {cv.experience.length > 0 && (
          <View style={styles.section}>
            <View wrap={false}>
              <Heading title="Experience" />
              <TimelineEntry entry={cv.experience[0]} last={cv.experience.length === 1} />
            </View>
            {cv.experience.slice(1).map((e, i) => (
              <View key={i} wrap={false}>
                <TimelineEntry entry={e} last={i === cv.experience.length - 2} />
              </View>
            ))}
          </View>
        )}

        {cv.skills.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Heading title="Skills" />
            {cv.skills.map((g, i) => (
              <View key={i}>
                {g.category ? <Text style={styles.chipCat}>{g.category}</Text> : null}
                <View style={styles.chipRow}>
                  {g.items.filter((s) => !isSentenceLike(s)).map((s, j) => (
                    <View key={j} style={styles.chip}>
                      <Text style={styles.chipText}>{s}</Text>
                    </View>
                  ))}
                </View>
                {g.items.filter(isSentenceLike).map((s, j) => (
                  <Bullet key={`s${j}`} text={s} />
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.projects.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Heading title="Projects" />
            {cv.projects.map((p, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={styles.smallTitle}>{p.name}{p.dates ? `  ·  ${p.dates}` : ''}</Text>
                {p.bullets.map((x, j) => (
                  <Bullet key={j} text={x} />
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={styles.twoCol} wrap={false}>
          {cv.education.length > 0 && (
            <View style={styles.colHalf}>
              <View style={styles.section}>
                <Heading title="Education" />
                {cv.education.map((e, i) => (
                  <View key={i} style={{ marginBottom: 6 }}>
                    <Text style={styles.smallTitle}>{e.degree}</Text>
                    <Text style={styles.smallText}>{[e.institution, e.dates].filter(Boolean).join(' · ')}</Text>
                    {e.details.map((d, j) => (
                      <Bullet key={j} text={d} />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}
          {(cv.certifications.length > 0 || cv.languages.length > 0) && (
            <View style={styles.colHalf}>
              <View style={styles.section}>
                <Heading title="Certifications & Languages" />
                {cv.certifications.map((x, i) => (
                  <Bullet key={i} text={x} />
                ))}
                {cv.languages.length > 0 && (
                  <Text style={[styles.smallText, { marginTop: 5 }]}>{cv.languages.join('  ·  ')}</Text>
                )}
              </View>
            </View>
          )}
        </View>

        {cv.extras.map((x, i) => (
          <View key={i} style={styles.section} wrap={false}>
            <Heading title={x.label} />
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
