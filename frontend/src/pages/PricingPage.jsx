import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Music, Check, X, Zap, Crown, Sparkles, ArrowLeft, Loader2,
  HardDrive, Clock, Monitor, Trash2, Star
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AuthModal from '../components/AuthModal'

const PLANS_FALLBACK = [
  {
    slug: 'basic',
    name: 'Basic',
    price_brl: '15.00',
    storage_limit_gb: 5,
    export_minutes_per_month: 60,
    max_resolution: '1080p',
    allows_4k: false,
    export_priority: 'low',
    auto_delete_days: 7,
  },
  {
    slug: 'pro',
    name: 'Pro',
    price_brl: '35.00',
    storage_limit_gb: 30,
    export_minutes_per_month: 200,
    max_resolution: '4k',
    allows_4k: true,
    export_priority: 'normal',
    auto_delete_days: 15,
  },
  {
    slug: 'creator',
    name: 'Creator',
    price_brl: '60.00',
    storage_limit_gb: 100,
    export_minutes_per_month: 600,
    max_resolution: '4k',
    allows_4k: true,
    export_priority: 'high',
    auto_delete_days: 30,
  },
]

const PLAN_STYLES = {
  basic: {
    icon: Zap,
    gradient: 'from-blue-500 to-cyan-500',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    badge: null,
    bg: 'bg-blue-500/5',
  },
  pro: {
    icon: Crown,
    gradient: 'from-violet-500 to-fuchsia-500',
    border: 'border-violet-500/30 hover:border-violet-500/50 ring-1 ring-violet-500/20',
    badge: 'Mais popular',
    bg: 'bg-violet-500/5',
  },
  creator: {
    icon: Sparkles,
    gradient: 'from-amber-500 to-orange-500',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    badge: null,
    bg: 'bg-amber-500/5',
  },
}

export default function PricingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, authFetch } = useAuth()
  const [plans, setPlans] = useState(PLANS_FALLBACK)
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [pendingPlan, setPendingPlan] = useState(null)
  const [error, setError] = useState(null)

  // Fetch plans from API
  useEffect(() => {
    fetch('/api/billing/plans/')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.length) setPlans(data) })
      .catch(() => {})
  }, [])

  const handleChoosePlan = async (plan) => {
    setError(null)

    if (!isAuthenticated) {
      setPendingPlan(plan)
      setShowAuth(true)
      return
    }

    setLoadingPlan(plan.slug)
    try {
      const res = await authFetch('/api/billing/checkout/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_slug: plan.slug }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao iniciar checkout')
        setLoadingPlan(null)
        return
      }

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err) {
      setError('Erro de conexao. Tente novamente.')
    } finally {
      setLoadingPlan(null)
    }
  }

  // After auth modal closes, if user just logged in and had a pending plan
  const handleAuthClose = () => {
    setShowAuth(false)
    if (pendingPlan && isAuthenticated) {
      handleChoosePlan(pendingPlan)
      setPendingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="px-6 py-5 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Ritmo</span>
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </nav>

      {/* Header */}
      <section className="px-6 pt-16 pb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
          Planos e{' '}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            precos
          </span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Escolha o plano ideal para o seu nivel de estudo. Sem fidelidade — cancele quando quiser.
        </p>
      </section>

      {/* Error */}
      {error && (
        <div className="max-w-3xl mx-auto px-6 mb-6">
          <div className="p-4 bg-red-900/40 border border-red-700 rounded-xl text-sm text-red-300 text-center">
            {error}
          </div>
        </div>
      )}

      {/* Plan cards */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const style = PLAN_STYLES[plan.slug] || PLAN_STYLES.basic
            const Icon = style.icon
            const isLoading = loadingPlan === plan.slug

            return (
              <div
                key={plan.slug}
                className={`relative rounded-2xl border ${style.border} ${style.bg} p-8 flex flex-col transition-all duration-300`}
              >
                {/* Popular badge */}
                {style.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className={`px-4 py-1 bg-gradient-to-r ${style.gradient} rounded-full text-xs font-bold text-white shadow-lg`}>
                      {style.badge}
                    </div>
                  </div>
                )}

                {/* Icon + Name */}
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-gray-500">R$</span>
                    <span className="text-5xl font-extrabold tracking-tight">
                      {parseFloat(plan.price_brl).toFixed(0)}
                    </span>
                    <span className="text-gray-500 text-sm">/mes</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3.5 flex-1 mb-8">
                  <FeatureRow icon={HardDrive} text={`${plan.storage_limit_gb} GB de storage`} />
                  <FeatureRow icon={Clock} text={`${plan.export_minutes_per_month} min de export/mes`} />
                  <FeatureRow icon={Monitor} text={`Resolucao ate ${plan.max_resolution.toUpperCase()}`} />
                  {plan.allows_4k ? (
                    <FeatureRow icon={Check} text="Export 4K (consome 2x creditos)" highlight />
                  ) : (
                    <FeatureRow icon={X} text="Sem export 4K" disabled />
                  )}
                  <FeatureRow
                    icon={Star}
                    text={`Prioridade ${plan.export_priority === 'high' ? 'alta' : plan.export_priority === 'normal' ? 'normal' : 'baixa'}`}
                    highlight={plan.export_priority === 'high'}
                  />
                  <FeatureRow icon={Trash2} text={`Auto-delete apos ${plan.auto_delete_days} dias`} />
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isLoading || loadingPlan !== null}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    plan.slug === 'pro'
                      ? `bg-gradient-to-r ${style.gradient} text-white hover:shadow-lg hover:shadow-violet-500/25`
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {isLoading ? 'Redirecionando...' : 'Assinar agora'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Extra info */}
        <div className="max-w-3xl mx-auto mt-12 text-center space-y-3">
          <p className="text-sm text-gray-500">
            Creditos extras podem ser comprados a <strong className="text-gray-300">R$0,50/min</strong>. Creditos comprados nunca expiram.
          </p>
          <p className="text-sm text-gray-500">
            Export 4K consome <strong className="text-gray-300">2x creditos</strong>. Todos os planos incluem deteccao de BPM, editor completo e exportacao com overlays.
          </p>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={handleAuthClose}
        reason="billing"
      />
    </div>
  )
}

function FeatureRow({ icon: Icon, text, highlight = false, disabled = false }) {
  return (
    <li className={`flex items-center gap-3 text-sm ${disabled ? 'text-gray-600' : highlight ? 'text-white' : 'text-gray-400'}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${disabled ? 'text-gray-700' : highlight ? 'text-violet-400' : 'text-gray-500'}`} />
      <span>{text}</span>
    </li>
  )
}
