import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import UploadScreen from './pages/UploadScreen'
import ExtractPage from './pages/ExtractPage' 
import SkillsMatchDashboard from './pages/SkillsMatchDashboard'
import SkillDetails from './pages/SkillDetails'
import CVOptimization from './pages/CVOptimization'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/upload" replace />} />
            <Route path="/upload" element={<UploadScreen />} />
            <Route path="/extract" element={<ExtractPage />} />
            <Route path="/dashboard" element={<SkillsMatchDashboard />} />
            <Route path="/skill-details" element={<SkillDetails />} />
            <Route path="/optimization" element={<CVOptimization />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
