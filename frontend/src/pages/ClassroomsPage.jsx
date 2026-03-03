import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Users, BookOpen, ArrowRight, LogIn, Copy, Check, GraduationCap, Music } from 'lucide-react'

const DANCE_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6',
]

export default function ClassroomsPage() {
  const { user, authFetch } = useAuth()
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [classRes, profileRes] = await Promise.all([
        authFetch('/api/classroom/classrooms/'),
        authFetch('/api/classroom/profiles/me/'),
      ])
      if (classRes.ok) {
        const data = await classRes.json()
        setClassrooms(data.results || data)
      }
      if (profileRes.ok) {
        setProfile(await profileRes.json())
      }
    } catch (err) {
      console.error('Failed to fetch classrooms:', err)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { fetchData() }, [fetchData])

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const myClassrooms = classrooms.filter(c => c.my_role === 'teacher')
  const enrolledClassrooms = classrooms.filter(c => c.my_role === 'student' || c.my_role === 'assistant')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold">Ritmo Classroom</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition text-sm"
            >
              <LogIn className="w-4 h-4" />
              Entrar com código
            </button>
            {profile?.role === 'teacher' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Nova Turma
              </button>
            )}
            <button
              onClick={() => navigate('/app')}
              className="px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition text-sm"
            >
              Meus Vídeos
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Role selector for new users */}
        {!profile && (
          <RoleSelector authFetch={authFetch} onComplete={(p) => { setProfile(p); fetchData() }} />
        )}

        {/* Teacher's classrooms */}
        {myClassrooms.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-400" />
              Minhas Turmas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myClassrooms.map(c => (
                <ClassroomCard
                  key={c.id} classroom={c} role="teacher"
                  onNavigate={() => navigate(`/classroom/${c.id}`)}
                  onCopyCode={() => copyCode(c.invite_code)}
                  copiedCode={copiedCode}
                />
              ))}
            </div>
          </section>
        )}

        {/* Enrolled classrooms */}
        {enrolledClassrooms.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Turmas que Participo
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrolledClassrooms.map(c => (
                <ClassroomCard
                  key={c.id} classroom={c} role="student"
                  onNavigate={() => navigate(`/classroom/${c.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {classrooms.length === 0 && profile && (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">Nenhuma turma ainda</h2>
            <p className="text-gray-500 mb-6">
              {profile.role === 'teacher'
                ? 'Crie sua primeira turma e convide seus alunos!'
                : 'Peça o código de convite ao seu professor para entrar em uma turma.'}
            </p>
            <div className="flex gap-3 justify-center">
              {profile.role === 'teacher' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Criar Turma
                </button>
              )}
              <button
                onClick={() => setShowJoinModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition"
              >
                <LogIn className="w-5 h-5" />
                Entrar com Código
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateClassroomModal
          authFetch={authFetch}
          onClose={() => setShowCreateModal(false)}
          onCreated={(c) => { setClassrooms(prev => [c, ...prev]); setShowCreateModal(false) }}
        />
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <JoinClassroomModal
          authFetch={authFetch}
          onClose={() => setShowJoinModal(false)}
          onJoined={(c) => { setClassrooms(prev => [c, ...prev]); setShowJoinModal(false) }}
        />
      )}
    </div>
  )
}

function ClassroomCard({ classroom, role, onNavigate, onCopyCode, copiedCode }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer group border border-gray-800 hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
      onClick={onNavigate}
    >
      <div className="h-24 relative" style={{ backgroundColor: classroom.cover_color || '#6366F1' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900/80" />
        {role === 'teacher' && onCopyCode && (
          <button
            onClick={(e) => { e.stopPropagation(); onCopyCode() }}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-black/40 hover:bg-black/60 text-xs backdrop-blur-sm transition"
            title="Copiar código de convite"
          >
            {copiedCode === classroom.invite_code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {classroom.invite_code}
          </button>
        )}
        {classroom.dance_style && (
          <span className="absolute bottom-2 left-3 text-xs bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
            {classroom.dance_style}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-white group-hover:text-indigo-300 transition">{classroom.name}</h3>
        {role === 'student' && (
          <p className="text-sm text-gray-400 mt-1">Prof. {classroom.teacher?.full_name}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {classroom.student_count} aluno{classroom.student_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {classroom.assignment_count} atividade{classroom.assignment_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition">
        <ArrowRight className="w-4 h-4 text-indigo-400" />
      </div>
    </div>
  )
}

function RoleSelector({ authFetch, onComplete }) {
  const [saving, setSaving] = useState(false)

  const selectRole = async (role) => {
    setSaving(true)
    try {
      const res = await authFetch('/api/classroom/profiles/me/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (res.ok) onComplete(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h2 className="text-2xl font-bold mb-2">Bem-vindo ao Ritmo Classroom!</h2>
      <p className="text-gray-400 mb-8">Como você quer usar a plataforma?</p>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => selectRole('teacher')}
          disabled={saving}
          className="p-6 rounded-xl border border-gray-700 hover:border-indigo-500 hover:bg-indigo-500/10 transition text-center group"
        >
          <GraduationCap className="w-10 h-10 text-indigo-400 mx-auto mb-3 group-hover:scale-110 transition" />
          <div className="font-semibold">Sou Professor</div>
          <p className="text-xs text-gray-500 mt-1">Criar turmas, atividades e dar feedback</p>
        </button>
        <button
          onClick={() => selectRole('student')}
          disabled={saving}
          className="p-6 rounded-xl border border-gray-700 hover:border-emerald-500 hover:bg-emerald-500/10 transition text-center group"
        >
          <BookOpen className="w-10 h-10 text-emerald-400 mx-auto mb-3 group-hover:scale-110 transition" />
          <div className="font-semibold">Sou Aluno</div>
          <p className="text-xs text-gray-500 mt-1">Entrar em turmas e enviar vídeos</p>
        </button>
      </div>
    </div>
  )
}

function CreateClassroomModal({ authFetch, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', dance_style: '', cover_color: DANCE_COLORS[0] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const res = await authFetch('/api/classroom/classrooms/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onCreated(await res.json())
      } else {
        const data = await res.json()
        setError(data.detail || 'Erro ao criar turma')
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Criar Nova Turma</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome da turma *</label>
              <input
                type="text" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                placeholder="Ex: Turma de Forró - Iniciante"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Estilo de dança</label>
              <input
                type="text" value={form.dance_style}
                onChange={e => setForm(f => ({ ...f, dance_style: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                placeholder="Ex: Forró, Samba, Zouk..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none resize-none h-20"
                placeholder="Descreva a turma..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {DANCE_COLORS.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm(f => ({ ...f, cover_color: c }))}
                    className={`w-8 h-8 rounded-full transition-transform ${form.cover_color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-medium disabled:opacity-50">
                {saving ? 'Criando...' : 'Criar Turma'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function JoinClassroomModal({ authFetch, onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!code.trim()) { setError('Código é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const res = await authFetch('/api/classroom/classrooms/join/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (res.ok) {
        onJoined(data)
      } else {
        setError(data.detail || 'Código inválido')
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Entrar em uma Turma</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Código de convite</label>
              <input
                type="text" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white text-center text-lg tracking-widest font-mono focus:border-indigo-500 focus:outline-none uppercase"
                placeholder="ABC12345"
                maxLength={8}
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving || code.length < 4} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition font-medium disabled:opacity-50">
                {saving ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
