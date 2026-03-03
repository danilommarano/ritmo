import { Link } from 'react-router-dom'
import {
  Play, Upload, Music, Zap, Clock, Scissors, Gauge, Eye,
  BarChart3, Layers, Download, ArrowRight, CheckCircle2, Users, Target, Sparkles
} from 'lucide-react'

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="relative z-50 px-6 py-5 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Ritmo</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#como-funciona" className="text-sm text-gray-400 hover:text-white transition-colors">Como funciona</a>
            <a href="#recursos" className="text-sm text-gray-400 hover:text-white transition-colors">Recursos</a>
            <a href="#para-quem" className="text-sm text-gray-400 hover:text-white transition-colors">Para quem</a>
            <Link
              to="/upload"
              className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-medium rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/25"
            >
              Comece agora
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative px-6 pt-20 pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Estude ritmo como nunca antes</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
            <span className="text-white">Domine o ritmo.</span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              Quadro a quadro.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            O Ritmo detecta automaticamente o BPM do seu video, marca cada compasso
            na timeline e permite que voce desacelere, corte e estude
            cada movimento com precisao musical.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/upload"
              className="group px-8 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-full font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/25 flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Envie seu video
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#como-funciona"
              className="px-8 py-4 border border-white/15 text-white rounded-full font-semibold hover:bg-white/5 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Veja como funciona
            </a>
          </div>

          {/* Hero visual — mock editor */}
          <div className="relative max-w-4xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-gray-900/80 backdrop-blur-sm shadow-2xl shadow-violet-500/10 overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-gray-900">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-gray-500 ml-3">Ritmo Editor</span>
              </div>
              {/* Content */}
              <div className="p-6 flex flex-col gap-4">
                {/* Video preview area */}
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-fuchsia-600/10 rounded-xl" />
                  <div className="text-center space-y-3 relative z-10">
                    <div className="w-16 h-16 bg-violet-600/20 backdrop-blur rounded-full flex items-center justify-center mx-auto border border-violet-500/30">
                      <Play className="w-7 h-7 text-violet-400 ml-1" />
                    </div>
                    <p className="text-gray-400 text-sm">Preview do seu video com overlays de BPM</p>
                  </div>
                  {/* BPM badge */}
                  <div className="absolute top-3 right-3 px-3 py-1 bg-violet-600/90 rounded-lg text-xs font-bold tracking-wider">
                    128 BPM
                  </div>
                  {/* Bar counter */}
                  <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 rounded-lg text-xs font-mono text-fuchsia-300">
                    4.2
                  </div>
                </div>
                {/* Timeline mock */}
                <div className="h-16 bg-gray-800/60 rounded-xl flex items-center px-4 gap-1 overflow-hidden">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 rounded-sm"
                      style={{
                        width: '3px',
                        height: `${20 + Math.sin(i * 0.5) * 18 + Math.random() * 10}px`,
                        background: i >= 12 && i <= 20
                          ? 'linear-gradient(to top, #8b5cf6, #d946ef)'
                          : 'rgba(255,255,255,0.12)',
                      }}
                    />
                  ))}
                  {/* Playhead */}
                  <div className="absolute left-1/3 w-0.5 h-12 bg-fuchsia-400 rounded-full" />
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-pink-600/20 rounded-3xl blur-3xl -z-10" />
          </div>
        </div>

        {/* Background decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-600/15 to-transparent rounded-full blur-3xl -z-10" />
      </section>

      {/* ─── Social proof bar ─── */}
      <section className="px-6 py-10 border-y border-white/5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            <span>Para <strong className="text-white">dancarinos</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-fuchsia-400" />
            <span>Para <strong className="text-white">musicos</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-400" />
            <span>Para <strong className="text-white">professores</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Para <strong className="text-white">coreografos</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-fuchsia-400" />
            <span>Para <strong className="text-white">atletas</strong></span>
          </div>
        </div>
      </section>

      {/* ─── Como funciona ─── */}
      <section id="como-funciona" className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              3 passos. Zero complicacao.
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Do upload a analise completa em menos de 2 minutos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Upload,
                title: 'Envie seu video',
                desc: 'Faca upload de qualquer video de danca, ensaio, apresentacao ou treino. MP4, MOV, AVI — todos aceitos.',
                color: 'from-violet-500 to-violet-600',
              },
              {
                step: '02',
                icon: BarChart3,
                title: 'BPM detectado automaticamente',
                desc: 'Nossa IA analisa o audio, detecta o BPM e marca cada compasso diretamente na timeline do editor.',
                color: 'from-fuchsia-500 to-fuchsia-600',
              },
              {
                step: '03',
                icon: Scissors,
                title: 'Estude quadro a quadro',
                desc: 'Desacelere trechos, corte por compasso, adicione contadores e exporte o resultado com todos os overlays.',
                color: 'from-pink-500 to-pink-600',
              },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="p-8 rounded-2xl border border-white/5 bg-gray-900/50 hover:bg-gray-900/80 transition-all duration-300 hover:border-violet-500/20 h-full">
                  <div className="text-5xl font-black text-white/5 mb-4">{item.step}</div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-5`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Recursos ─── */}
      <section id="recursos" className="px-6 py-24 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tudo que voce precisa para estudar ritmo
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Ferramentas profissionais pensadas para quem leva a serio o estudo de movimento e musicalidade.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: 'Deteccao automatica de BPM',
                desc: 'Algoritmo avancado que analisa o audio e detecta BPM e downbeat com precisao.',
                color: 'text-violet-400 bg-violet-500/10',
              },
              {
                icon: Clock,
                title: 'Contador de compassos',
                desc: 'Overlay de compasso.tempo sincronizado com a musica, visivel durante a reproducao e na exportacao.',
                color: 'text-fuchsia-400 bg-fuchsia-500/10',
              },
              {
                icon: Gauge,
                title: 'Velocidade por segmento',
                desc: 'Desacelere trechos especificos a 0.25x, 0.5x ou qualquer velocidade para estudar cada detalhe.',
                color: 'text-pink-400 bg-pink-500/10',
              },
              {
                icon: Scissors,
                title: 'Corte e duplicacao',
                desc: 'Corte o video na posicao atual, duplique trechos dificeis e remova o que nao interessa.',
                color: 'text-violet-400 bg-violet-500/10',
              },
              {
                icon: Layers,
                title: 'Elementos visuais',
                desc: 'Adicione texto, cronometro, alertas e marcadores visuais em qualquer ponto do video.',
                color: 'text-fuchsia-400 bg-fuchsia-500/10',
              },
              {
                icon: Eye,
                title: 'Waveform na timeline',
                desc: 'Visualize a forma de onda do audio com marcadores de compasso para alinhar cortes com a batida.',
                color: 'text-pink-400 bg-pink-500/10',
              },
              {
                icon: Download,
                title: 'Exportacao com overlays',
                desc: 'Exporte o video final com todos os elementos visuais renderizados em alta qualidade via FFmpeg.',
                color: 'text-violet-400 bg-violet-500/10',
              },
              {
                icon: Zap,
                title: 'Undo / Redo completo',
                desc: 'Historico de acoes com desfazer e refazer ilimitado. Copiar, colar e duplicar elementos.',
                color: 'text-fuchsia-400 bg-fuchsia-500/10',
              },
              {
                icon: Music,
                title: 'Selecao por compasso',
                desc: 'Selecione trechos pela regua de compassos, nao por tempo. Pense musicalmente.',
                color: 'text-pink-400 bg-pink-500/10',
              },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/5 bg-gray-900/30 hover:bg-gray-900/60 transition-all duration-300 hover:border-violet-500/15">
                <div className={`w-10 h-10 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Para quem ─── */}
      <section id="para-quem" className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Para quem e o Ritmo?
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Qualquer pessoa que estuda movimento sincronizado com musica.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                title: 'Dancarinos',
                items: [
                  'Estudar coreografias compasso por compasso',
                  'Desacelerar trechos rapidos para aprender footwork',
                  'Contar tempos musicais em cima do video',
                  'Comparar versoes em velocidades diferentes',
                ],
              },
              {
                title: 'Musicos e bateristas',
                items: [
                  'Analisar o BPM de qualquer performance',
                  'Estudar grooves e padroes ritmicos visualmente',
                  'Marcar secoes por compasso para pratica',
                  'Exportar trechos com metronomos visuais',
                ],
              },
              {
                title: 'Professores e coreografos',
                items: [
                  'Criar material didatico com contagem visual',
                  'Exportar videos com marcacao de compassos',
                  'Segmentar coreografias por trecho musical',
                  'Compartilhar versoes em camera lenta com alunos',
                ],
              },
              {
                title: 'Atletas e treinadores',
                items: [
                  'Estudar timing em ginastica ritmica',
                  'Analisar sincronia em nado sincronizado',
                  'Avaliar ritmo em patinacao artistica',
                  'Revisar coreografias de grupo quadro a quadro',
                ],
              },
            ].map((group, i) => (
              <div key={i} className="p-8 rounded-2xl border border-white/5 bg-gray-900/40">
                <h3 className="text-xl font-bold mb-5 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {group.title}
                </h3>
                <ul className="space-y-3">
                  {group.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-gray-300 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Final ─── */}
      <section className="px-6 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-6 leading-tight">
            Pronto para dominar
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              cada batida?
            </span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Envie seu video agora e comece a estudar ritmo com as ferramentas
            que voce sempre quis. Sem necessidade de cadastro para comecar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/upload"
              className="group px-8 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-full font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/25 flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Comece agora — e gratis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold">Ritmo</span>
            </div>
            <p className="text-gray-500 text-sm">
              Estude ritmo com precisao. Feito para quem leva movimento a serio.
            </p>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Termos</a>
              <a href="#" className="hover:text-white transition-colors">Contato</a>
            </div>
          </div>
          <div className="mt-8 text-center text-gray-600 text-xs">
            &copy; 2025 Ritmo. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
