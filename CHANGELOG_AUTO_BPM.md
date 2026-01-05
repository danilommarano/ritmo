# Changelog - Detecção Automática de BPM

## 🎉 Nova Funcionalidade: Análise Automática de Áudio

### O que mudou?

Anteriormente, o sistema gravava o BPM manualmente através do Tap Tempo (pressionar ESPAÇO no ritmo). Agora, o sistema pode **analisar automaticamente o áudio do vídeo** para detectar as batidas e calcular o BPM.

### Por que essa mudança?

Alguns vídeos apresentam oscilação na frequência do BPM - o que estava bom no início pode estar errado no final. Com a detecção automática:

- ✅ **BPM Variável**: Cada batida é detectada individualmente, não mais uma constante
- ✅ **Precisão**: Algoritmos de análise de áudio (librosa) detectam batidas com alta precisão
- ✅ **Automático**: Não precisa mais gravar manualmente batida por batida
- ✅ **Adaptável**: Funciona com músicas que mudam de tempo

### Como funciona?

1. **Extração de Áudio**: O sistema extrai o áudio do vídeo usando FFmpeg
2. **Análise de Onset**: Usa librosa para detectar aumentos súbitos de energia (batidas)
3. **Estimativa de BPM**: Calcula o BPM médio baseado nos intervalos entre batidas
4. **Beat Tracking**: Identifica cada batida individual com timestamp exato
5. **Confiança**: Calcula um score de confiança baseado na consistência das batidas

### Arquivos Criados/Modificados

#### Backend
- **`videos/audio_analyzer.py`** (NOVO): Módulo de análise de áudio
  - `extract_audio_from_video()`: Extrai áudio do vídeo
  - `detect_beats_and_bpm()`: Detecta batidas e estima BPM
  - `analyze_video_audio()`: Pipeline completo de análise
  - `calculate_beat_confidence()`: Calcula confiança da detecção

- **`videos/views.py`** (MODIFICADO):
  - Novo endpoint: `POST /api/videos/{id}/analyze_audio/`
  - Cria automaticamente RhythmGrid e BeatMarkers

- **`videos/video_processor.py`** (MODIFICADO):
  - `export_with_variable_bpm()`: Exporta usando beat markers variáveis
  - `export_with_constant_bpm()`: Fallback para BPM constante
  - `format_srt_time()`: Formata timestamps para subtitles
  - Usa subtitles (SRT) para aplicar contador variável no vídeo

- **`requirements.txt`** (MODIFICADO):
  - Adicionado: `librosa==0.10.1` (análise de áudio)
  - Adicionado: `soundfile==0.12.1` (I/O de áudio)
  - Adicionado: `numba==0.58.1` (otimização)

#### Frontend
- **`pages/RhythmEditor.jsx`** (MODIFICADO):
  - Novo estado: `isAnalyzing`, `analysisResult`
  - Nova função: `analyzeAudio()` - chama endpoint de análise
  - Nova seção na UI: "Detecção Automática (Recomendado)"
  - Mostra resultado da análise (BPM, batidas, confiança)

- **`pages/RhythmEditor.css`** (MODIFICADO):
  - Estilos para `.auto-detect-section`
  - Estilos para `.btn-analyze`
  - Estilos para `.analysis-result`

#### Outros
- **`install_audio_deps.sh`** (NOVO): Script para instalar dependências
- **`CHANGELOG_AUTO_BPM.md`** (NOVO): Este arquivo
- **`ToDo.txt`** (MODIFICADO): Documentação atualizada

### Como usar?

#### 1. Instalar Dependências
```bash
chmod +x install_audio_deps.sh
./install_audio_deps.sh
```

#### 2. No Editor de Ritmo
1. Clique em "🔍 Analisar Áudio Automaticamente"
2. Aguarde a análise (pode levar alguns segundos)
3. Revise os resultados:
   - BPM detectado
   - Número de batidas
   - Confiança da detecção
4. Se a confiança for alta (>70%), está pronto!
5. Se a confiança for baixa, você pode:
   - Usar gravação manual (Tap Tempo)
   - Ajustar manualmente os valores

#### 3. Exportar
- Clique em "Exportar Vídeo Completo com Contador"
- O sistema usará os beat markers variáveis automaticamente
- Cada batida terá seu timestamp exato no vídeo

### Detalhes Técnicos

#### Algoritmo de Detecção
O sistema usa o algoritmo de beat tracking do librosa que:
1. Calcula o onset strength envelope (energia das notas)
2. Aplica autocorrelação para encontrar periodicidades
3. Usa programação dinâmica para rastrear batidas
4. Retorna BPM médio e timestamps de cada batida

#### Exportação com BPM Variável
- Cria um arquivo SRT (subtitles) com cada batida
- Cada entrada do SRT mostra "Compasso X | Batida Y"
- FFmpeg queima as subtitles no vídeo usando o filtro `subtitles`
- Cada batida aparece exatamente no momento detectado

#### Fallback
Se não houver beat markers, o sistema usa o método antigo:
- BPM constante calculado pela fórmula
- Contador baseado em tempo decorrido
- Funciona como antes da atualização

### Limitações Conhecidas

- **Músicas complexas**: Pode ter dificuldade com músicas muito complexas ou sem batida clara
- **Ruído**: Vídeos com muito ruído de fundo podem afetar a detecção
- **Tempo de processamento**: Análise pode levar alguns segundos para vídeos longos
- **Memória**: Vídeos muito longos podem consumir bastante memória

### Próximos Passos Sugeridos

- [ ] Adicionar visualização das batidas detectadas no timeline
- [ ] Permitir edição manual das batidas detectadas
- [ ] Adicionar opção de refinar detecção com segundo passe
- [ ] Implementar cache de análises para não reprocessar
- [ ] Adicionar suporte para detecção de downbeats (primeira batida do compasso)

### Compatibilidade

- ✅ Totalmente compatível com sistema anterior
- ✅ Gravação manual (Tap Tempo) ainda funciona
- ✅ Configuração manual ainda funciona
- ✅ Vídeos antigos continuam funcionando
- ✅ Novo sistema é opcional (recomendado, mas não obrigatório)

---

**Data**: 23/12/2024  
**Versão**: 2.0 - Auto BPM Detection
