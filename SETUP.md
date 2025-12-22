# Guia de Instalação e Uso - Ritmo

## 🚀 Como Executar

### Pré-requisitos
- Docker
- Docker Compose

### Iniciar o Projeto

```bash
# Clone o repositório
git clone <repo-url>
cd ritmo

# Inicie os containers
docker-compose up -d

# Execute as migrações (primeira vez)
docker exec ritmo_backend python manage.py migrate

# Crie um usuário admin (primeira vez)
docker exec -it ritmo_backend python manage.py createsuperuser --username admin --email admin@ritmo.com --noinput
docker exec ritmo_backend python manage.py shell -c "from django.contrib.auth.models import User; u = User.objects.get(username='admin'); u.set_password('admin123'); u.save()"
```

### Acessar a Aplicação

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api/
- **Admin Django**: http://localhost:8000/admin/
  - Username: `admin`
  - Senha: `admin123`
- **API Docs**: http://localhost:8000/api/docs/

## 🎵 Funcionalidades Implementadas

### ✅ Upload de Vídeos
- Suporte para MP4, AVI, MOV, MKV e WEBM (até 500MB)
- Processamento automático de metadados (duração, fps, dimensões)
- Interface drag-and-drop intuitiva

### ✅ Editor de Ritmo
- **Configuração de BPM**: Defina as batidas por minuto da música
- **Fórmula de Compasso**: Configure compassos personalizados (4/4, 3/4, 6/8, etc.)
- **Offset de Início**: Ajuste quando o primeiro compasso começa
- **Preview em Tempo Real**: Veja o contador de compasso e batida enquanto o vídeo toca
- **Marcação Interativa**: Use "Usar tempo atual" para marcar pontos precisos

### ✅ Exportação de Vídeo
- Selecione início e fim do trecho desejado
- Exporte com contador visual sobreposto
- Download automático do arquivo processado
- Contador mostra: "Compasso X | Batida Y"

## 📖 Como Usar

### 1. Upload de Vídeo
1. Clique em **"+ Upload"** no header
2. Selecione um arquivo de vídeo do seu computador
3. Preencha o título (obrigatório) e descrição (opcional)
4. Clique em **"Fazer Upload"**
5. Aguarde o processamento - você será redirecionado automaticamente para o editor

### 2. Configurar Ritmo no Editor

#### Passo a Passo:
1. **Reproduza o vídeo** e identifique o ritmo da música
2. **Configure o BPM**:
   - Use um metrônomo ou app de detecção de BPM
   - Ou conte as batidas: (batidas em 15 segundos) × 4 = BPM
3. **Configure a Fórmula de Compasso**:
   - Músicas comuns: 4/4 (rock, pop, samba)
   - Valsa: 3/4
   - Outros: 6/8, 5/4, etc.
4. **Ajuste o Início do Ritmo**:
   - Reproduza o vídeo até o primeiro compasso
   - Clique em "Usar tempo atual" no campo "Início do Ritmo"
5. **Salve a Configuração**

#### Dicas:
- Use o botão de play/pause para navegar pelo vídeo
- O contador mostra "Compasso" e "Batida" em tempo real
- Antes do offset, mostra "Aguardando início..."

### 3. Exportar Vídeo com Contador

1. **Defina o Trecho**:
   - Navegue até o início desejado → "Usar tempo atual" em "Tempo Inicial"
   - Navegue até o fim desejado → "Usar tempo atual" em "Tempo Final"
2. **Verifique a Duração**: Aparece automaticamente abaixo
3. **Clique em "Exportar com Contador"**
4. **Aguarde o Processamento**: Pode levar alguns minutos dependendo do tamanho
5. **Download Automático**: O arquivo será baixado automaticamente

## 🏗️ Arquitetura Técnica

### Backend (Django + DRF)
- **Framework**: Django 5.0.1 + Django REST Framework
- **Banco de Dados**: PostgreSQL 15
- **Processamento**: FFmpeg via ffmpeg-python
- **Estrutura**:
  ```
  backend/
  ├── videos/
  │   ├── models.py           # Video, RhythmGrid, Fragment
  │   ├── views.py            # API endpoints
  │   ├── serializers.py      # Serialização
  │   └── video_processor.py  # Processamento FFmpeg
  └── ritmo/                  # Configurações Django
  ```

### Frontend (React + Vite)
- **Framework**: React 18 + React Router v6
- **Build**: Vite 5
- **Estilização**: CSS + TailwindCSS
- **Componentes**:
  ```
  frontend/src/
  ├── components/
  │   └── Layout.jsx          # Header, Footer
  └── pages/
      ├── VideoLibrary.jsx    # Lista de vídeos
      ├── VideoUpload.jsx     # Upload
      └── RhythmEditor.jsx    # Editor + Exportação
  ```

### DevOps
- **Docker Compose** com 3 serviços:
  - `frontend`: React (porta 5173)
  - `backend`: Django (porta 8000)
  - `postgres`: PostgreSQL (porta 5432)

## 📝 API Endpoints Principais

### Vídeos
```
GET    /api/videos/videos/                      # Listar vídeos
POST   /api/videos/videos/                      # Upload
GET    /api/videos/videos/{id}/                 # Detalhes
POST   /api/videos/videos/{id}/process_metadata/ # Processar
POST   /api/videos/videos/{id}/export_with_counter/ # Exportar
```

### Rhythm Grid
```
GET    /api/videos/videos/{id}/rhythm_grid/           # Obter
POST   /api/videos/videos/{id}/create_rhythm_grid/    # Criar/Atualizar
```

## 🔧 Tecnologias

### Backend
- Python 3.11
- Django 5.0.1
- Django REST Framework 3.14
- PostgreSQL 15
- FFmpeg
- ffmpeg-python 0.2.0

### Frontend
- React 18
- React Router v6
- Vite 5
- TailwindCSS 3

## 🐛 Troubleshooting

### Vídeo não processa
- Verifique se o FFmpeg está instalado no container
- Verifique os logs: `docker logs ritmo_backend`

### Upload falha
- Verifique o tamanho do arquivo (máx 500MB)
- Verifique o formato (MP4, AVI, MOV, MKV, WEBM)

### Exportação demora muito
- Normal para vídeos grandes
- O processamento acontece no servidor
- Aguarde a conclusão

### Contador não aparece no preview
- Verifique se salvou a configuração de ritmo
- Verifique se o tempo atual está após o offset

## 📄 Licença

MIT License

## 👨‍💻 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.
