import { useNavigate } from 'react-router-dom'
import AppLogo from '../components/ui/AppLogo'
import './PersonalizationMock.css'

const INPUT_KEY = 'pocPersonalizationInput'

// Seed used so step 2 (Personalize) opens the REAL screen with data, no upload needed.
const PERSONALIZE_SEED = {
  canonicalTitle: 'Software Engineer',
  detectedTitle: 'Software Engineer',
  cvText:
    'Software Engineer with 5 years of experience building backend services in Python and Java. ' +
    'Designed REST APIs, worked with PostgreSQL and Redis, containerized services with Docker and ' +
    'deployed on Kubernetes. Strong in algorithms, debugging, CI/CD pipelines and microservices.',
  cvFileName: 'mock-software-engineer.pdf',
  jobDescription:
    'We are hiring a Software Engineer to build scalable backend services. Requirements: Python, ' +
    'REST API design, relational databases, Docker, Kubernetes, CI/CD, and solid testing practices.',
  isPostingMode: true,
}

interface StepCard {
  step: string
  label: string
  desc: string
  cta: string
  open: (go: ReturnType<typeof useNavigate>) => void
}

const STEPS: StepCard[] = [
  {
    step: '1',
    label: 'Upload',
    desc: 'A mock of the upload screen with a pre-selected CV and the "Personalize" button.',
    cta: 'Open upload mock →',
    open: (go) => go('/upload-mock'),
  },
  {
    step: '2',
    label: 'Personalize',
    desc: 'The real Personalization screen, seeded with a Software Engineer profile (presets, sliders, focus skills).',
    cta: 'Open personalize →',
    open: (go) => {
      sessionStorage.setItem(INPUT_KEY, JSON.stringify(PERSONALIZE_SEED))
      go('/personalize')
    },
  },
  {
    step: '3',
    label: 'Results',
    desc: 'The real Results dashboard with mock scores (strong match), including the step indicator.',
    cta: 'Open results →',
    open: (go) => go('/dashboard?mock=strong'),
  },
  {
    step: '4',
    label: 'Improve',
    desc: 'The real Improve CV wizard with a mock DevOps analysis.',
    cta: 'Open improve →',
    open: (go) => go('/improve?mock=devops'),
  },
]

export default function MockHub() {
  const navigate = useNavigate()

  return (
    <div className="mock-screen">
      <div className="mock-card">
        <header className="mock-header">
          <AppLogo />
          <span className="mock-badge">QA · Mock hub</span>
          <h1 className="mock-title">Flow mock pages</h1>
          <p className="mock-sub">
            Jump to any step of the flow with seeded data — no real CV upload needed. Each opens the
            real screen so you can see how it looks as part of the full flow.
          </p>
        </header>

        <div className="mock-grid">
          {STEPS.map((s) => (
            <div className="mock-profile" key={s.step}>
              <div className="mock-profile-head">
                <span className="mock-profile-title">
                  {s.step} · {s.label}
                </span>
              </div>
              <p className="mock-profile-cv">{s.desc}</p>
              <button type="button" className="mock-open-btn" onClick={() => s.open(navigate)}>
                {s.cta}
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="mock-back" onClick={() => navigate('/personalize-mock')}>
          Personalize profiles (4 roles) →
        </button>
      </div>
    </div>
  )
}
