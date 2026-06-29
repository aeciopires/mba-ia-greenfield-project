.PHONY: help install up down logs test test-e2e lint typecheck migrate seed

NESTJS = docker compose -f nestjs-project/compose.yaml exec nestjs-api
FRONTEND = docker compose -f next-frontend/compose.yaml exec next-frontend

help:
	@echo "StreamTube development targets:"
	@echo ""
	@echo "  make install       Install all dependencies (backend + frontend)"
	@echo "  make up            Start all services in background"
	@echo "  make down          Stop all services"
	@echo "  make logs          Tail logs for all services"
	@echo "  make test          Run all tests (backend unit + integration + E2E + frontend)"
	@echo "  make test-backend  Run backend unit + integration tests"
	@echo "  make test-e2e      Run NestJS E2E tests"
	@echo "  make test-frontend Run frontend Vitest tests"
	@echo "  make lint          Lint both subprojects"
	@echo "  make typecheck     TypeScript type-check both subprojects"
	@echo "  make migrate       Run all pending database migrations"
	@echo "  make seed          Seed the database with sample data"
	@echo ""

install:
	docker compose -f nestjs-project/compose.yaml up -d
	$(NESTJS) npm install
	docker compose -f next-frontend/compose.yaml up -d
	$(FRONTEND) npm install

up:
	docker compose -f nestjs-project/compose.yaml up -d
	docker compose -f next-frontend/compose.yaml up -d

down:
	docker compose -f nestjs-project/compose.yaml down
	docker compose -f next-frontend/compose.yaml down

logs:
	docker compose -f nestjs-project/compose.yaml logs -f

test: test-backend test-e2e test-frontend

test-backend:
	$(NESTJS) npm test -- --runInBand

test-e2e:
	$(NESTJS) npm run test:e2e

test-frontend:
	$(FRONTEND) npm test

lint:
	$(NESTJS) npm run lint
	$(FRONTEND) npm run lint

typecheck:
	$(NESTJS) npx tsc --noEmit
	$(FRONTEND) node_modules/.bin/tsc --noEmit

migrate:
	$(NESTJS) npm run migration:run

seed:
	$(NESTJS) npm run seed
