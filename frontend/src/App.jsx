import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import VideoLibrary from './pages/VideoLibrary'
import VideoPlayer from './pages/VideoPlayer'
import './App.css'

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        <Routes>
          <Route path="/" element={<VideoLibrary />} />
          <Route path="/video/:id" element={<VideoPlayer />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
