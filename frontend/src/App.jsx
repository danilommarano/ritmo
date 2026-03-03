import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import LandingPage from './components/LandingPage'
import VideoLibrary from './pages/VideoLibrary'
import VideoPlayer from './pages/VideoPlayer'
import VideoUpload from './pages/VideoUpload'
import VideoEditor from './components/VideoEditor'
import AuthCallback from './pages/AuthCallback'
import PricingPage from './pages/PricingPage'
import BillingPage from './pages/BillingPage'
import BillingSuccess from './pages/BillingSuccess'
import BillingCancel from './pages/BillingCancel'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={
            <Layout>
              <VideoLibrary />
            </Layout>
          } />
          <Route path="/video/:id" element={
            <Layout>
              <VideoPlayer />
            </Layout>
          } />
          <Route path="/upload" element={
            <Layout>
              <VideoUpload />
            </Layout>
          } />
          {/* Video Editor - Full screen without Layout */}
          <Route path="/editor/:id" element={<VideoEditor />} />
          {/* Billing & Pricing */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/billing/cancel" element={<BillingCancel />} />
          {/* OAuth callback (opened in popup) */}
          <Route path="/auth/callback/:provider" element={<AuthCallback />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
