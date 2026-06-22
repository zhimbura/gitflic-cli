# Changelog

## 0.2.0 — unreleased

- **CI/CD выпилен.** Удалён `gitflic-ci.yaml` и страница `docs/ci-cd.md`. На публичном `gitflic.ru` нет shared runners, а self-hosted `runner.jar` требует платный VPS — не наш путь. Вместо этого:
  - `npm run build` (`scripts/build.mjs`): локальный lint всех `.mjs`, JSON-валидация, `vitest`, `tar.gz` portable-бандла в `dist/`.
  - `npm run release -- --version X.Y.Z` (`scripts/release.mjs`): бамп `package.json`, пересборка, копия tar.gz в `docs/releases/`, пересборка `docs/releases/index.html`.
  - Документация хостится на **Timeweb Apps** (статический preset `another`, `index_dir=/`); артефакты сборки лежат в той же статике — без S3.
- **CLI bug-fix:** `gitflic cicd pipeline list` в pretty-режиме показывал `(no pipelines)`, хотя в JSON были записи. Виновник — embedded-ключ `pipelineList` (реальный GitFlic HAL — `restPipelineModelList`). Поправлено в `lib/cmd/cicd.mjs`, со старыми ключами как fallback.
- **docs/known-issues.md:** отмечены `cicd pipeline <id>` и `cicd jobs <id>` (GitFlic REST 404 — нет публичного эндпоинта).
- **docs/releases/:** новая секция с описанием workflow и index.html со списком артефактов (рендерится `release.mjs`).
- **README:** обновлён — убраны упоминания GitFlic CI.

## 0.1.0 — 2026-06-22

- **Initial release.** ~125 GitFlic REST endpoints wrapped under 20 top-level modules.
- Zero external dependencies (pure Node ESM ≥ 18, uses global `fetch`).
- Modules: `mr`, `branch`, `tag`, `release`, `issue`, `commit`, `blob`, `settings`, `user`, `project`, `team`, `company`, `environment`, `webhook`, `registry`, `cicd`, `runner`, `admin`, `saml`, `auth`.
- `gitflic mr <id> --format json | jq` style for AI agents.
- `--project owner/alias` flag (or auto-detect from `git remote get-url origin`).
- 57% coverage of the documented public REST surface (see README table).
