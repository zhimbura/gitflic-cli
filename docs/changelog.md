# Changelog

Все значимые изменения в `gitflic-cli`. Формат — приближённый к [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed

- **CI: переехали с `.gitlab-ci.yml` на `gitflic-ci.yaml`** — это **обязательное имя файла** для GitFlic CI (см. [docs](https://docs.gitflic.ru/en/cicd/pipeline/) и [CI/CD Settings](https://docs.gitflic.ru/en/cicd/cicd-settings/)). Старое имя `.gitlab-ci.yml` GitFlic в упор не видит, поэтому предыдущая версия CI **никогда не запускалась**.
- **Убран `pages:` job.** GitFlic **не поддерживает** `pages` keyword (подтверждено [compare_yaml](https://docs.gitflic.ru/en/common/compare_yaml/) — строка `pages` есть только в колонке GitLab). Вместо него: `docs:archive` (downloadable artifact) + `release:docs` (на теге прикрепляет docs bundle к GitFlic release).
- **Убран `default:` блок.** GitFlic его не поддерживает — перешли на `before_script:` per-job.
- **Дока `docs/ci-cd.md`** переписана под реальный GitFlic-синтаксис (включая таблицу что НЕ поддерживается из GitLab keywords).

## [0.3.0] — unreleased

100% покрытие публичного REST API GitFlic — все 20 разделов (≈199 эндпоинтов со scope-вариантами). Бо́льшая часть протестирована вживую против `api.gitflic.ru` (62/62 проверки green). Подробности — в [api-coverage.md](api-coverage.md).

### Added

- **HTTP-хелперы** (`lib/http.mjs`): `httpText` (raw-контент, `Accept: */*`), `httpDownload` (бинарное скачивание в файл), `httpUploadFile` (raw-PUT для реестра пакетов). `Accept`/`parse`/`contentType` прокинуты в `httpWithRetry`.
- **registry** — полностью переписан: `registry package` (list/get/versions/version/files/delete + upload/download для generic/maven/npm/pypi/nuget/composer/opm/cran/rubygem/cargo/conda в scope project/company/instance) и `registry repo` (registry-repository). Per-format upload использует флаг `--fmt` (не `--format`).
- **runner** — переписан под реальные пути `/project|company|admin/runners`: scope-параметр + edit/shutdown/delete/jobs/registration-info.
- **saml** — переписан под `/admin/saml`.
- **cicd** — artifacts, job-операции, restart/cancel/delete, variables, pipeline-lifetime (team/company).
- **branch / tag / environment / mr** — team/company-scoped операции (protection rules, MR approval rules/configuration/squash/method/template, apply-settings-to-projects) с единым флагом `--scope team|company` + `--team/--company`.
- **release** — upload/download/delete файлов релиза (multipart, поле `files`).
- **issue** — relations CRUD, files (list/link/unlink), `issue attach` (upload+link).
- **commit** — for-file, tag-diff, cherry-pick.
- **blob** — download/recursive/file-size (raw `Accept: */*`).
- **project** — search/my/shared, create-fork, mirror push/manual-update, archive, attachments, change-setting, run-script, allowed-owners, project-size.
- **admin** — user CRUD + ban/unban + ssh-key + push-stats + 18 settings-мутаторов + ldap import (admin-only).
- **team/company** — my/shared/create/members/import.

### Changed

- **Диспетчер** (`lib/gitflic.mjs`): команды с `--scope team|company` больше не требуют `--project` (раньше падали «could not detect project»).
- Реестр: исправлены неверные пути (`/registry/...` база, `version-list`/`package-file`, dotted maven groupId).
- Убраны несуществующие в REST `team edit/delete` и `company edit/delete` (405 — только web UI; для смены владельца — `team transfer`).
- Тесты: 166 unit-тестов (добавлены тесты `htmlUnescape`).

### Fixed

- **BUG-001:** `mr diff` теперь декодирует HTML-entities (`&quot;`/`&lt;`/`&gt;`/`&amp;`) через `htmlUnescape()` — диффы читаемы; покрыто тестами.
- **commit list** исправлен на `/commits`; **cherry-pick** — на `/branch/cherry-pick`.
- **release-list** — `/release` вместо `/release/list` (404).

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
