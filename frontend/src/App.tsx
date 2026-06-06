import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import './contexts/Toast.css'
import RequireAuth from './components/RequireAuth'
import HomePage from './pages/HomePage'
import SkillsMatchDashboard from './pages/SkillsMatchDashboard'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import AccountPage from './pages/AccountPage'
import UploadPage from './pages/UploadPage'
import ErrorBoundary from './components/ui/ErrorBoundary'
import ErrorToast from './components/ui/ErrorToast'
import SplashScreen from './components/ui/SplashScreen'
import { ErrorProvider } from './context/ErrorContext'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  const handleSplashDone = () => setShowSplash(false)

  return (
    <AuthProvider>
      <ToastProvider>
        <ErrorProvider>
          {showSplash && <SplashScreen onDone={handleSplashDone} />}
          <ErrorToast />
          <ErrorBoundary>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <div className="app">
                <main className="app-main">
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                      path="/"
                      element={
                        <RequireAuth>
                          <HomePage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/upload"
                      element={
                        <RequireAuth>
                          <UploadPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <RequireAuth>
                          <SkillsMatchDashboard />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <RequireAuth role="admin">
                          <AdminPage />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/account"
                      element={
                        <RequireAuth>
                          <AccountPage />
                        </RequireAuth>
                      }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </BrowserRouter>
          </ErrorBoundary>
        </ErrorProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
