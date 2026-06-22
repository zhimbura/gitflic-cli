# Changelog

Все значимые изменения в `gitflic-cli`. Формат — приближённый к [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Документация на Docsify (`docs/`) с навигацией, поиском, copy-code.
- GitFlic CI pipeline (`.gitlab-ci.yml`): lint + test (Node 18/20/22) + docs pages.
- `scripts/serve-docs.mjs` — zero-dep Node HTTP-сервер для локального preview docs.

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
- **MCP-сервер** — 71 типизированный тул для AI-агентов.
- **Multipart upload** для release assets + issue attachments.

### Fixed

- **`lib/tui.mjs` сломан в production** — `import { process } from "node:process"` падает SyntaxError на нативном Node ESM. vitest/esbuild молча маскировал баг. Поправлено на `import process from "node:process"`.

## [0.0.x] — initial development

- MVP: ~150 эндпоинтов GitFlic REST в CLI.
- Bash + PowerShell установщики.
- Zero runtime dependencies (только Node 18+ stdlib).
- Конфиг в `~/.config/gitflic-cli/config.json`.
