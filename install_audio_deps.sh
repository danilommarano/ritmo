#!/bin/bash
# Script para instalar dependências de análise de áudio

echo "Instalando dependências de análise de áudio..."
cd backend
pip install librosa==0.10.1 soundfile==0.12.1 numba==0.58.1

echo ""
echo "✅ Dependências instaladas com sucesso!"
echo ""
echo "Agora você pode usar a detecção automática de BPM."
