.DEFAULT_GOAL := help
.PHONY: help install dev lint format format-check typecheck test build preview ci clean

help: ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-13s %s\n", $$1, $$2}'

install: ## Install the dependencies from package-lock.json (npm ci)
	npm ci

dev: ## Start the Vite development server
	npm run dev

lint: ## Lint src with oxlint
	npm run lint

format: ## Format the source with oxfmt
	npm run format

format-check: ## Check the formatting without writing
	npm run format:check

typecheck: ## Type-check the TypeScript and Vue files
	npm run typecheck

test: ## Run the unit tests with node --test
	npm test

build: ## Build the site into dist
	npm run build

preview: build ## Build, then serve dist locally
	npx vite preview

ci: ## Run lint, format-check, typecheck, test and build, like the GitHub workflow
	$(MAKE) lint
	$(MAKE) format-check
	$(MAKE) typecheck
	$(MAKE) test
	$(MAKE) build

clean: ## Remove dist
	rm -rf dist
