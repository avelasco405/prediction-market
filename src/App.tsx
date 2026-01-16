import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { TradingTerminal } from '@/pages/TradingTerminal'
import { PredictionMarket } from '@/pages/PredictionMarket'
import { AdminDashboard } from '@/pages/AdminDashboard'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0a]">
        <Routes>
          <Route path="/" element={<TradingTerminal />} />
          <Route path="/prediction" element={<PredictionMarket />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
