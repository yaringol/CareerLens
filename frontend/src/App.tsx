import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SkillsMatchDashboard from './pages/SkillsMatchDashboard'
import ErrorBoundary from './components/ui/ErrorBoundary'
import SplashScreen from './components/ui/SplashScreen'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  const handleSplashDone = () => setShowSplash(false)

  return (
    <ErrorBoundary>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="app">
          <main className="app-main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<Navigate to="/" replace />} />
              <Route path="/dashboard" element={<SkillsMatchDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
