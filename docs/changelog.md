# Changelog

Все значимые изменения в `gitflic-cli`. Формат — приближённый к [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed

- **CI: переехали с `.gitlab-ci.yml` на `gitflic-ci.yaml`** — это **обязательное имя файла** для GitFlic CI (см. [docs](https://docs.gitflic.ru/en/cicd/pipeline/) и [CI/CD Settings](https://docs.gitflic.ru/en/cicd/cicd-settings/)). Старое имя `.gitlab-ci.yml` GitFlic в упор не видит, поэтому предыдущая версия CI **никогда не запускалась**.
- **Убран `pages:` job.** GitFlic **не поддерживает** `pages` keyword (подтверждено [compare_yaml](https://docs.gitflic.ru/en/common/compare_yaml/) — строка `pages` есть только в колонке GitLab). Вместо него: `docs:archive` (downloadable artifact) + `release:docs` (на теге прикрепляет docs bundle к GitFlic release).
- **Убран `default:` блок.** GitFlic его не поддерживает — перешли на `before_script:` per-job.
- **Дока `docs/ci-cd.md`** переписана под реальный GitFlic-синтаксис (включая таблицу что НЕ поддерживается из GitLab keywords).

## [0.1.0] — 2026-06-22

### Added

- **OS-keychain token storage** (`lib/secret.mjs`) — macOS Keychain / Linux libsecret / chmod 0600 file fallback.
- **`auth` модуль** (login/logout/status/list/switch/bind/unbind/bindings) с валидацией токена ДО сохранения.
- **Multi-account** через `--as <name>` + `auth switch`.
- **Per-project account bindings** (`auth bind <project> <account>`).
- **TUI mode** для `mr list` (`--tui`).
- **NDJSON streaming** для list endpoints (`--stream` / `GITFLIC_STREAM=1`).
- **`--all` auto-pagination** для 12 list endpoints.
- **Shell completion** для bash/zsh/fish (`gitflic completion <shell>`).
- **Format flags** `--color` / `--no-color` + env `NO_COLOR` / `FORCE_COLOR`.
- **File-based project-UUID cache** + `gitflic cache` команда.
- **HTTP retry** on 429/502/503/504 с exponential backoff + jitter.
- **MCP-сервер** — 77 типизированных тулов для AI-агентов.
- **Multipart upload** для release assets + issue attachments.

### Fixed

- **`lib/tui.mjs` сломан в production** — `import { process } from "node:process"` падает SyntaxError на нативном Node ESM. vitest/esbuild молча маскировал баг. Поправлено на `import process from "node:process"`.

## [0.0.x] — initial development

- MVP: ~150 эндпоинтов GitFlic REST в CLI.
- Bash + PowerShell установщики.
- Zero runtime dependencies (только Node 18+ stdlib).
- Конфиг в `~/.config/gitflic-cli/config.json`.
