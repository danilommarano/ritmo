import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Music, ArrowLeft, Loader2, CreditCard, HardDrive, Clock,
  Download, ExternalLink, XCircle, RefreshCw, Crown, Zap,
  Sparkles, AlertTriangle, CheckCircle2, LogOut
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AuthModal from '../components/AuthModal'

const PLAN_ICONS = {
  basic: Zap,
  pro: Crown,
  creator: Sparkles,
}

const PLAN_COLORS = {
  basic: 'from-blue-500 to-cyan-500',
  pro: 'from-violet-500 to-fuchsia-500',
  creator: 'from-amber-500 to-orange-500',
}

const STATUS_LABELS = {
  active: { label: 'Ativa', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  past_due: { label: 'Pagamento pendente', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  canceled: { label: 'Cancelada', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  trialing: { label: 'Periodo de teste', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  incomplete: { label: 'Incompleta', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
}

export default function BillingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, authFetch, logout } = useAuth()
  const [billingData, setBillingData] = useState(null)
  const [exports, setExports] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const fetchBilling = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const [statusRes, exportsRes] = await Promise.all([
        authFetch('/api/billing/status/'),
        authFetch('/api/billing/export-history/'),
      ])

      if (statusRes.ok) {
        setBillingData(await statusRes.json())
      }
      if (exportsRes.ok) {
        setExports(await exportsRes.json())
      }
    } catch (err) {
      console.error('Failed to fetch billing:', err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, authFetch])

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Voce tera acesso ate o fim do periodo atual.')) return
    setActionLoading('cancel')
    setError(null)
    try {
      const res = await authFetch('/api/billing/cancel/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ at_period_end: true }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(data.message)
        fetchBilling()
      } else {
        setError(data.error)
      }
    } catch { setError('Erro de conexao') }
    finally { setActionLoading(null) }
  }

  const handleReactivate = async () => {
    setActionLoading('reactivate')
    setError(null)
    try {
      const res = await authFetch('/api/billing/reactivate/', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(data.message)
        fetchBilling()
      } else {
        setError(data.error)
      }
    } catch { setError('Erro de conexao') }
    finally { setActionLoading(null) }
  }

  const handlePortal = async () => {
    setActionLoading('portal')
    try {
      const res = await authFetch('/api/billing/portal/', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.portal_url) {
        window.location.href = data.portal_url
      } else {
        setError(data.error || 'Erro ao abrir portal')
      }
    } catch { setError('Erro de conexao') }
    finally { setActionLoading(null) }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <BillingNav onBack={() => navigate(-1)} />
        <div className="max-w-lg mx-auto px-6 pt-24 text-center">
          <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Faca login para ver seu plano</h2>
          <p className="text-gray-400 mb-8">Voce precisa estar logado para acessar sua conta e billing.</p>
          <button
            onClick={() => setShowAuth(true)}
            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            Entrar com email
          </button>
          <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} reason="billing" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <BillingNav onBack={() => navigate(-1)} />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      </div>
    )
  }

  const sub = billingData?.subscription
  const credits = billingData?.credits
  const storage = billingData?.storage

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <BillingNav onBack={() => navigate(-1)} />

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* User info header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Minha conta</h1>
            <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-900/40 border border-red-700 rounded-xl text-sm text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-green-900/40 border border-green-700 rounded-xl text-sm text-green-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Subscription card */}
        <div className="rounded-2xl border border-white/5 bg-gray-900/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Assinatura
            </h2>
            {sub && (
              <StatusBadge status={sub.status} cancelAtEnd={sub.cancel_at_period_end} />
            )}
          </div>

          {sub ? (
            <div className="space-y-5">
              {/* Plan info */}
              <div className="flex items-center gap-4">
                <PlanIcon slug={sub.plan_slug} />
                <div>
                  <p className="text-xl font-bold">{sub.plan_name}</p>
                  <p className="text-gray-400 text-sm">
                    {sub.plan_limits.storage_gb} GB storage &middot;{' '}
                    {sub.plan_limits.export_minutes} min/mes &middot;{' '}
                    {sub.plan_limits.max_resolution.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Billing period */}
              {sub.current_period_end && (
                <p className="text-sm text-gray-500">
                  {sub.cancel_at_period_end
                    ? `Acesso ate ${formatDate(sub.current_period_end)}`
                    : `Proxima cobranca: ${formatDate(sub.current_period_end)}`}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/pricing"
                  className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
                >
                  Trocar plano
                </Link>

                {sub.cancel_at_period_end ? (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 text-sm font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === 'reactivate' && <Loader2 className="w-3 h-3 animate-spin" />}
                    Reativar
                  </button>
                ) : (
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading !== null}
                    className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === 'cancel' && <Loader2 className="w-3 h-3 animate-spin" />}
                    Cancelar
                  </button>
                )}

                <button
                  onClick={handlePortal}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === 'portal' && <Loader2 className="w-3 h-3 animate-spin" />}
                  <ExternalLink className="w-3.5 h-3.5" />
                  Portal Stripe
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-400 mb-4">Voce ainda nao tem uma assinatura ativa.</p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                Ver planos
              </Link>
            </div>
          )}
        </div>

        {/* Credits + Storage row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Credits card */}
          <div className="rounded-2xl border border-white/5 bg-gray-900/50 p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <Clock className="w-5 h-5 text-gray-400" />
              Creditos de export
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-3xl font-extrabold">
                    {credits?.total_minutes?.toFixed?.(0) || 0}
                  </span>
                  <span className="text-sm text-gray-500">minutos disponiveis</span>
                </div>
                {sub && (
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((credits?.total_minutes || 0) / (sub.plan_limits?.export_minutes || 60)) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-800/50 rounded-xl">
                  <p className="text-gray-500 text-xs mb-1">Assinatura</p>
                  <p className="font-bold">{credits?.subscription_minutes?.toFixed?.(0) || 0} min</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-xl">
                  <p className="text-gray-500 text-xs mb-1">Comprados</p>
                  <p className="font-bold">{credits?.purchased_minutes?.toFixed?.(0) || 0} min</p>
                </div>
              </div>
              {credits?.last_reset_at && (
                <p className="text-xs text-gray-600">
                  Ultimo reset: {formatDate(credits.last_reset_at)}
                </p>
              )}
            </div>
          </div>

          {/* Storage card */}
          <div className="rounded-2xl border border-white/5 bg-gray-900/50 p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <HardDrive className="w-5 h-5 text-gray-400" />
              Storage
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-3xl font-extrabold">
                    {storage?.gb_used?.toFixed?.(2) || '0.00'}
                  </span>
                  <span className="text-sm text-gray-500">
                    / {sub?.plan_limits?.storage_gb || '—'} GB
                  </span>
                </div>
                {sub && (
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (storage?.gb_used || 0) / (sub.plan_limits?.storage_gb || 1) > 0.9
                          ? 'bg-gradient-to-r from-red-500 to-orange-500'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                      }`}
                      style={{
                        width: `${Math.min(100, ((storage?.gb_used || 0) / (sub.plan_limits?.storage_gb || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="p-3 bg-gray-800/50 rounded-xl text-sm">
                <p className="text-gray-500 text-xs mb-1">Arquivos</p>
                <p className="font-bold">{storage?.file_count || 0} videos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Export History */}
        <div className="rounded-2xl border border-white/5 bg-gray-900/50 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Download className="w-5 h-5 text-gray-400" />
              Historico de exports
            </h2>
            <button
              onClick={fetchBilling}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {exports.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              Nenhum export realizado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5">
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 pr-4 font-medium">Resolucao</th>
                    <th className="py-2 pr-4 font-medium">Duracao</th>
                    <th className="py-2 pr-4 font-medium">Creditos</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exports.map((job) => (
                    <tr key={job.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3 pr-4 text-gray-300">{formatDate(job.created_at)}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          job.resolution === '4k'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-gray-700 text-gray-300'
                        }`}>
                          {job.resolution.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-400">{job.estimated_duration_minutes} min</td>
                      <td className="py-3 pr-4 text-gray-300 font-mono">
                        {job.credits_consumed}
                        {job.credit_multiplier > 1 && (
                          <span className="text-xs text-amber-400 ml-1">x{job.credit_multiplier}</span>
                        )}
                      </td>
                      <td className="py-3">
                        <ExportStatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BillingNav({ onBack }) {
  return (
    <nav className="px-6 py-5 border-b border-white/5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Ritmo</span>
        </Link>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>
    </nav>
  )
}

function PlanIcon({ slug }) {
  const Icon = PLAN_ICONS[slug] || Zap
  const gradient = PLAN_COLORS[slug] || 'from-gray-500 to-gray-600'
  return (
    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  )
}

function StatusBadge({ status, cancelAtEnd }) {
  const config = STATUS_LABELS[status] || STATUS_LABELS.incomplete
  const label = cancelAtEnd ? 'Cancelamento agendado' : config.label
  const color = cancelAtEnd ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : config.color
  return (
    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${color}`}>
      {label}
    </span>
  )
}

function ExportStatusBadge({ status }) {
  const map = {
    completed: { label: 'Concluido', color: 'text-green-400' },
    processing: { label: 'Processando', color: 'text-blue-400' },
    pending: { label: 'Pendente', color: 'text-gray-400' },
    reserved: { label: 'Reservado', color: 'text-violet-400' },
    failed: { label: 'Falhou', color: 'text-red-400' },
    canceled: { label: 'Cancelado', color: 'text-gray-500' },
  }
  const cfg = map[status] || map.pending
  return <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
