import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'var(--color-bg)',
        padding: '2rem',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <img src="/logo.png" alt="Career Lens" style={{ height: 40 }} />
        <p style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.125rem' }}>
          Something went wrong
        </p>
        <p style={{ color: 'var(--color-secondary)', fontSize: '0.875rem', maxWidth: 360, textAlign: 'center' }}>
          {this.state.error.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '0.625rem 1.5rem',
            background: 'var(--gradient-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-input)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

export default ErrorBoundary
