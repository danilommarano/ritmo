import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import VideoLibrary from './pages/VideoLibrary'
import VideoPlayer from './pages/VideoPlayer'
import VideoUpload from './pages/VideoUpload'
import RhythmEditor from './pages/RhythmEditor'
import './App.css'

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        <Routes>
          <Route path="/" element={<VideoLibrary />} />
          <Route path="/video/:id" element={<VideoPlayer />} />
          <Route path="/upload" element={<VideoUpload />} />
          <Route path="/editor/:id" element={<RhythmEditor />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
