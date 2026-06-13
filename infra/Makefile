.DEFAULT_GOAL := help
COMPOSE := docker compose -f docker-compose.yml
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml
DEV_SERVICES := postgres redis backend worker frontend

.PHONY: help setup build start stop restart logs ps dev dev-down dev-logs clean

help:
	@echo ""
	@echo "  OptiMark — self-hosted deployment"
	@echo ""
	@echo "  Production:"
	@echo "    make setup    Copy .env.example -> .env (edit before first run)"
	@echo "    make build    Build all Docker images"
	@echo "    make start    Start all services (detached)"
	@echo "    make stop     Stop all services"
	@echo "    make restart  Restart all services"
	@echo "    make logs     Follow logs"
	@echo "    make ps       Show running containers"
	@echo ""
	@echo "  Development (hot reload, no build):"
	@echo "    make dev      Start dev stack (api+worker reload, vite at :5173)"
	@echo "    make dev-down Stop the dev stack"
	@echo "    make dev-logs Follow dev logs"
	@echo ""
	@echo "    make clean    Remove containers + volumes (DESTROYS DATA)"
	@echo ""

setup:
	@if [ -f .env ]; then \
		echo ".env already exists — skipping (edit it manually if needed)"; \
	else \
		cp .env.example .env; \
		echo "Created .env from .env.example — edit it before running 'make start'"; \
	fi

build:
	$(COMPOSE) build

start: _require_env
	$(COMPOSE) up -d

stop:
	$(COMPOSE) down

restart: stop start

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

dev: _require_env
	$(COMPOSE_DEV) up $(DEV_SERVICES)

dev-down:
	$(COMPOSE_DEV) down

dev-logs:
	$(COMPOSE_DEV) logs -f

clean:
	@echo "WARNING: this will delete all volumes including the database."
	@read -p "Type YES to confirm: " confirm && [ "$$confirm" = "YES" ]
	$(COMPOSE) down -v

_require_env:
	@if [ ! -f .env ]; then \
		echo "Error: .env not found. Run 'make setup' first."; \
		exit 1; \
	fi
