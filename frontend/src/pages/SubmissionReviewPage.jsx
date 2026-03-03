import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Play, Pause, Star, Send, CheckCircle2, AlertCircle,
  MessageSquare, Plus, Music, Eye, ThumbsUp, Lightbulb, AlertTriangle,
  BookOpen, Trash2,
} from 'lucide-react'

const ANNOTATION_TYPES = [
  { value: 'correction', label: 'Correção', color: '#EF4444', icon: AlertTriangle, emoji: '🔴' },
  { value: 'praise', label: 'Elogio', color: '#22C55E', icon: ThumbsUp, emoji: '🟢' },
  { value: 'tip', label: 'Dica', color: '#3B82F6', icon: Lightbulb, emoji: '🔵' },
  { value: 'reference', label: 'Referência', color: '#A855F7', icon: BookOpen, emoji: '🟣' },
]

const GRADES = [
  { value: 1, label: 'Precisa Melhorar Muito', stars: 1 },
  { value: 2, label: 'Precisa Melhorar', stars: 2 },
  { value: 3, label: 'Bom', stars: 3 },
  { value: 4, label: 'Muito Bom', stars: 4 },
  { value: 5, label: 'Excelente', stars: 5 },
]

export default function SubmissionReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, authFetch } = useAuth()
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await authFetch(`/api/classroom/submissions/${id}/`)
      if (res.ok) setSubmission(await res.json())
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

  if (!submission) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Submissão não encontrada
      </div>
    )
  }

  const isTeacher = submission.assignment?.teacher?.id === user?.id ||
    submission.feedback?.teacher?.id === user?.id
  const feedback = submission.feedback
  const hasFeedback = !!feedback

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-2 transition">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold">
                {isTeacher
                  ? `Envio de ${submission.student?.full_name}`
                  : `Meu envio #${submission.attempt_number}`}
              </h1>
              <p className="text-sm text-gray-400">{submission.video_title}</p>
            </div>
            <StatusBadge status={submission.status} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video + Editor link */}
          <div className="lg:col-span-2">
            <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-900">
              <div className="aspect-video bg-black flex items-center justify-center">
                <button
                  onClick={() => navigate(`/editor/${submission.video}`)}
                  className="flex flex-col items-center gap-3 text-gray-400 hover:text-indigo-400 transition group"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-800 group-hover:bg-indigo-600/20 flex items-center justify-center transition">
                    <Play className="w-8 h-8 ml-1" />
                  </div>
                  <span className="text-sm">Abrir no Editor</span>
                </button>
              </div>
            </div>

            {/* Student notes */}
            {submission.student_notes && (
              <div className="mt-4 p-4 rounded-lg border border-gray-800 bg-gray-900/50">
                <h3 className="text-sm font-medium text-gray-400 mb-1">Notas do aluno</h3>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{submission.student_notes}</p>
              </div>
            )}
          </div>

          {/* Feedback panel */}
          <div className="space-y-4">
            {hasFeedback ? (
              <FeedbackDisplay feedback={feedback} />
            ) : isTeacher ? (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">Nenhum feedback ainda</p>
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium mx-auto"
                >
                  <MessageSquare className="w-4 h-4" /> Dar Feedback
                </button>
              </div>
            ) : (
              <div className="text-center py-8 border border-gray-800 rounded-xl">
                <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Aguardando feedback do professor</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Feedback Form Modal */}
      {showFeedbackForm && (
        <FeedbackFormModal
          submissionId={id}
          authFetch={authFetch}
          onClose={() => setShowFeedbackForm(false)}
          onSaved={() => { setShowFeedbackForm(false); fetchData() }}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const config = {
    submitted: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Enviado' },
    in_review: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Em Revisão' },
    approved: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Aprovado' },
    needs_work: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Precisa Melhorar' },
    rejected: { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Rejeitado' },
  }
  const c = config[status] || config.submitted
  return <span className={`text-xs px-3 py-1 rounded-full border ${c.color}`}>{c.label}</span>
}

function Clock(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function FeedbackDisplay({ feedback }) {
  return (
    <div className="space-y-4">
      {/* Grade */}
      {feedback.grade && (
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 text-center">
          <div className="flex justify-center gap-1 mb-1">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                className={`w-5 h-5 ${s <= feedback.grade ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">
            {GRADES.find(g => g.value === feedback.grade)?.label}
          </span>
        </div>
      )}

      {/* Overall comment */}
      <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
        <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" /> Comentário Geral
        </h3>
        <p className="text-gray-300 text-sm whitespace-pre-wrap">{feedback.overall_comment}</p>
      </div>

      {/* Strengths */}
      {feedback.strengths?.length > 0 && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-1">
            <ThumbsUp className="w-3.5 h-3.5" /> Pontos Fortes
          </h3>
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" /> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {feedback.improvements?.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <h3 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Pontos a Melhorar
          </h3>
          <ul className="space-y-1">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Annotations */}
      {feedback.annotations?.length > 0 && (
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-1">
            <Music className="w-3.5 h-3.5" /> Anotações por Compasso ({feedback.annotations.length})
          </h3>
          <div className="space-y-2">
            {feedback.annotations.map((ann, i) => {
              const typeConfig = ANNOTATION_TYPES.find(t => t.value === ann.annotation_type) || ANNOTATION_TYPES[0]
              return (
                <div key={ann.id || i} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: typeConfig.color + '10' }}>
                  <div className="flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: typeConfig.color + '20', color: typeConfig.color }}>
                    {ann.bar_number}.{ann.beat_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium" style={{ color: typeConfig.color }}>{typeConfig.label}</span>
                    <p className="text-sm text-gray-300 mt-0.5">{ann.comment}</p>
                    {ann.reference_bar != null && (
                      <p className="text-xs text-purple-400 mt-1">
                        Ver referência: compasso {ann.reference_bar}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-600 text-center">
        Feedback por {feedback.teacher?.full_name} em {new Date(feedback.created_at).toLocaleDateString('pt-BR')}
      </div>
    </div>
  )
}

function FeedbackFormModal({ submissionId, authFetch, onClose, onSaved }) {
  const [form, setForm] = useState({
    overall_comment: '',
    grade: null,
    strengths: [],
    improvements: [],
    annotations: [],
  })
  const [newStrength, setNewStrength] = useState('')
  const [newImprovement, setNewImprovement] = useState('')
  const [newAnnotation, setNewAnnotation] = useState({
    bar_number: '', beat_number: '1', annotation_type: 'correction', comment: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addStrength = () => {
    if (newStrength.trim()) {
      setForm(f => ({ ...f, strengths: [...f.strengths, newStrength.trim()] }))
      setNewStrength('')
    }
  }

  const addImprovement = () => {
    if (newImprovement.trim()) {
      setForm(f => ({ ...f, improvements: [...f.improvements, newImprovement.trim()] }))
      setNewImprovement('')
    }
  }

  const addAnnotation = () => {
    if (newAnnotation.bar_number && newAnnotation.comment.trim()) {
      setForm(f => ({
        ...f,
        annotations: [...f.annotations, {
          ...newAnnotation,
          bar_number: parseInt(newAnnotation.bar_number),
          beat_number: parseInt(newAnnotation.beat_number) || 1,
        }],
      }))
      setNewAnnotation({ bar_number: '', beat_number: '1', annotation_type: 'correction', comment: '' })
    }
  }

  const removeAnnotation = (idx) => {
    setForm(f => ({ ...f, annotations: f.annotations.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async () => {
    if (!form.overall_comment.trim()) { setError('Comentário geral é obrigatório'); return }
    setSaving(true)
    try {
      const res = await authFetch(`/api/classroom/submissions/${submissionId}/feedback/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onSaved()
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
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-6">
          <h2 className="text-lg font-bold">Dar Feedback</h2>

          {/* Grade */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Nota</label>
            <div className="flex gap-2">
              {GRADES.map(g => (
                <button
                  key={g.value}
                  onClick={() => setForm(f => ({ ...f, grade: g.value }))}
                  className={`flex-1 py-2 px-1 rounded-lg border text-center transition text-xs ${
                    form.grade === g.value
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-gray-700 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-center mb-0.5">
                    {[...Array(g.stars)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${form.grade === g.value ? 'fill-amber-400 text-amber-400' : ''}`} />
                    ))}
                  </div>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overall comment */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Comentário geral *</label>
            <textarea
              value={form.overall_comment}
              onChange={e => setForm(f => ({ ...f, overall_comment: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none resize-none h-24"
              placeholder="Dê seu feedback geral sobre a performance..."
            />
          </div>

          {/* Strengths */}
          <div>
            <label className="block text-sm text-emerald-400 mb-2 flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" /> Pontos Fortes
            </label>
            {form.strengths.map((s, i) => (
              <div key={i} className="flex items-center gap-2 mb-1 text-sm text-gray-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {s}
                <button onClick={() => setForm(f => ({ ...f, strengths: f.strengths.filter((_, j) => j !== i) }))} className="text-gray-600 hover:text-red-400 ml-auto">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newStrength} onChange={e => setNewStrength(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStrength())}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Ex: Ritmo no tempo..."
              />
              <button onClick={addStrength} className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-sm transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Improvements */}
          <div>
            <label className="block text-sm text-amber-400 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Pontos a Melhorar
            </label>
            {form.improvements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 mb-1 text-sm text-gray-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> {s}
                <button onClick={() => setForm(f => ({ ...f, improvements: f.improvements.filter((_, j) => j !== i) }))} className="text-gray-600 hover:text-red-400 ml-auto">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newImprovement} onChange={e => setNewImprovement(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImprovement())}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                placeholder="Ex: Atrasar no compasso 8..."
              />
              <button onClick={addImprovement} className="px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 text-sm transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Annotations */}
          <div>
            <label className="block text-sm text-indigo-400 mb-2 flex items-center gap-1">
              <Music className="w-3.5 h-3.5" /> Anotações por Compasso
            </label>
            {form.annotations.map((ann, i) => {
              const tc = ANNOTATION_TYPES.find(t => t.value === ann.annotation_type) || ANNOTATION_TYPES[0]
              return (
                <div key={i} className="flex items-start gap-2 mb-2 p-2 rounded-lg border border-gray-800 text-sm">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: tc.color + '20', color: tc.color }}>
                    {ann.bar_number}.{ann.beat_number}
                  </span>
                  <span style={{ color: tc.color }} className="text-xs">{tc.label}:</span>
                  <span className="text-gray-300 flex-1">{ann.comment}</span>
                  <button onClick={() => removeAnnotation(i)} className="text-gray-600 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
            <div className="grid grid-cols-12 gap-2">
              <input
                type="number" min="0" placeholder="Comp."
                value={newAnnotation.bar_number}
                onChange={e => setNewAnnotation(a => ({ ...a, bar_number: e.target.value }))}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="number" min="1" max="16" placeholder="Tempo"
                value={newAnnotation.beat_number}
                onChange={e => setNewAnnotation(a => ({ ...a, beat_number: e.target.value }))}
                className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
              <select
                value={newAnnotation.annotation_type}
                onChange={e => setNewAnnotation(a => ({ ...a, annotation_type: e.target.value }))}
                className="col-span-3 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                {ANNOTATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
              <input
                placeholder="Comentário..."
                value={newAnnotation.comment}
                onChange={e => setNewAnnotation(a => ({ ...a, comment: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAnnotation())}
                className="col-span-4 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
              <button onClick={addAnnotation} className="col-span-1 flex items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-700 hover:bg-gray-800 transition">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !form.overall_comment.trim()}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-medium disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
