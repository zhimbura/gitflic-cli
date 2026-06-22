# Changelog

## 0.3.0 — 2026-06-23 — полное покрытие REST API (100%)

- **100% покрытие публичного REST API GitFlic** (все 20 разделов, ≈199 эндпоинтов со scope-вариантами). Каждый раздел доведён до полноты; см. таблицу в README/`docs/api-coverage.md`. Бо́льшая часть протестирована вживую против `api.gitflic.ru` на тестовом репозитории `tikhon/cli-e2e-test` (62/62 проверки green).
- **Новые HTTP-хелперы** (`lib/http.mjs`): `httpText` (raw-контент, `Accept: */*` — иначе blob 406), `httpDownload` (бинарное скачивание в файл), `httpUploadFile` (raw-PUT файла для реестра пакетов). `Accept`/`parse`/`contentType` прокинуты в `httpWithRetry`.
- **registry** — полностью переписан: `registry package` (list/get/versions/version/files/delete + upload/download для generic/maven/npm/pypi/nuget/composer/opm/cran/rubygem/cargo/conda в scope project/company/instance) и `registry repo` (registry-repository, Enterprise/Atlas, code-only). Исправлены неверные пути (`/registry/...` база, `version-list`/`package-file`, dotted maven groupId).
- **runner** — переписан под реальные пути `/project|company|admin/runners` (старый `/runner` отдавал 404). Scope-параметр + edit/shutdown/delete/jobs/registration-info.
- **saml** — переписан под `/admin/saml` (старый `/saml` — 404).
- **cicd** — добавлены artifacts, job-операции, restart/cancel/delete, variables, pipeline-lifetime (team/company).
- **branch / tag / environment / mr** — добавлены team/company-scoped операции (protection rules, MR approval rules/configuration/squash/method/template, apply-settings-to-projects) с единым флагом `--scope team|company` + `--team/--company`.
- **release** — добавлены upload/download/delete файлов релиза (multipart, поле `files`).
- **issue** — добавлены relations CRUD, files (list/link/unlink), `issue attach` (upload+link).
- **commit** — `list` исправлен на `/commits`; добавлены for-file, tag-diff; cherry-pick на `/branch/cherry-pick`.
- **blob** — выровнен по спеке (`/blob` + raw `Accept: */*`), добавлены download/recursive/file-size.
- **project** — добавлены search/my/shared, create-fork, mirror push/manual-update, archive, attachments (upload/list/delete), change-setting, run-script, allowed-owners, project-size.
- **admin** — user CRUD + ban/unban + ssh-key + push-stats + 18 settings-мутаторов + ldap import (admin-only).
- **team/company** — my/shared/create (owner по умолчанию = текущий пользователь)/members/import. Убраны несуществующие в REST `team edit/delete` (405).
- **Диспетчер** (`lib/gitflic.mjs`): команды с `--scope team|company` больше не требуют `--project` (раньше падали «could not detect project»).
- **BUG-001 fixed:** `mr diff` теперь декодирует HTML-entities (`&quot;`/`&lt;`/`&gt;`/`&amp;`) через `htmlUnescape()` — диффы читаемы; покрыто тестами.
- **release-list bug-fix:** `/release` вместо `/release/list` (404).
- Тесты: 166 unit-тестов (добавлены тесты `htmlUnescape`).

## 0.2.0 — 2026-06-23 (вышло вместе с 0.3.0; отдельного тега нет)

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
