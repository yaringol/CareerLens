import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getMyCVs, deleteCv, changePassword, type SavedCv } from '../services/api'
import './AccountPage.css'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Tab = 'cvs' | 'security'

const AccountPage = () => {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('cvs')

  // CV library
  const [cvs, setCvs] = useState<SavedCv[]>([])
  const [cvsLoading, setCvsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  useEffect(() => {
    getMyCVs()
      .then(setCvs)
      .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load CVs'))
      .finally(() => setCvsLoading(false))
  }, [showToast])

  async function handleDeleteCv(cvId: string) {
    if (!confirm('Delete this CV from your library?')) return
    setDeletingId(cvId)
    try {
      await deleteCv(cvId)
      setCvs((prev) => prev.filter((c) => c.cvId !== cvId))
      showToast('CV deleted', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete CV')
    } finally {
      setDeletingId(null)
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
      showToast(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <Link to="/" className="account-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </Link>
        <div className="account-header-info">
          <div className="account-avatar">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
          <div>
            <p className="account-email">{user?.email}</p>
            <p className="account-role">{user?.role}</p>
          </div>
        </div>
        <button className="account-logout" onClick={() => { logout(); navigate('/login') }}>Sign out</button>
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
            <p className="account-section-sub">CVs you've saved while analyzing. Select one on the home page to re-use without re-uploading.</p>

            {cvsLoading ? (
              <p className="account-empty">Loading…</p>
            ) : cvs.length === 0 ? (
              <p className="account-empty">No CVs saved yet. Upload a CV with "Save to library" enabled.</p>
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
