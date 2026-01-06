# Ritmo Project - Docker Management Makefile
# Este Makefile facilita o gerenciamento de containers Docker para diferentes ambientes

# Configurações padrão
COMPOSE_FILE_DEV = docker-compose.yml
COMPOSE_FILE_PROD = docker-compose.prod.yml
COMPOSE_FILE_TEST = docker-compose.test.yml
PROJECT_NAME = ritmo

# Cores para output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
BLUE = \033[0;34m
NC = \033[0m # No Color

# Targets padrão
.DEFAULT_GOAL := help
.PHONY: help dev prod test build clean logs status shell backup restore

## Help - Mostra todos os comandos disponíveis
help:
	@echo "$(BLUE)Ritmo Project - Docker Management$(NC)"
	@echo "$(YELLOW)Comandos disponíveis:$(NC)"
	@echo ""
	@echo "$(GREEN)🚀 DESENVOLVIMENTO:$(NC)"
	@echo "  make dev-up          - Sobe containers para desenvolvimento"
	@echo "  make dev-down        - Para containers de desenvolvimento"
	@echo "  make dev-restart     - Reinicia containers de desenvolvimento"
	@echo "  make dev-build       - Reconstrói imagens de desenvolvimento"
	@echo "  make dev-logs        - Mostra logs de desenvolvimento"
	@echo ""
	@echo "$(GREEN)🏭 PRODUÇÃO:$(NC)"
	@echo "  make prod-up         - Sobe containers para produção"
	@echo "  make prod-down       - Para containers de produção"
	@echo "  make prod-restart    - Reinicia containers de produção"
	@echo "  make prod-build      - Reconstrói imagens de produção"
	@echo "  make prod-logs       - Mostra logs de produção"
	@echo ""
	@echo "$(GREEN)🧪 TESTES:$(NC)"
	@echo "  make test-up         - Sobe containers para testes"
	@echo "  make test-down       - Para containers de testes"
	@echo "  make test-run        - Executa suite de testes"
	@echo "  make test-clean      - Limpa ambiente de testes"
	@echo ""
	@echo "$(GREEN)🛠️  UTILITÁRIOS:$(NC)"
	@echo "  make status          - Mostra status de todos os containers"
	@echo "  make logs            - Mostra logs de todos os serviços"
	@echo "  make shell-backend   - Acessa shell do container backend"
	@echo "  make shell-frontend  - Acessa shell do container frontend"
	@echo "  make shell-db        - Acessa shell do banco de dados"
	@echo "  make clean           - Remove containers, volumes e imagens não utilizadas"
	@echo "  make clean-all       - Remove TUDO (cuidado!)"
	@echo ""
	@echo "$(GREEN)💾 BACKUP/RESTORE:$(NC)"
	@echo "  make backup          - Faz backup do banco de dados"
	@echo "  make restore         - Restaura backup do banco de dados"
	@echo ""
	@echo "$(GREEN)🔧 SETUP:$(NC)"
	@echo "  make setup           - Configuração inicial do projeto"
	@echo "  make migrate         - Executa migrações do Django"
	@echo "  make superuser       - Cria superusuário Django"
	@echo "  make collectstatic   - Coleta arquivos estáticos"

# ================================
# DESENVOLVIMENTO
# ================================

## Sobe containers para desenvolvimento
dev-up:
	@echo "$(GREEN)🚀 Subindo containers para desenvolvimento...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) up --build --remove-orphans --force-recreate -d
	@echo "$(GREEN)✅ Containers de desenvolvimento iniciados!$(NC)"
	@echo "$(YELLOW)Frontend: http://localhost:5173$(NC)"
	@echo "$(YELLOW)Backend: http://localhost:8000$(NC)"
	@echo "$(YELLOW)Admin: http://localhost:8000/admin$(NC)"

## Para containers de desenvolvimento
dev-down:
	@echo "$(RED)🛑 Parando containers de desenvolvimento...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) down
	@echo "$(GREEN)✅ Containers de desenvolvimento parados!$(NC)"

## Reinicia containers de desenvolvimento
dev-restart:
	@echo "$(YELLOW)🔄 Reiniciando containers de desenvolvimento...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) restart
	@echo "$(GREEN)✅ Containers de desenvolvimento reiniciados!$(NC)"

## Reconstrói imagens de desenvolvimento
dev-build:
	@echo "$(BLUE)🔨 Reconstruindo imagens de desenvolvimento...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) build --no-cache
	@echo "$(GREEN)✅ Imagens de desenvolvimento reconstruídas!$(NC)"

## Reconstrói e sobe containers de desenvolvimento
dev-rebuild:
	@echo "$(BLUE)🔨 Reconstruindo e subindo containers de desenvolvimento...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) up -d --build
	@echo "$(GREEN)✅ Containers de desenvolvimento reconstruídos e iniciados!$(NC)"

## Mostra logs de desenvolvimento
dev-logs:
	docker-compose -f $(COMPOSE_FILE_DEV) logs -f

## Mostra logs de um serviço específico (ex: make dev-logs-service SERVICE=backend)
dev-logs-service:
	docker-compose -f $(COMPOSE_FILE_DEV) logs -f $(SERVICE)

# ================================
# PRODUÇÃO
# ================================

## Sobe containers para produção
prod-up:
	@echo "$(GREEN)🏭 Subindo containers para produção...$(NC)"
	@if [ ! -f $(COMPOSE_FILE_PROD) ]; then \
		echo "$(RED)❌ Arquivo $(COMPOSE_FILE_PROD) não encontrado!$(NC)"; \
		echo "$(YELLOW)💡 Criando arquivo de produção baseado no desenvolvimento...$(NC)"; \
		$(MAKE) create-prod-compose; \
	fi
	docker-compose -f $(COMPOSE_FILE_PROD) up -d
	@echo "$(GREEN)✅ Containers de produção iniciados!$(NC)"

## Para containers de produção
prod-down:
	@echo "$(RED)🛑 Parando containers de produção...$(NC)"
	docker-compose -f $(COMPOSE_FILE_PROD) down
	@echo "$(GREEN)✅ Containers de produção parados!$(NC)"

## Reinicia containers de produção
prod-restart:
	@echo "$(YELLOW)🔄 Reiniciando containers de produção...$(NC)"
	docker-compose -f $(COMPOSE_FILE_PROD) restart
	@echo "$(GREEN)✅ Containers de produção reiniciados!$(NC)"

## Reconstrói imagens de produção
prod-build:
	@echo "$(BLUE)🔨 Reconstruindo imagens de produção...$(NC)"
	docker-compose -f $(COMPOSE_FILE_PROD) build --no-cache
	@echo "$(GREEN)✅ Imagens de produção reconstruídas!$(NC)"

## Reconstrói e sobe containers de produção
prod-rebuild:
	@echo "$(BLUE)🔨 Reconstruindo e subindo containers de produção...$(NC)"
	docker-compose -f $(COMPOSE_FILE_PROD) up -d --build
	@echo "$(GREEN)✅ Containers de produção reconstruídos e iniciados!$(NC)"

## Mostra logs de produção
prod-logs:
	docker-compose -f $(COMPOSE_FILE_PROD) logs -f

# ================================
# TESTES
# ================================

## Sube containers para testes
test-up:
	@echo "$(GREEN)🧪 Subindo containers para testes...$(NC)"
	@if [ ! -f $(COMPOSE_FILE_TEST) ]; then \
		echo "$(RED)❌ Arquivo $(COMPOSE_FILE_TEST) não encontrado!$(NC)"; \
		echo "$(YELLOW)💡 Criando arquivo de testes baseado no desenvolvimento...$(NC)"; \
		$(MAKE) create-test-compose; \
	fi
	docker-compose -f $(COMPOSE_FILE_TEST) up -d
	@echo "$(GREEN)✅ Containers de testes iniciados!$(NC)"

## Para containers de testes
test-down:
	@echo "$(RED)🛑 Parando containers de testes...$(NC)"
	docker-compose -f $(COMPOSE_FILE_TEST) down
	@echo "$(GREEN)✅ Containers de testes parados!$(NC)"

## Executa suite de testes
test-run:
	@echo "$(BLUE)🧪 Executando testes...$(NC)"
	docker-compose -f $(COMPOSE_FILE_TEST) exec backend python manage.py test
	@echo "$(GREEN)✅ Testes executados!$(NC)"

## Limpa ambiente de testes
test-clean:
	@echo "$(YELLOW)🧹 Limpando ambiente de testes...$(NC)"
	docker-compose -f $(COMPOSE_FILE_TEST) down -v
	@echo "$(GREEN)✅ Ambiente de testes limpo!$(NC)"

# ================================
# UTILITÁRIOS
# ================================

## Mostra status de todos os containers
status:
	@echo "$(BLUE)📊 Status dos containers:$(NC)"
	docker ps -a --filter "name=$(PROJECT_NAME)"

## Mostra logs de todos os serviços
logs:
	docker-compose -f $(COMPOSE_FILE_DEV) logs -f

## Acessa shell do container backend
shell-backend:
	@echo "$(BLUE)🐚 Acessando shell do backend...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec backend bash

## Acessa shell do container frontend
shell-frontend:
	@echo "$(BLUE)🐚 Acessando shell do frontend...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec frontend sh

## Acessa shell do banco de dados
shell-db:
	@echo "$(BLUE)🐚 Acessando shell do PostgreSQL...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec postgres psql -U ritmo_user -d ritmo_db

## Remove containers, volumes e imagens não utilizadas
clean:
	@echo "$(YELLOW)🧹 Limpando containers e volumes não utilizados...$(NC)"
	docker system prune -f
	docker volume prune -f
	@echo "$(GREEN)✅ Limpeza concluída!$(NC)"

## Remove TUDO relacionado ao projeto (CUIDADO!)
clean-all:
	@echo "$(RED)⚠️  ATENÇÃO: Isso irá remover TODOS os containers, volumes e imagens!$(NC)"
	@read -p "Tem certeza? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	docker-compose -f $(COMPOSE_FILE_DEV) down -v --rmi all
	@if [ -f $(COMPOSE_FILE_PROD) ]; then docker-compose -f $(COMPOSE_FILE_PROD) down -v --rmi all; fi
	@if [ -f $(COMPOSE_FILE_TEST) ]; then docker-compose -f $(COMPOSE_FILE_TEST) down -v --rmi all; fi
	docker system prune -af
	@echo "$(GREEN)✅ Tudo removido!$(NC)"

# ================================
# BACKUP/RESTORE
# ================================

## Faz backup do banco de dados
backup:
	@echo "$(BLUE)💾 Fazendo backup do banco de dados...$(NC)"
	@mkdir -p backups
	docker-compose -f $(COMPOSE_FILE_DEV) exec postgres pg_dump -U ritmo_user ritmo_db > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✅ Backup criado em backups/$(NC)"

## Restaura backup do banco de dados (ex: make restore BACKUP=backup_20240101_120000.sql)
restore:
	@if [ -z "$(BACKUP)" ]; then \
		echo "$(RED)❌ Especifique o arquivo de backup: make restore BACKUP=nome_do_arquivo.sql$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)📥 Restaurando backup $(BACKUP)...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec -T postgres psql -U ritmo_user -d ritmo_db < backups/$(BACKUP)
	@echo "$(GREEN)✅ Backup restaurado!$(NC)"

# ================================
# SETUP
# ================================

## Configuração inicial do projeto
setup:
	@echo "$(BLUE)⚙️  Configuração inicial do projeto...$(NC)"
	$(MAKE) dev-up
	@echo "$(YELLOW)⏳ Aguardando containers iniciarem...$(NC)"
	sleep 10
	$(MAKE) migrate
	$(MAKE) superuser
	@echo "$(GREEN)✅ Configuração inicial concluída!$(NC)"

## Executa migrações do Django
migrate:
	@echo "$(BLUE)🔄 Executando migrações...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec backend python manage.py migrate
	@echo "$(GREEN)✅ Migrações executadas!$(NC)"

## Cria superusuário Django
superuser:
	@echo "$(BLUE)👤 Criando superusuário...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec backend python manage.py createsuperuser

## Coleta arquivos estáticos
collectstatic:
	@echo "$(BLUE)📁 Coletando arquivos estáticos...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec backend python manage.py collectstatic --noinput
	@echo "$(GREEN)✅ Arquivos estáticos coletados!$(NC)"

# ================================
# CRIAÇÃO DE ARQUIVOS DE COMPOSE
# ================================

## Cria arquivo docker-compose para produção
create-prod-compose:
	@echo "$(BLUE)📝 Criando docker-compose.prod.yml...$(NC)"
	@cp $(COMPOSE_FILE_DEV) $(COMPOSE_FILE_PROD)
	@echo "$(YELLOW)⚠️  Lembre-se de ajustar as configurações de produção no arquivo $(COMPOSE_FILE_PROD)$(NC)"

## Cria arquivo docker-compose para testes
create-test-compose:
	@echo "$(BLUE)📝 Criando docker-compose.test.yml...$(NC)"
	@cp $(COMPOSE_FILE_DEV) $(COMPOSE_FILE_TEST)
	@echo "$(YELLOW)⚠️  Lembre-se de ajustar as configurações de teste no arquivo $(COMPOSE_FILE_TEST)$(NC)"

# ================================
# MONITORAMENTO
# ================================

## Mostra uso de recursos dos containers
stats:
	@echo "$(BLUE)📈 Uso de recursos dos containers:$(NC)"
	docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

## Mostra informações detalhadas dos containers
inspect:
	@echo "$(BLUE)🔍 Informações dos containers:$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) ps

# ================================
# DESENVOLVIMENTO AVANÇADO
# ================================

## Instala dependências do backend
install-backend:
	@echo "$(BLUE)📦 Instalando dependências do backend...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec backend pip install -r requirements.txt
	@echo "$(GREEN)✅ Dependências do backend instaladas!$(NC)"

## Instala dependências do frontend
install-frontend:
	@echo "$(BLUE)📦 Instalando dependências do frontend...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec frontend npm install
	@echo "$(GREEN)✅ Dependências do frontend instaladas!$(NC)"

## Executa linting no backend
lint-backend:
	@echo "$(BLUE)🔍 Executando linting no backend...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec backend flake8 .

## Executa linting no frontend
lint-frontend:
	@echo "$(BLUE)🔍 Executando linting no frontend...$(NC)"
	docker-compose -f $(COMPOSE_FILE_DEV) exec frontend npm run lint
