import { Link } from 'react-router-dom'
import { CheckCircle2, Music, ArrowRight } from 'lucide-react'

export default function BillingSuccess() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-3xl font-extrabold">Assinatura ativada!</h1>
        <p className="text-gray-400 leading-relaxed">
          Seu plano ja esta ativo. Seus creditos de export e storage estao disponiveis.
          Bora estudar ritmo!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/billing"
            className="px-6 py-3 bg-white/10 hover:bg-white/15 rounded-xl font-medium transition-colors"
          >
            Ver minha conta
          </Link>
          <Link
            to="/upload"
            className="group px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            Enviar video
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  )
}
