import { useNavigate } from 'react-router-dom'
import AppLogo from '../components/ui/AppLogo'
import './PersonalizationMock.css'

const INPUT_KEY = 'personalizationInput'

interface MockProfile {
  id: string
  label: string
  canonicalTitle: string
  detectedTitle: string
  cvText: string
  jobDescription: string
}

// canonicalTitle values match supported roles so both the personalize options call
// and the "standard results" fallback (POST /api/analyze) resolve a real job.
const PROFILES: MockProfile[] = [
  {
    id: 'swe',
    label: 'Software Engineer',
    canonicalTitle: 'Software Engineer',
    detectedTitle: 'Software Engineer',
    cvText:
      'Software Engineer with 5 years of experience building backend services in Python and Java. ' +
      'Designed REST APIs, worked with PostgreSQL and Redis, containerized services with Docker and ' +
      'deployed on Kubernetes. Strong in algorithms, debugging, CI/CD pipelines and microservices.',
    jobDescription:
      'We are hiring a Software Engineer to build scalable backend services. Requirements: Python, ' +
      'REST API design, relational databases, Docker, Kubernetes, CI/CD, and solid testing practices.',
  },
  {
    id: 'ds',
    label: 'Data Scientist',
    canonicalTitle: 'Data Scientist',
    detectedTitle: 'Data Scientist',
    cvText:
      'Data Scientist with experience in Python, SQL and machine learning. Built predictive models, ' +
      'feature engineering pipelines, and A/B testing frameworks. Familiar with deep learning, ' +
      'analytics, statistics and deploying models to production.',
    jobDescription:
      'Seeking a Data Scientist skilled in Python, SQL, machine learning, statistics and analytics. ' +
      'You will build predictive models, run experiments and deploy models with monitoring.',
  },
  {
    id: 'devops',
    label: 'DevOps Engineer',
    canonicalTitle: 'DevOps Engineer',
    detectedTitle: 'DevOps Engineer',
    cvText:
      'DevOps Engineer experienced with infrastructure as code using Terraform, Kubernetes, Docker, ' +
      'and Jenkins. Automated CI/CD pipelines, managed Linux servers, scripting in Bash and Python, ' +
      'and set up monitoring with Prometheus and Grafana.',
    jobDescription:
      'Looking for a DevOps Engineer with Kubernetes, Terraform, Docker, Jenkins, Linux, Bash and ' +
      'cloud experience. Responsibilities include CI/CD automation, monitoring and incident response.',
  },
  {
    id: 'frontend',
    label: 'Frontend Developer',
    canonicalTitle: 'Frontend Developer',
    detectedTitle: 'Frontend Developer',
    cvText:
      'Frontend Developer specializing in React, TypeScript and JavaScript. Built responsive web ' +
      'applications, component libraries, and worked closely with designers using Figma. Experienced ' +
      'with state management, CSS, accessibility and end-to-end testing.',
    jobDescription:
      'We need a Frontend Developer proficient in React, TypeScript, JavaScript and CSS. You will ' +
      'build responsive UIs, collaborate with design, and ensure quality with automated UI testing.',
  },
]

export default function PersonalizationMock() {
  const navigate = useNavigate()

  function openProfile(profile: MockProfile) {
    sessionStorage.setItem(
      INPUT_KEY,
      JSON.stringify({
        canonicalTitle: profile.canonicalTitle,
        detectedTitle: profile.detectedTitle,
        cvText: profile.cvText,
        cvFileName: `mock-${profile.id}.pdf`,
        jobDescription: profile.jobDescription,
        isPostingMode: true,
      })
    )
    navigate('/personalize')
  }

  return (
    <div className="mock-screen">
      <div className="mock-card">
        <header className="mock-header">
          <AppLogo />
          <span className="mock-badge">QA · Mock</span>
          <h1 className="mock-title">Personalization mock profiles</h1>
          <p className="mock-sub">
            Pick a sample profile to open the Personalization screen with seeded data. No CV upload
            needed. It calls the real backend, so you see real role skills and the live 501 fallback.
          </p>
        </header>

        <div className="mock-grid">
          {PROFILES.map((p) => (
            <div className="mock-profile" key={p.id}>
              <div className="mock-profile-head">
                <span className="mock-profile-title">{p.label}</span>
                <span className="mock-profile-tag">{p.canonicalTitle}</span>
              </div>
              <p className="mock-profile-cv">{p.cvText.slice(0, 120)}…</p>
              <button type="button" className="mock-open-btn" onClick={() => openProfile(p)}>
                Open personalization →
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="mock-back" onClick={() => navigate('/')}>
          Back to home
        </button>
      </div>
    </div>
  )
}
