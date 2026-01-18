import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { TradingTerminal } from '@/pages/TradingTerminal'
import { PredictionMarket } from '@/pages/PredictionMarket'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { AccountProvider } from '@/contexts/AccountContext'
import { MarketStatusProvider } from '@/contexts/MarketStatusContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

// 使用 HashRouter 解决 GitHub Pages SPA 刷新404问题
// HashRouter uses # in URL, which works with static hosting
function App() {
  return (
    <ThemeProvider>
      <AccountProvider>
        <MarketStatusProvider>
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
        </MarketStatusProvider>
      </AccountProvider>
    </ThemeProvider>
  )
}

export default App
