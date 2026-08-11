import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  getMyCVs, deleteCv, changePassword, setCvFavorite,
  getImprovementSession, getImprovementSessions, deleteImprovementSession,
  type SavedCv, type ImprovementSession,
} from '../services/api'
import FavoriteStarButton from '../components/cv/FavoriteStarButton'
import AppLogo from '../components/ui/AppLogo'
import AdminNavLink from '../components/admin/AdminNavLink'
import './AccountPage.css'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Tab = 'cvs' | 'plans' | 'security'

const AccountPage = () => {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('cvs')

  // CV library
  const [cvs, setCvs] = useState<SavedCv[]>([])
  const [cvsLoading, setCvsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [favoritingId, setFavoritingId] = useState<string | null>(null)

  // Improvement Plans
  const [plans, setPlans] = useState<ImprovementSession[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  useEffect(() => {
    getMyCVs()
      .then(setCvs)
      .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load your CVs. Please try again.'))
      .finally(() => setCvsLoading(false))

    getImprovementSessions()
      .then((sessions) => setPlans(sessions.filter((session) => session.hasFinalCvText !== false)))
      .catch(() => {/* non-critical */})
      .finally(() => setPlansLoading(false))
  }, [showToast])

  async function handleDeleteCv(cvId: string) {
    if (!confirm('Delete this CV from your library?')) return
    setDeletingId(cvId)
    try {
      await deleteCv(cvId)
      setCvs((prev) => prev.filter((c) => c.cvId !== cvId))
      showToast('CV deleted', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete this CV. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleFavorite(cv: SavedCv) {
    setFavoritingId(cv.cvId)
    try {
      const next = !cv.isFavorite
      await setCvFavorite(cv.cvId, next)
      setCvs((prev) =>
        prev.map((item) => (item.cvId === cv.cvId ? { ...item, isFavorite: next } : item)),
      )
      showToast(next ? 'Added to favorites' : 'Removed from favorites', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update this favorite. Please try again.')
    } finally {
      setFavoritingId(null)
    }
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Delete this improvement plan?')) return
    setDeletingPlanId(id)
    try {
      await deleteImprovementSession(id)
      setPlans((prev) => prev.filter((p) => p.id !== id))
      showToast('Plan deleted', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete this plan. Please try again.')
    } finally {
      setDeletingPlanId(null)
    }
  }

  async function handleDownloadPlan(id: string) {
    try {
      const session = await getImprovementSession(id)
      const fileBase = session.displayName
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
      const blob = new Blob([session.finalCvText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileBase || 'cv_improvement'}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not download this plan. Please try again.')
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match')
      return
    }
    if (newPassword.length < 4) {
      showToast('New password must be at least 4 characters')
      return
    }
    setPwdLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast('Password changed successfully', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Password change failed. Please try again.')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <div className="account-header-left">
          <Link to="/" className="account-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </Link>
          <div className="account-header-info">
            <div className="account-avatar">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
            <div>
              <p className="account-email">{user?.email}</p>
              <p className="account-role">{user?.role}</p>
            </div>
          </div>
        </div>
        <div className="account-header-right">
          <AdminNavLink className="account-admin-link" />
          <button className="account-logout" onClick={() => { logout(); navigate('/login') }}>Sign out</button>
          <AppLogo size="sm" />
        </div>
      </header>

      <div className="account-body">
        <nav className="account-tabs">
          <button
            className={`account-tab${tab === 'cvs' ? ' account-tab--active' : ''}`}
            onClick={() => setTab('cvs')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            CV Library
            {cvs.length > 0 && <span className="account-badge">{cvs.length}</span>}
          </button>
          <button
            className={`account-tab${tab === 'plans' ? ' account-tab--active' : ''}`}
            onClick={() => setTab('plans')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Improvement Plans
            {plans.length > 0 && <span className="account-badge">{plans.length}</span>}
          </button>
          <button
            className={`account-tab${tab === 'security' ? ' account-tab--active' : ''}`}
            onClick={() => setTab('security')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Security
          </button>
        </nav>

        {tab === 'cvs' && (
          <section className="account-section">
            <h2 className="account-section-title">My CV Library</h2>
            <p className="account-section-sub">CVs you've saved while analyzing. Star up to 3 favorites and we'll compare them automatically on your next analysis.</p>

            {cvsLoading ? (
              <p className="account-empty">Loading…</p>
            ) : cvs.length === 0 ? (
              <p className="account-empty">No CVs saved yet. Upload a CV with "Save to my CV library" enabled.</p>
            ) : (
              <ul className="account-cv-list">
                {cvs.map((cv) => (
                  <li key={cv.cvId} className="account-cv-item">
                    <div className="account-cv-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="account-cv-info">
                      <p className="account-cv-name">{cv.fileName}</p>
                      <p className="account-cv-meta">{formatFileSize(cv.fileSizeBytes)} · {formatDate(cv.uploadedAt)}</p>
                    </div>
                    <FavoriteStarButton
                      isFavorite={cv.isFavorite}
                      disabled={favoritingId === cv.cvId}
                      onToggle={() => handleToggleFavorite(cv)}
                    />
                    <button
                      className="account-cv-delete"
                      onClick={() => handleDeleteCv(cv.cvId)}
                      disabled={deletingId === cv.cvId}
                      title="Delete CV"
                    >
                      {deletingId === cv.cvId ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'plans' && (
          <section className="account-section">
            <h2 className="account-section-title">Improvement Plans</h2>
            <p className="account-section-sub">Improvement plans based on your analysis results.</p>

            {plansLoading ? (
              <p className="account-empty">Loading…</p>
            ) : plans.length === 0 ? (
              <p className="account-empty">No improvement plans yet. Analyze a CV and click "Improve your CV" to get started.</p>
            ) : (
              <ul className="account-cv-list">
                {plans.map((plan) => (
                  <li key={plan.id} className="account-cv-item">
                    <div className="account-cv-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </div>
                    <div className="account-cv-info">
                      <p className="account-cv-name">{plan.displayName}</p>
                      <p className="account-cv-meta">
                        {plan.skillCount} skill{plan.skillCount !== 1 ? 's' : ''} improved · {formatDate(plan.createdAt)}
                      </p>
                    </div>
                    <div className="account-plan-actions">
                      <button
                        className="account-plan-action"
                        onClick={() => handleDownloadPlan(plan.id)}
                        title="Download final CV"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                      <button
                        className="account-cv-delete"
                        onClick={() => handleDeletePlan(plan.id)}
                        disabled={deletingPlanId === plan.id}
                        title="Delete plan"
                      >
                        {deletingPlanId === plan.id ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'security' && (
          <section className="account-section">
            <h2 className="account-section-title">Change Password</h2>
            <p className="account-section-sub">Choose a new password for your account.</p>

            <form className="pwd-form" onSubmit={handleChangePassword}>
              <div className="pwd-field">
                <label className="pwd-label">Current password</label>
                <input
                  type="password"
                  className="pwd-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={pwdLoading}
                  required
                />
              </div>
              <div className="pwd-field">
                <label className="pwd-label">New password</label>
                <input
                  type="password"
                  className="pwd-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={pwdLoading}
                  required
                />
              </div>
              <div className="pwd-field">
                <label className="pwd-label">Confirm new password</label>
                <input
                  type="password"
                  className="pwd-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={pwdLoading}
                  required
                />
              </div>

              <button type="submit" className="pwd-submit" disabled={pwdLoading || !currentPassword || !newPassword || !confirmPassword}>
                {pwdLoading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  )
}

export default AccountPage
