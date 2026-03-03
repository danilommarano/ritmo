import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Music, Clock, Send, CheckCircle2, AlertCircle,
  FileVideo, MessageSquare, Upload, ChevronRight, Eye,
  CalendarDays, BookOpen, Star,
} from 'lucide-react'

export default function AssignmentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, authFetch } = useAuth()
  const [assignment, setAssignment] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        authFetch(`/api/classroom/assignments/${id}/`),
        authFetch(`/api/classroom/assignments/${id}/submissions/`),
      ])
      if (aRes.ok) setAssignment(await aRes.json())
      if (sRes.ok) setSubmissions(await sRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id, authFetch])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Atividade não encontrada
      </div>
    )
  }

  const isTeacher = assignment.teacher?.id === user?.id
  const mySubmission = assignment.my_submission

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-2 transition">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{assignment.title}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                {assignment.focus_bar_start != null && (
                  <span className="flex items-center gap-1"><Music className="w-3.5 h-3.5" />Compassos {assignment.focus_bar_start}–{assignment.focus_bar_end}</span>
                )}
                {assignment.target_bpm && <span>{assignment.target_bpm} BPM</span>}
                {assignment.due_date && (
                  <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Até {new Date(assignment.due_date).toLocaleDateString('pt-BR')}</span>
                )}
              </div>
            </div>
            {!isTeacher && (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                {mySubmission ? 'Reenviar' : 'Enviar Vídeo'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Description & Instructions */}
        {(assignment.description || assignment.instructions) && (
          <div className="mb-8 space-y-4">
            {assignment.description && (
              <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/50">
                <h3 className="text-sm font-medium text-gray-400 mb-1">Descrição</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{assignment.description}</p>
              </div>
            )}
            {assignment.instructions && (
              <div className="p-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
                <h3 className="text-sm font-medium text-indigo-400 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> Instruções
                </h3>
                <p className="text-gray-300 whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Reference Video */}
        {assignment.reference_video && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Vídeo de Referência</h3>
            <button
              onClick={() => navigate(`/editor/${assignment.reference_video}`)}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-800 hover:border-indigo-500/50 bg-gray-900/50 transition w-full text-left"
            >
              <FileVideo className="w-8 h-8 text-indigo-400" />
              <div className="flex-1">
                <div className="font-medium text-sm">{assignment.reference_video_title || 'Vídeo de referência'}</div>
                <div className="text-xs text-gray-500">Clique para abrir no editor</div>
              </div>
              <Eye className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        {/* Submissions */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileVideo className="w-5 h-5 text-gray-400" />
            {isTeacher ? 'Envios dos Alunos' : 'Meus Envios'}
            <span className="text-sm text-gray-500 font-normal">({submissions.length})</span>
          </h2>

          {submissions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileVideo className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>{isTeacher ? 'Nenhum aluno enviou ainda.' : 'Você ainda não enviou nenhum vídeo.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(s => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  isTeacher={isTeacher}
                  onClick={() => navigate(`/submission/${s.id}/review`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Submit Modal */}
      {showSubmitModal && (
        <SubmitVideoModal
          assignmentId={id}
          authFetch={authFetch}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={() => { setShowSubmitModal(false); fetchData() }}
        />
      )}
    </div>
  )
}

function SubmissionCard({ submission, isTeacher, onClick }) {
  const s = submission
  const statusConfig = {
    submitted: { color: 'text-blue-400 bg-blue-500/10', icon: Send, label: 'Enviado' },
    in_review: { color: 'text-amber-400 bg-amber-500/10', icon: Eye, label: 'Em Revisão' },
    approved: { color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle2, label: 'Aprovado' },
    needs_work: { color: 'text-amber-400 bg-amber-500/10', icon: AlertCircle, label: 'Precisa Melhorar' },
    rejected: { color: 'text-red-400 bg-red-500/10', icon: AlertCircle, label: 'Rejeitado' },
  }
  const sc = statusConfig[s.status] || statusConfig.submitted

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/50 cursor-pointer group transition"
    >
      <FileVideo className="w-10 h-10 text-gray-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isTeacher && <span className="font-medium text-sm">{s.student?.full_name}</span>}
          <span className="text-xs text-gray-500">#{s.attempt_number}</span>
        </div>
        <div className="text-sm text-gray-400 truncate">{s.video_title}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>{new Date(s.submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {s.video_duration && <span>{Math.round(s.video_duration)}s</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${sc.color}`}>
          <sc.icon className="w-3.5 h-3.5" /> {sc.label}
        </span>
        {s.has_feedback && (
          <MessageSquare className="w-4 h-4 text-indigo-400" title="Tem feedback" />
        )}
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition" />
      </div>
    </div>
  )
}

function SubmitVideoModal({ assignmentId, authFetch, onClose, onSubmitted }) {
  const [videos, setVideos] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingVideos, setLoadingVideos] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/videos/videos/')
        if (res.ok) {
          const data = await res.json()
          setVideos(data.results || data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingVideos(false)
      }
    })()
  }, [authFetch])

  const handleSubmit = async () => {
    if (!selectedVideo) { setError('Selecione um vídeo'); return }
    setSaving(true)
    try {
      const res = await authFetch('/api/classroom/submissions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment: assignmentId, video: selectedVideo, student_notes: notes }),
      })
      if (res.ok) {
        onSubmitted()
      } else {
        const data = await res.json()
        setError(data.detail || JSON.stringify(data))
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4">Enviar Vídeo</h2>

          {loadingVideos ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            </div>
          ) : videos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum vídeo disponível. Faça upload primeiro.</p>
          ) : (
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-gray-400 mb-2">Selecione o vídeo</label>
              {videos.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVideo(v.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selectedVideo === v.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <FileVideo className="w-6 h-6 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{v.title}</div>
                    {v.duration && <div className="text-xs text-gray-500">{Math.round(v.duration)}s</div>}
                  </div>
                  {selectedVideo === v.id && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm text-gray-400 mb-1">Notas (opcional)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none resize-none h-16"
              placeholder="Algo que queira dizer ao professor..."
            />
          </div>

          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        <div className="p-6 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !selectedVideo} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-medium disabled:opacity-50">
            {saving ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
