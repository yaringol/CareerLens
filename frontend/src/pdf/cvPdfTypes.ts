/**
 * The typed layout contract between the backend structuring agent and the PDF
 * template. Keep in sync with backend/src/agents/cvStructure.agent.ts.
 */

export interface StructuredCvContact {
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  github?: string
  website?: string
}

export interface StructuredCvExperience {
  title: string
  company?: string
  location?: string
  dates?: string
  bullets: string[]
}

export interface StructuredCvEducation {
  degree: string
  institution?: string
  dates?: string
  details: string[]
}

export interface StructuredCvProject {
  name: string
  dates?: string
  bullets: string[]
}

export interface StructuredCvSkillGroup {
  category?: string
  items: string[]
}

export interface StructuredCvExtraSection {
  label: string
  items: string[]
}

export interface StructuredCv {
  name: string
  headline?: string
  contact: StructuredCvContact
  summary?: string
  skills: StructuredCvSkillGroup[]
  experience: StructuredCvExperience[]
  education: StructuredCvEducation[]
  projects: StructuredCvProject[]
  certifications: string[]
  languages: string[]
  extras: StructuredCvExtraSection[]
}
