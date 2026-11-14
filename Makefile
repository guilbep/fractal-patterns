.DEFAULT_GOAL := help
.PHONY: help install dev lint format format-check typecheck test build preview perf ci clean logo palettes e2e contrast gallery

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

gallery: ## Write the Studio gallery (MAP-Elites, about 30 s): public/gallery/studio.json and its tile thumbnails
	node scripts/studio-gallery.ts

palettes: ## Write src/palettes-data.ts from PALETTE_SPECS (src/palettes.ts)
	npm run palettes

logo: ## Write public/favicon.svg from the logo mark (src/logo.ts)
	npm run logo

contrast: ## Print the contrast ratios of the color tokens in src/css/app.css, fail under 4.5 (text) or 3 (non-text)
	node scripts/check-contrast.ts

preview: build ## Build, then serve dist locally
	npx vite preview

e2e: ## Build, serve dist and run the Playwright browser tests
	npm run e2e

perf: ## Build, then print the Lighthouse mobile median of 3 runs per page
	npm run build
	node perf/lighthouse.mjs

ci: ## Run lint, format-check, typecheck, test and build, like the GitHub workflow
	$(MAKE) lint
	$(MAKE) format-check
	$(MAKE) typecheck
	$(MAKE) test
	$(MAKE) build

clean: ## Remove dist
	rm -rf dist
