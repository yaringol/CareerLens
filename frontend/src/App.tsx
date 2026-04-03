import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import UploadScreen from './pages/UploadScreen'
import SkillsMatchDashboard from './pages/SkillsMatchDashboard'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<UploadScreen />} />
            <Route path="/dashboard" element={<SkillsMatchDashboard />} />
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
