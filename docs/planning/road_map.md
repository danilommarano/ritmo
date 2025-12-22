# 📐 Roteiro de Planejamento do Sistema — **Ritmo**

## 1. Visão Geral do Sistema

### Objetivo central

Criar um **editor de vídeo orientado a ritmo**, que permita estudar dança e música por meio de:

* marcação de compassos,
* navegação rítmica,
* fragmentação do conteúdo,
* classificação técnica dos trechos.

O Ritmo **não é um editor genérico**, ele é um **ambiente de estudo**.

---

## 2. Princípios de Design (guia de decisões)

Esses princípios devem guiar TODA decisão técnica:

1. **Ritmo é a estrutura principal**, não o tempo linear do vídeo
2. **Tudo deve ser reversível e editável**
3. **Manual primeiro, automático depois**
4. **Terminologia clara (sem confundir dança e música)**
5. **Dados estruturados desde o MVP**

---

## 3. Escopo Funcional (MVP)

### 3.1 O que o MVP FAZ

✔ Upload de vídeo \
✔ Reprodução com controle de velocidade \
✔ Definição manual de ritmo \
✔ Criação de grade de compassos \
✔ Navegação por compasso \
✔ Criação de fragmentos (clips lógicos) \
✔ Nomeação e classificação dos fragmentos

### 3.2 O que o MVP NÃO faz

✖ IA \
✖ Reconhecimento automático de movimento \
✖ Edição estética de vídeo \
✖ Rede social \
✖ Colaboração em tempo real

---

## 4. Modelo Conceitual (núcleo do sistema)

### 4.1 Entidades principais

#### **Video**

Representa o arquivo base.

Campos essenciais:

* id
* owner_id
* duration
* fps
* file_url
* created_at

---

#### **RhythmGrid**

Define **como o tempo é organizado** naquele vídeo.

Campos:

* video_id
* bpm
* time_signature_numerator (ex: 4)
* time_signature_denominator (ex: 4)
* offset_start (timestamp do tempo 1)
* beats_per_bar (derivado)
* beat_duration_ms
* bar_duration_ms

> ⚠️ A RhythmGrid é independente do vídeo → isso permite recalcular, editar, duplicar.

---

#### **Bar (Compasso)**

Pode ser **calculado dinamicamente** ou persistido.

Campos lógicos:

* index (0, 1, 2…)
* start_time
* end_time

---

#### **Fragment (Clip de estudo)**

Unidade pedagógica.

Campos:

* video_id
* bar_start
* bar_end
* name
* description
* tags[]
* created_at

> Fragmentos **não são cortes físicos**, são **recortes semânticos**.

---

## 5. Fluxo do Usuário (passo a passo)

### 5.1 Upload

1. Usuário seleciona vídeo
2. Backend:

   * salva arquivo
   * extrai metadata (duração, fps)
   * gera preview

---

### 5.2 Criação da Grade Rítmica (parte crítica)

UI guiada:

1. Usuário informa:

   * BPM
   * fórmula de compasso (default: 4/4)
2. Usuário aperta “marcar o 1” no player
3. Sistema:

   * salva `offset_start`
   * calcula duração de tempo e compasso
   * gera a grade inteira

🔑 **Aqui está o coração do Ritmo**

---

### 5.3 Navegação rítmica

O player passa a funcionar assim:

* Próximo compasso
* Compasso anterior
* Loop:

  * 1 compasso
  * N compassos
* Velocidade: 0.25x, 0.5x, 1x

---

### 5.4 Criação de fragmentos

1. Usuário seleciona:

   * compasso inicial
   * compasso final
2. Usuário nomeia:

   * técnica / passo / trecho musical
3. Usuário adiciona tags

Resultado:

> “Esse vídeo agora é um **mapa de estudo**”

---

## 6. UX essencial (sem exagero)

### Telas mínimas

1. Biblioteca de vídeos
2. Player + timeline rítmica
3. Painel de fragmentos
4. Modal de criação/edição de fragmento

### Regras UX importantes

* Compassos sempre visíveis
* Contagem clara (1, 2, 3, 4…)
* Nunca esconder o tempo do usuário
* Ritmo > segundos

---

## 7. Planejamento Técnico (alto nível)

### Frontend

* Player de vídeo customizado
* Timeline baseada em compassos (não segundos)
* Estado sincronizado: vídeo ↔ grade rítmica

### Backend

* Upload e storage
* Persistência de RhythmGrid e Fragment
* Jobs assíncronos (metadata, thumbnails)

### Processamento

* FFmpeg:

  * metadata
  * cortes futuros
* Extração de áudio (base para IA futura)

---

## 8. Organização por Fases de Desenvolvimento

### Fase 1 — Fundação

* Upload
* Player
* Persistência básica

### Fase 2 — Ritmo

* Grade rítmica
* Navegação por compasso
* Loop

### Fase 3 — Estudo

* Fragmentos
* Classificação
* Biblioteca

### Fase 4 — Expansão

* Export
* Compartilhamento
* IA (BPM / downbeat)

---

## 9. Preparação para IA (sem implementar ainda)

Desde o MVP, **prepare os dados**:

* Áudio extraído
* BPM salvo
* Offset salvo
* Histórico de ajustes manuais

Isso permite:

* Treinar modelos
* Corrigir automaticamente
* Aprender com usuários reais

---

## 10. Critério de sucesso do MVP

O Ritmo está funcionando quando:

* Um dançarino consegue estudar **passo por passo**
* Um músico consegue isolar **técnicas específicas**
* O usuário sente que:

  > “Agora eu entendo o que estou fazendo no tempo”

---

## 11. Essência do sistema (guarde isso)

> **Ritmo não é sobre editar vídeos.
> É sobre transformar tempo em entendimento.**

---

### Próximo passo (recomendado)

Se você quiser, no próximo prompt eu posso:

* desenhar o **modelo de banco (SQL)**
* escrever o **algoritmo de geração da grade rítmica**
* definir a **API mínima (endpoints)**
* ou montar um **roadmap técnico por stack (web/mobile)**

👉 Qual desses você quer atacar agora?


