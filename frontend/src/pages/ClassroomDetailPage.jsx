import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Users, BookOpen, Plus, Copy, Check, Settings,
  Clock, CheckCircle2, AlertCircle, Send, MessageSquare,
  Music, ChevronRight, FileVideo, CalendarDays, Megaphone, Pin,
} from 'lucide-react'

export default function ClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, authFetch } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('assignments')
  const [copiedCode, setCopiedCode] = useState(false)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [showAnnounce, setShowAnnounce] = useState(false)

  const isTeacher = classroom?.my_role === 'teacher'

  const fetchData = useCallback(async () => {
    try {
      const [classRes, assignRes, announceRes] = await Promise.all([
        authFetch(`/api/classroom/classrooms/${id}/`),
        authFetch(`/api/classroom/assignments/?classroom=${id}`),
        authFetch(`/api/classroom/classrooms/${id}/announcements/`),
      ])
      if (classRes.ok) setClassroom(await classRes.json())
      if (assignRes.ok) {
        const data = await assignRes.json()
        setAssignments(data.results || data)
      }
      if (announceRes.ok) setAnnouncements(await announceRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id, authFetch])

  useEffect(() => { fetchData() }, [fetchData])

  const copyCode = () => {
    navigator.clipboard.writeText(classroom.invite_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!classroom) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Turma não encontrada
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Header */}
      <div className="relative h-40" style={{ backgroundColor: classroom.cover_color || '#6366F1' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-gray-950" />
        <div className="absolute top-4 left-4">
          <button onClick={() => navigate('/classrooms')} className="flex items-center gap-1 text-sm bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-lg backdrop-blur-sm transition">
            <ArrowLeft className="w-4 h-4" /> Turmas
          </button>
        </div>
        <div className="absolute bottom-4 left-6 right-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold">{classroom.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-white/70">
                {classroom.dance_style && <span className="flex items-center gap-1"><Music className="w-3.5 h-3.5" />{classroom.dance_style}</span>}
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{classroom.student_count} aluno{classroom.student_count !== 1 ? 's' : ''}</span>
                {!isTeacher && <span>Prof. {classroom.teacher?.full_name}</span>}
              </div>
            </div>
            {isTeacher && (
              <button onClick={copyCode} className="flex items-center gap-2 bg-black/30 hover:bg-black/50 px-3 py-2 rounded-lg backdrop-blur-sm text-sm transition">
                {copiedCode ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                Código: <span className="font-mono font-bold">{classroom.invite_code}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 sticky top-0 bg-gray-950/90 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-6 flex gap-1">
          {[
            { key: 'assignments', label: 'Atividades', icon: BookOpen, count: assignments.length },
            { key: 'announcements', label: 'Avisos', icon: Megaphone, count: announcements.length },
            { key: 'members', label: 'Membros', icon: Users, count: classroom.members?.length || 0 },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition ${
                tab === t.key
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Assignments Tab */}
        {tab === 'assignments' && (
          <div>
            {isTeacher && (
              <button
                onClick={() => setShowCreateAssignment(true)}
                className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Nova Atividade
              </button>
            )}
            {assignments.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p>{isTeacher ? 'Nenhuma atividade criada ainda.' : 'Nenhuma atividade disponível.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map(a => (
                  <AssignmentCard key={a.id} assignment={a} isTeacher={isTeacher} onClick={() => navigate(`/assignment/${a.id}`)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Announcements Tab */}
        {tab === 'announcements' && (
          <div>
            {isTeacher && (
              <button
                onClick={() => setShowAnnounce(true)}
                className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
              >
                <Megaphone className="w-4 h-4" /> Novo Aviso
              </button>
            )}
            {announcements.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p>Nenhum aviso.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map(a => (
                  <div key={a.id} className="p-4 rounded-lg border border-gray-800 bg-gray-900/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{a.author?.full_name}</span>
                        {a.pinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{a.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {tab === 'members' && (
          <div>
            <div className="space-y-2">
              {/* Teacher */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                  {(classroom.teacher?.full_name || 'P')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{classroom.teacher?.full_name}</div>
                  <div className="text-xs text-indigo-400">Professor</div>
                </div>
              </div>
              {/* Students */}
              {classroom.members?.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-800 hover:bg-gray-900/50 transition">
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">
                    {(m.user?.full_name || m.user?.username || 'A')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{m.user?.full_name || m.user?.username}</div>
                    <div className="text-xs text-gray-500 capitalize">{m.role}</div>
                  </div>
                  <span className="text-xs text-gray-600">
                    desde {new Date(m.joined_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Assignment Modal */}
      {showCreateAssignment && (
        <CreateAssignmentModal
          classroomId={id}
          authFetch={authFetch}
          onClose={() => setShowCreateAssignment(false)}
          onCreated={(a) => { setAssignments(prev => [a, ...prev]); setShowCreateAssignment(false) }}
        />
      )}

      {/* Announce Modal */}
      {showAnnounce && (
        <AnnounceModal
          classroomId={id}
          authFetch={authFetch}
          onClose={() => setShowAnnounce(false)}
          onCreated={(a) => { setAnnouncements(prev => [a, ...prev]); setShowAnnounce(false) }}
        />
      )}
    </div>
  )
}

function AssignmentCard({ assignment, isTeacher, onClick }) {
  const a = assignment
  const statusColors = {
    draft: 'text-gray-400 bg-gray-800',
    published: 'text-emerald-400 bg-emerald-500/10',
    closed: 'text-red-400 bg-red-500/10',
  }
  const submissionStatus = a.my_submission
  const hasSubmitted = !!submissionStatus
  const hasFeedback = submissionStatus?.has_feedback

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/50 cursor-pointer group transition-all hover:shadow-lg hover:shadow-indigo-500/5"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold group-hover:text-indigo-300 transition">{a.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[a.status]}`}>
              {a.status === 'draft' ? 'Rascunho' : a.status === 'published' ? 'Publicado' : 'Encerrado'}
            </span>
          </div>
          {a.description && <p className="text-sm text-gray-400 line-clamp-2">{a.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            {a.focus_bar_start != null && (
              <span className="flex items-center gap-1">
                <Music className="w-3 h-3" />
                Compassos {a.focus_bar_start}–{a.focus_bar_end}
              </span>
            )}
            {a.target_bpm && (
              <span>{a.target_bpm} BPM</span>
            )}
            {a.due_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                Até {new Date(a.due_date).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {isTeacher ? (
            <div className="text-right text-xs">
              <div className="flex items-center gap-1 text-gray-400">
                <FileVideo className="w-3.5 h-3.5" />
                {a.submission_count} envio{a.submission_count !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-1 text-emerald-400 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5" />
                {a.reviewed_count} revisado{a.reviewed_count !== 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <div>
              {!hasSubmitted && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Pendente
                </span>
              )}
              {hasSubmitted && !hasFeedback && (
                <span className="text-xs text-blue-400 flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Enviado
                </span>
              )}
              {hasFeedback && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Feedback
                </span>
              )}
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition" />
        </div>
      </div>
    </div>
  )
}

function CreateAssignmentModal({ classroomId, authFetch, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', description: '', instructions: '',
    focus_bar_start: '', focus_bar_end: '', target_bpm: '',
    due_date: '', status: 'draft',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Título é obrigatório'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        classroom: classroomId,
        focus_bar_start: form.focus_bar_start ? parseInt(form.focus_bar_start) : null,
        focus_bar_end: form.focus_bar_end ? parseInt(form.focus_bar_end) : null,
        target_bpm: form.target_bpm ? parseFloat(form.target_bpm) : null,
        due_date: form.due_date || null,
      }
      const res = await authFetch('/api/classroom/assignments/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        onCreated(await res.json())
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
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Nova Atividade</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Título *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                placeholder="Ex: Praticar giro do forró" autoFocus />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descrição</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none resize-none h-16" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Instruções</label>
              <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none resize-none h-20"
                placeholder="Instruções detalhadas para o aluno..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Compasso início</label>
                <input type="number" min="0" value={form.focus_bar_start} onChange={e => setForm(f => ({ ...f, focus_bar_start: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Compasso fim</label>
                <input type="number" min="0" value={form.focus_bar_end} onChange={e => setForm(f => ({ ...f, focus_bar_end: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">BPM</label>
                <input type="number" min="30" max="300" value={form.target_bpm} onChange={e => setForm(f => ({ ...f, target_bpm: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Data limite</label>
              <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition">Cancelar</button>
              <button type="submit" name="action" value="draft" disabled={saving}
                onClick={() => setForm(f => ({ ...f, status: 'draft' }))}
                className="flex-1 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition text-sm disabled:opacity-50">
                Salvar Rascunho
              </button>
              <button type="submit" disabled={saving}
                onClick={() => setForm(f => ({ ...f, status: 'published' }))}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-medium text-sm disabled:opacity-50">
                {saving ? 'Salvando...' : 'Publicar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function AnnounceModal({ classroomId, authFetch, onClose, onCreated }) {
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(`/api/classroom/classrooms/${classroomId}/announce/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, pinned }),
      })
      if (res.ok) onCreated(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Novo Aviso</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea value={content} onChange={e => setContent(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none resize-none h-28"
              placeholder="Escreva um aviso para a turma..." autoFocus />
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)}
                className="rounded border-gray-600" />
              <Pin className="w-3.5 h-3.5" /> Fixar aviso
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition">Cancelar</button>
              <button type="submit" disabled={saving || !content.trim()} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-medium disabled:opacity-50">
                {saving ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
