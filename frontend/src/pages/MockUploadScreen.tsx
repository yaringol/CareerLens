import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from '../components/ui/AppLogo'
import './UploadScreen.css'

const INPUT_KEY = 'pocPersonalizationInput'

interface MockProfile {
  canonicalTitle: string
  cvText: string
  jobDescription: string
}

// canonicalTitle values match the POC jobs so the standard fallback (POST /api/analyze) resolves too.
const PROFILES: Record<string, MockProfile> = {
  'Software Engineer': {
    canonicalTitle: 'Software Engineer',
    cvText:
      'Software Engineer with 5 years of experience building backend services in Python and Java. ' +
      'Designed REST APIs, worked with PostgreSQL and Redis, containerized services with Docker and ' +
      'deployed on Kubernetes. Strong in algorithms, debugging, CI/CD pipelines and microservices.',
    jobDescription:
      'We are hiring a Software Engineer to build scalable backend services. Requirements: Python, ' +
      'REST API design, relational databases, Docker, Kubernetes, CI/CD, and solid testing practices.',
  },
  'Data Scientist': {
    canonicalTitle: 'Data Scientist',
    cvText:
      'Data Scientist with experience in Python, SQL and machine learning. Built predictive models, ' +
      'feature engineering pipelines, and A/B testing frameworks. Familiar with deep learning, ' +
      'analytics, statistics and deploying models to production.',
    jobDescription:
      'Seeking a Data Scientist skilled in Python, SQL, machine learning, statistics and analytics. ' +
      'You will build predictive models, run experiments and deploy models with monitoring.',
  },
  'DevOps Engineer': {
    canonicalTitle: 'DevOps Engineer',
    cvText:
      'DevOps Engineer experienced with infrastructure as code using Terraform, Kubernetes, Docker, ' +
      'and Jenkins. Automated CI/CD pipelines, managed Linux servers, scripting in Bash and Python, ' +
      'and set up monitoring with Prometheus and Grafana.',
    jobDescription:
      'Looking for a DevOps Engineer with Kubernetes, Terraform, Docker, Jenkins, Linux, Bash and ' +
      'cloud experience. Responsibilities include CI/CD automation, monitoring and incident response.',
  },
  'Frontend Developer': {
    canonicalTitle: 'Frontend Developer',
    cvText:
      'Frontend Developer specializing in React, TypeScript and JavaScript. Built responsive web ' +
      'applications, component libraries, and worked closely with designers using Figma. Experienced ' +
      'with state management, CSS, accessibility and end-to-end testing.',
    jobDescription:
      'We need a Frontend Developer proficient in React, TypeScript, JavaScript and CSS. You will ' +
      'build responsive UIs, collaborate with design, and ensure quality with automated UI testing.',
  },
}

const ROLES = Object.keys(PROFILES)

export default function MockUploadScreen() {
  const navigate = useNavigate()
  const [role, setRole] = useState(ROLES[0])
  const [jobDescription, setJobDescription] = useState(PROFILES[ROLES[0]].jobDescription)

  function changeRole(next: string) {
    setRole(next)
    setJobDescription(PROFILES[next].jobDescription)
  }

  function goToPersonalize() {
    const profile = PROFILES[role]
    sessionStorage.setItem(
      INPUT_KEY,
      JSON.stringify({
        canonicalTitle: profile.canonicalTitle,
        detectedTitle: role,
        cvText: profile.cvText,
        cvFileName: `mock-${role.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        jobDescription: jobDescription.trim(),
        isPostingMode: true,
      })
    )
    navigate('/personalize')
  }

  return (
    <section className="upload-section upload-section--visible">
      <div className="upload-wrapper">
        <div className="upload-app-header">
          <div className="upload-app-nav">
            <Link to="/" className="btn-nav-pill">Home</Link>
            <span className="btn-nav-pill" style={{ background: 'var(--color-warning)', color: '#fff' }}>QA · Mock</span>
          </div>
          <div className="step-indicator">
            <div className="step step--active">
              <div className="step-dot">1</div>
              <span className="step-label">Upload</span>
            </div>
            <div className="step-line" />
            <div className="step">
              <div className="step-dot">2</div>
              <span className="step-label">Personalize</span>
            </div>
            <div className="step-line" />
            <div className="step">
              <div className="step-dot">3</div>
              <span className="step-label">Results</span>
            </div>
            <div className="step-line" />
            <div className="step">
              <div className="step-dot">4</div>
              <span className="step-label">Improve</span>
            </div>
          </div>
          <AppLogo size="sm" />
        </div>

        <form
          className="upload-card"
          onSubmit={(e) => {
            e.preventDefault()
            goToPersonalize()
          }}
        >
          <div className="upload-columns">
            <div className="upload-col">
              <div className="col-header">
                <h2>Resume</h2>
              </div>
              <div className="dropzone dropzone--selected">
                <div className="dropzone-check">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <p className="dropzone-filename">mock-{role.toLowerCase().replace(/\s+/g, '-')}.pdf</p>
                <p className="dropzone-meta">Sample CV &middot; PDF</p>
              </div>
              <p className="cta-hint" style={{ marginTop: '0.75rem' }}>
                Detected role: <strong>{role}</strong>
              </p>
              <label
                htmlFor="mock-role"
                style={{ display: 'block', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}
              >
                Switch sample role
              </label>
              <select
                id="mock-role"
                className="field-input"
                value={role}
                onChange={(e) => changeRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="upload-col">
              <div className="col-header">
                <h2>Job description</h2>
              </div>
              <textarea
                className="field-textarea"
                rows={9}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="upload-cta">
            <button type="submit" className="btn-primary">
              <span>Personalize</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
