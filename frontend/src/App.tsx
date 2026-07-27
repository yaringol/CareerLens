import { lazy, Suspense, useState } from 'react'
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
import ImproveCVScreen from './pages/ImproveCVScreen'
import UploadPage from './pages/UploadPage'
import PersonalizationScreen from './pages/PersonalizationScreen'
// QA mock screens: dev-only. import.meta.env.DEV is statically false in the
// production build, so these lazy chunks are never emitted and the routes below
// are never registered - /mock and friends fall through to the catch-all.
const PersonalizationMock = import.meta.env.DEV
  ? lazy(() => import('./pages/PersonalizationMock'))
  : null
const MockUploadScreen = import.meta.env.DEV
  ? lazy(() => import('./pages/MockUploadScreen'))
  : null
const MockHub = import.meta.env.DEV ? lazy(() => import('./pages/MockHub')) : null
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
                      path="/personalize"
                      element={
                        <RequireAuth>
                          <PersonalizationScreen />
                        </RequireAuth>
                      }
                    />
                    {PersonalizationMock && (
                      <Route
                        path="/personalize-mock"
                        element={
                          <RequireAuth>
                            <Suspense fallback={null}>
                              <PersonalizationMock />
                            </Suspense>
                          </RequireAuth>
                        }
                      />
                    )}
                    {MockUploadScreen && (
                      <Route
                        path="/upload-mock"
                        element={
                          <RequireAuth>
                            <Suspense fallback={null}>
                              <MockUploadScreen />
                            </Suspense>
                          </RequireAuth>
                        }
                      />
                    )}
                    {MockHub && (
                      <Route
                        path="/mock"
                        element={
                          <RequireAuth>
                            <Suspense fallback={null}>
                              <MockHub />
                            </Suspense>
                          </RequireAuth>
                        }
                      />
                    )}
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
                    <Route
                      path="/improve"
                      element={
                        <RequireAuth>
                          <ImproveCVScreen />
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
