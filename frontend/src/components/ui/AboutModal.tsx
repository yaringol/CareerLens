import { useState } from 'react'
import Modal from './Modal'

/** Which explanation the trigger opens. One topic per screen, not one long page. */
export type AboutTopic = 'role-detection' | 'recommendations'

const CONTENT: Record<AboutTopic, { title: string; body: React.ReactNode }> = {
  'role-detection': {
    title: 'How we detect your role',
    body: (
      <>
        <p>
          CareerLens supports 59 roles. To pick yours we make up to three attempts, from
          cheapest to smartest, and stop at the first one that answers confidently.
        </p>
        <dl>
          <dt>1. The title you wrote</dt>
          <dd>We read the job title from the top of your CV and match it to the closest supported role.</dd>
          <dt>2. Your whole CV</dt>
          <dd>If no title is stated, a classifier reads the body of the CV and infers the role from its content.</dd>
          <dt>3. A final AI pass</dt>
          <dd>If neither is confident, an AI model picks the best fit from the same list of 59 roles.</dd>
        </dl>
        <h3>What the percentage means</h3>
        <p>
          It is how sure we are about the <strong>role</strong> — not how well your CV matches a
          job. Above 60% we select the role for you; below that we ask you to choose, because a
          low number usually means the CV genuinely fits more than one role.
        </p>
        <h3>If your role is not listed</h3>
        <p>
          Some roles are outside what the model was trained on. Rather than guess, we say so and
          let you pick the closest supported role manually — your analysis then runs against that
          role's skills.
        </p>
      </>
    ),
  },
  recommendations: {
    title: 'How recommendations are chosen',
    body: (
      <>
        <p>
          Your results are built from 10 skills: 5 <strong>Core Skills</strong> that the market
          expects for your role, and 5 <strong>Dynamic Skills</strong> taken from the specific job
          posting you provided. This screen lets you steer both halves.
        </p>
        <h3>Recommendation Balance</h3>
        <p>
          The Core Skills come from job postings we collect continuously. The balance decides which
          of those postings count for more.
        </p>
        <dl>
          <dt>Stable</dt>
          <dd>Favors skills that have stayed in demand over a long period. Safest for a CV you will reuse.</dd>
          <dt>Balanced</dt>
          <dd>An even mix of the three factors below. This is the default and a sensible starting point.</dd>
          <dt>Trending</dt>
          <dd>Leans toward skills rising in recent postings. Useful for fast-moving fields.</dd>
          <dt>Custom</dt>
          <dd>You set the three weights yourself with the sliders.</dd>
        </dl>
        <p>
          The three weights are <strong>Stable</strong> (long-term demand), <strong>Trending</strong>{' '}
          (recent momentum) and <strong>Personal Match</strong> (how closely a skill fits your CV and
          role). They always add up to 100.
        </p>
        <h3>Choosing 5 Dynamic Skills</h3>
        <p>
          We extract up to 10 skills from the job posting and you pick the 5 to focus on. Only those
          appear in your results, so choose the ones the role really turns on.
        </p>
        <p>This step is optional — skipping it runs the analysis with our standard selection.</p>
      </>
    ),
  },
}

interface AboutButtonProps {
  topic: AboutTopic
  /** Visible label next to the "?" mark. Defaults to "About". */
  label?: string
  className?: string
}

/** The "?" trigger plus the modal it opens, so a screen only adds one element. */
export default function AboutButton({ topic, label = 'About', className }: AboutButtonProps) {
  const [open, setOpen] = useState(false)
  const { title, body } = CONTENT[topic]

  return (
    <>
      <button
        type="button"
        className={`about-trigger${className ? ` ${className}` : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="about-trigger-mark" aria-hidden="true">?</span>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {body}
      </Modal>
    </>
  )
}
