import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LandingPage from './components/LandingPage'
import VideoLibrary from './pages/VideoLibrary'
import VideoPlayer from './pages/VideoPlayer'
import VideoUpload from './pages/VideoUpload'
import VideoEditor from './components/VideoEditor'
import './App.css'

function App() {
  return (
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
      </Routes>
    </Router>
  )
}

export default App
