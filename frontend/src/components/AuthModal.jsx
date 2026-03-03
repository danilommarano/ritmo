import { useState, useRef, useEffect } from 'react'
import { X, Mail, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function AuthModal({ isOpen, onClose, reason = 'default' }) {
  const { requestMagicLink, verifyMagicLink } = useAuth()
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const codeRefs = useRef([])
  const emailRef = useRef(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('email')
      setEmail('')
      setCode(['', '', '', '', '', ''])
      setError(null)
      setLoading(false)
      setResendCooldown(0)
      setTimeout(() => emailRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Auto-focus first code input when step changes
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeRefs.current[0]?.focus(), 100)
    }
  }, [step])

  if (!isOpen) return null

  const reasonText = {
    export: 'Para exportar, entre com seu email.',
    save: 'Para salvar, entre com seu email.',
    billing: 'Para gerenciar seu plano, entre com seu email.',
    default: 'Entre com seu email para continuar.',
  }

  const handleRequestCode = async (e) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('Digite um email valido.')
      return
    }
    setError(null)
    setLoading(true)

    const result = await requestMagicLink(email.trim())
    setLoading(false)

    if (result.success) {
      setStep('code')
      setCode(['', '', '', '', '', ''])
      setResendCooldown(60)
    } else {
      setError(result.error)
    }
  }

  const handleCodeChange = (index, value) => {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    setError(null)

    // Auto-advance to next input
    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are filled
    if (digit && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode)
      }
    }
  }

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  const handleCodePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    if (pasted.length === 6) {
      handleVerifyCode(pasted)
    } else {
      codeRefs.current[pasted.length]?.focus()
    }
  }

  const handleVerifyCode = async (fullCode) => {
    setError(null)
    setLoading(true)

    const result = await verifyMagicLink(email.trim(), fullCode)
    setLoading(false)

    if (result.success) {
      onClose()
    } else {
      setError(result.error)
      setCode(['', '', '', '', '', ''])
      setTimeout(() => codeRefs.current[0]?.focus(), 100)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    setLoading(true)
    const result = await requestMagicLink(email.trim())
    setLoading(false)
    if (result.success) {
      setResendCooldown(60)
      setCode(['', '', '', '', '', ''])
      setTimeout(() => codeRefs.current[0]?.focus(), 100)
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            {step === 'code' && (
              <button
                onClick={() => { setStep('email'); setError(null) }}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {step === 'email' ? 'Entrar no Ritmo' : 'Digite o codigo'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {step === 'email'
                  ? reasonText[reason] || reasonText.default
                  : `Enviamos um codigo de 6 digitos para ${email}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {step === 'email' ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null) }}
                    placeholder="seu@email.com"
                    className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
                <span>Enviar codigo de acesso</span>
              </button>
              <p className="text-xs text-gray-500 text-center">
                Enviaremos um codigo de 6 digitos para seu email.
                <br />
                Sem senha, sem complicacao.
              </p>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Code input boxes */}
              <div className="flex justify-center gap-2.5" onPaste={handleCodePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (codeRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    disabled={loading}
                    className="w-12 h-14 text-center text-2xl font-bold bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors disabled:opacity-50"
                  />
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </div>
              )}

              {/* Resend */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Nao recebeu o codigo?</p>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm text-violet-400 hover:text-violet-300 font-medium disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {resendCooldown > 0
                    ? `Reenviar em ${resendCooldown}s`
                    : 'Reenviar codigo'}
                </button>
              </div>

              <p className="text-xs text-gray-600 text-center">
                Verifique tambem sua caixa de spam.
                <br />
                Em dev, o codigo aparece no terminal do backend.
              </p>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-500 text-center">
            Ao continuar, voce concorda com nossos{' '}
            <span className="text-violet-400 cursor-pointer hover:underline">Termos de Uso</span>
            {' '}e{' '}
            <span className="text-violet-400 cursor-pointer hover:underline">Politica de Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
