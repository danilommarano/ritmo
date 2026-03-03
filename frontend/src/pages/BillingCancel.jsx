import { Link } from 'react-router-dom'
import { XCircle, ArrowRight } from 'lucide-react'

export default function BillingCancel() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 bg-gray-800 border border-white/10 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="w-10 h-10 text-gray-500" />
        </div>
        <h1 className="text-3xl font-extrabold">Checkout cancelado</h1>
        <p className="text-gray-400 leading-relaxed">
          Nenhuma cobranca foi realizada. Voce pode voltar e escolher um plano quando quiser.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/pricing"
            className="px-6 py-3 bg-white/10 hover:bg-white/15 rounded-xl font-medium transition-colors"
          >
            Ver planos
          </Link>
          <Link
            to="/upload"
            className="group px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            Continuar sem plano
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  )
}
