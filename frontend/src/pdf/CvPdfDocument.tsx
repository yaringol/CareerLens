/**
 * The designed CV PDF template: a full-height deep-indigo sidebar (contact,
 * skills, languages, certifications) beside a light main column (summary,
 * experience, projects, education, extras), in the CareerLens brand palette.
 *
 * Pure component: fonts must be registered by the caller (registerPdfFonts in
 * the browser, file-path registration in the node smoke script).
 */
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type {
  StructuredCv,
  StructuredCvEducation,
  StructuredCvExperience,
  StructuredCvProject,
} from './cvPdfTypes'

// Default hyphenation inserts breaks mid-word ("Kuber-netes"). Disable it, but
// still chunk very long unbroken tokens (URLs) so they wrap instead of
// overflowing the column.
Font.registerHyphenationCallback((word) => {
  if (word.length <= 16) return [word]
  const chunks: string[] = []
  for (let i = 0; i < word.length; i += 12) chunks.push(word.slice(i, i + 12))
  return chunks
})

const SIDEBAR_WIDTH = 186

const INDIGO = '#1e1b6e'
const INK = '#17153a'
const BODY = '#3d3a5c'
const MUTED = '#6d66ab'
const ACCENT = '#8b7cf6'
const ACCENT_DEEP = '#6c5fd8'
const SIDEBAR_HEADING = '#beb3fa'
const SIDEBAR_TEXT = 'rgba(255, 255, 255, 0.92)'
const SIDEBAR_FAINT = 'rgba(255, 255, 255, 0.55)'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    flexDirection: 'row',
    paddingTop: 0,
    paddingBottom: 30,
    backgroundColor: '#ffffff',
  },
  sidebarBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: INDIGO,
  },
  sidebarEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SIDEBAR_WIDTH,
    width: 2.5,
    backgroundColor: ACCENT,
  },

  // ── Sidebar ────────────────────────────────────────────────────────
  sidebar: {
    width: SIDEBAR_WIDTH,
    paddingTop: 36,
    paddingBottom: 10,
    paddingLeft: 22,
    paddingRight: 18,
  },
  monogram: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  monogramText: {
    fontSize: 17,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  sidebarSection: { marginBottom: 18 },
  sidebarHeading: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: SIDEBAR_HEADING,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 9,
  },
  contactItem: { marginBottom: 7 },
  contactLabel: {
    fontSize: 6.4,
    fontWeight: 600,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: SIDEBAR_FAINT,
    marginBottom: 1.5,
  },
  contactValue: {
    fontSize: 8.2,
    lineHeight: 1.35,
    color: SIDEBAR_TEXT,
  },
  skillGroup: { marginBottom: 8 },
  skillCategory: {
    fontSize: 7.5,
    fontWeight: 600,
    color: '#cfc7ff',
    marginBottom: 5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 8,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    marginRight: 4,
    marginBottom: 4,
  },
  chipText: { fontSize: 7.8, color: '#ffffff' },
  sidebarListItem: { flexDirection: 'row', marginBottom: 4.5 },
  sidebarListDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ACCENT,
    marginTop: 3.8,
    marginRight: 6,
  },
  sidebarListText: {
    flex: 1,
    fontSize: 8.2,
    lineHeight: 1.4,
    color: SIDEBAR_TEXT,
  },

  // ── Main column ────────────────────────────────────────────────────
  main: {
    flex: 1,
    paddingTop: 38,
    paddingLeft: 28,
    paddingRight: 30,
  },
  name: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: -0.4,
    color: INK,
  },
  headline: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: ACCENT,
    marginTop: 5,
  },
  accentBar: {
    width: 44,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ACCENT,
    marginTop: 12,
  },
  section: { marginTop: 16 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: INDIGO,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(30, 27, 110, 0.14)',
    marginLeft: 8,
  },
  paragraph: {
    fontSize: 9.3,
    lineHeight: 1.55,
    color: BODY,
  },
  entry: { marginBottom: 11 },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  entryHeaderLeft: { flex: 1, paddingRight: 8 },
  entryTitle: {
    fontSize: 10.3,
    fontWeight: 600,
    color: INK,
  },
  entrySub: {
    fontSize: 8.6,
    fontWeight: 500,
    color: MUTED,
    marginTop: 1.5,
  },
  datePill: {
    backgroundColor: '#f0edfd',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginTop: 1,
  },
  datePillText: {
    fontSize: 8,
    fontWeight: 600,
    color: ACCENT_DEEP,
  },
  bulletRow: { flexDirection: 'row', marginTop: 3.5 },
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ACCENT,
    marginTop: 4.2,
    marginRight: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.1,
    lineHeight: 1.45,
    color: BODY,
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: SIDEBAR_WIDTH + 20,
    right: 30,
    textAlign: 'right',
    fontSize: 7.5,
    color: '#9b8ec4',
  },
})

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || 'CV'
}

/** Show URLs as clean handles: no protocol, no www, no trailing slash. */
function cleanUrl(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

/** A skills item that reads like prose rather than a skill name. */
function isSentenceLike(item: string): boolean {
  return item.length > 40 || item.trim().split(/\s+/).length > 5 || /[.!?]$/.test(item.trim())
}

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <View style={styles.sectionRule} />
    </View>
  )
}

/**
 * Groups a section heading with the first block of its content so a heading is
 * never orphaned at a page bottom, then lets the remaining blocks flow, each
 * one unbreakable. (minPresenceAhead proved a no-op in this layout - verified
 * against rendered output - so keep-together grouping is done with wrap={false}.)
 */
function EntrySection({ title, blocks }: { title: string; blocks: JSX.Element[] }) {
  if (blocks.length === 0) return null
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <SectionHeading title={title} />
        {blocks[0]}
      </View>
      {blocks.slice(1).map((block, i) => (
        <View key={i} wrap={false}>
          {block}
        </View>
      ))}
    </View>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

function ExperienceEntry({ entry }: { entry: StructuredCvExperience }) {
  const sub = [entry.company, entry.location].filter(Boolean).join('  ·  ')
  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader}>
        <View style={styles.entryHeaderLeft}>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          {sub ? <Text style={styles.entrySub}>{sub}</Text> : null}
        </View>
        {entry.dates ? (
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{entry.dates}</Text>
          </View>
        ) : null}
      </View>
      {entry.bullets.map((bullet, i) => (
        <Bullet key={i} text={bullet} />
      ))}
    </View>
  )
}

function ProjectEntry({ entry }: { entry: StructuredCvProject }) {
  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader}>
        <View style={styles.entryHeaderLeft}>
          <Text style={styles.entryTitle}>{entry.name}</Text>
        </View>
        {entry.dates ? (
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{entry.dates}</Text>
          </View>
        ) : null}
      </View>
      {entry.bullets.map((bullet, i) => (
        <Bullet key={i} text={bullet} />
      ))}
    </View>
  )
}

function EducationEntry({ entry }: { entry: StructuredCvEducation }) {
  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader}>
        <View style={styles.entryHeaderLeft}>
          <Text style={styles.entryTitle}>{entry.degree}</Text>
          {entry.institution ? <Text style={styles.entrySub}>{entry.institution}</Text> : null}
        </View>
        {entry.dates ? (
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{entry.dates}</Text>
          </View>
        ) : null}
      </View>
      {entry.details.map((detail, i) => (
        <Bullet key={i} text={detail} />
      ))}
    </View>
  )
}

interface ContactRow {
  label: string
  value: string
}

function contactRows(cv: StructuredCv): ContactRow[] {
  const { contact } = cv
  const rows: ContactRow[] = []
  if (contact.email) rows.push({ label: 'Email', value: contact.email })
  if (contact.phone) rows.push({ label: 'Phone', value: contact.phone })
  if (contact.location) rows.push({ label: 'Location', value: contact.location })
  if (contact.linkedin) rows.push({ label: 'LinkedIn', value: cleanUrl(contact.linkedin) })
  if (contact.github) rows.push({ label: 'GitHub', value: cleanUrl(contact.github) })
  if (contact.website) rows.push({ label: 'Website', value: cleanUrl(contact.website) })
  return rows
}

export default function CvPdfDocument({ cv }: { cv: StructuredCv }) {
  const contacts = contactRows(cv)

  return (
    <Document title={`${cv.name} - CV`} author={cv.name} creator="CareerLens">
      <Page size="A4" style={styles.page}>
        {/* Full-height brand band behind the sidebar, repeated on every page */}
        <View style={styles.sidebarBg} fixed />
        <View style={styles.sidebarEdge} fixed />

        <View style={styles.sidebar}>
          <View style={styles.monogram}>
            <Text style={styles.monogramText}>{initials(cv.name)}</Text>
          </View>

          {contacts.length > 0 && (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarHeading}>Contact</Text>
              {contacts.map((row) => (
                <View key={row.label} style={styles.contactItem}>
                  <Text style={styles.contactLabel}>{row.label}</Text>
                  <Text style={styles.contactValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          )}

          {cv.skills.length > 0 && (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarHeading}>Skills</Text>
              {cv.skills.map((group, i) => {
                // The improve flow appends full sentences ("Basic familiarity
                // with React in collaborative settings.") to the skills
                // section. Sentence-length items render as list rows - as
                // chips they balloon and bury the very additions the user
                // just made.
                const chips = group.items.filter((item) => !isSentenceLike(item))
                const sentences = group.items.filter(isSentenceLike)
                return (
                  <View key={i} style={styles.skillGroup}>
                    {group.category ? <Text style={styles.skillCategory}>{group.category}</Text> : null}
                    {chips.length > 0 && (
                      <View style={styles.chipRow}>
                        {chips.map((skill, j) => (
                          <View key={j} style={styles.chip}>
                            <Text style={styles.chipText}>{skill}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {sentences.map((sentence, j) => (
                      <View key={`s${j}`} style={styles.sidebarListItem}>
                        <View style={styles.sidebarListDot} />
                        <Text style={styles.sidebarListText}>{sentence}</Text>
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          )}

          {cv.languages.length > 0 && (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarHeading}>Languages</Text>
              {cv.languages.map((language, i) => (
                <View key={i} style={styles.sidebarListItem}>
                  <View style={styles.sidebarListDot} />
                  <Text style={styles.sidebarListText}>{language}</Text>
                </View>
              ))}
            </View>
          )}

          {cv.certifications.length > 0 && (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarHeading}>Certifications</Text>
              {cv.certifications.map((certification, i) => (
                <View key={i} style={styles.sidebarListItem}>
                  <View style={styles.sidebarListDot} />
                  <Text style={styles.sidebarListText}>{certification}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.main}>
          <Text style={styles.name}>{cv.name}</Text>
          {cv.headline ? <Text style={styles.headline}>{cv.headline}</Text> : null}
          <View style={styles.accentBar} />

          {cv.summary ? (
            <View style={styles.section} wrap={false}>
              <SectionHeading title="Profile" />
              <Text style={styles.paragraph}>{cv.summary}</Text>
            </View>
          ) : null}

          <EntrySection
            title="Experience"
            blocks={cv.experience.map((entry, i) => (
              <ExperienceEntry key={i} entry={entry} />
            ))}
          />

          <EntrySection
            title="Projects"
            blocks={cv.projects.map((entry, i) => (
              <ProjectEntry key={i} entry={entry} />
            ))}
          />

          <EntrySection
            title="Education"
            blocks={cv.education.map((entry, i) => (
              <EducationEntry key={i} entry={entry} />
            ))}
          />

          {cv.extras.map((extra, i) => (
            <EntrySection
              key={i}
              title={extra.label}
              blocks={extra.items.map((item, j) => (
                <Bullet key={j} text={item} />
              ))}
            />
          ))}
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${cv.name}  ·  ${pageNumber} / ${totalPages}` : ''
          }
        />
      </Page>
    </Document>
  )
}
