---
description: "История изменений gitflic-cli и MCP-сервера: новые команды, покрытие GitFlic REST API, улучшения и исправления по версиям."
---

# Changelog

Все значимые изменения в `gitflic-cli`. Формат — приближённый к [Keep a Changelog](https://keepachangelog.com/).

## [0.4.0 + gitflic-cli-mcp 0.5.0] — 2026-11-07

Полная пагинация MR, проекты команд и флаги для MCP-сервера.

- **`mr diff` и `mr discuss list` забирают все страницы по умолчанию.** `--page N` / `--size N` выбирают одну страницу, `--no-all` оставляет один запрос, `--no-expand` не догружает свёрнутые файлы. В JSON есть признаки полноты `_pagination` и `_diff`. Если MR меняется во время загрузки, команда завершается ошибкой. Автор — Антон Старостин (MR !3).
- **MCP: новый тул `gitflic_project_list`** с областями `public` / `my` / `shared` и фильтром по владельцу, чтобы находить проекты команд. Тулзов теперь **78**. Тулы `gitflic_mr_diff`, `gitflic_mr_discuss_list` и списки проектов принимают `page`, `size`, `all`.
- **MCP: флаги командной строки** `--output`, `--groups`, `--readonly`, `--no-destructive` и `--help` дублируют переменные `GITFLIC_MCP_*`; флаг важнее env. Автор — sv99 (MR !2).
- Пин MCP на CLI теперь `0.4.0`.

## [0.3.6 + gitflic-cli-mcp 0.4.3] — 2026-10-08

Конфиг на Windows, имена веток MR и причина ошибки GitFlic.

- **Конфиг и токен на Windows.** Путь строился от `process.env.HOME`, а на Windows его нет: CLI создавал каталог `~` в текущей папке, и токен терялся при смене каталога. Теперь путь берётся из `os.homedir()`. На macOS и Linux ничего не меняется. Спасибо [sv99](https://gitflic.ru/project/tikhon/gitflic-cli/merge-request/1). Добавлены шимы `bin/gitflic.cmd` и `bin/gitflic.ps1`, сборка больше не требует `cp` и `gzip`.
- **MR показывал хеш коммита вместо имени ветки** — в `mr view`, `mr list`, TUI и в MCP (`gitflic_mr_view`, `gitflic_mr_list`). Из-за этого фильтры `sourceBranch` / `targetBranch` в MCP не находили ничего.
- **Ошибка GitFlic больше не пустая.** Вместо `HTTP 404  — ` CLI печатает читаемый текст или имя исключения (`BranchNotFoundException`) и поля из `errors[]` для 422.
- Пин MCP на CLI теперь `0.3.6`.

## [gitflic-cli-mcp 0.4.2] — 2026-07-17

Проблема с авторством и доставкой фиксов. Релиз только MCP-пакета, CLI остаётся 0.3.5.

- **MCP приписывал каждую проблему владельцу проекта.** Проекция брала автора из `userAlias`, но у проблемы это алиас **владельца репозитория** (вместе с `projectAlias` образует путь `<owner>/<project>`) — он одинаковый у всех проблем, кто бы их ни завёл. Публичный API GitFlic автора проблемы не отдаёт вовсе, поэтому поле больше не подставляется. Заведено в GitFlic: [gitflic/gitflic#714](https://gitflic.ru/project/gitflic/gitflic/issue/714).
- **Зависимость `gitflic-cli` пинится точно, а не диапазоном.** Было `^0.3.3` — а такой диапазон удовлетворяется уже закешированной 0.3.3, поэтому `npx` её никогда не обновлял, и фиксы CLI не доезжали. У кого кеш старше 0.3.4, MCP-тулзы `gitflic_issue_edit` / `_close` / `_reopen` молча затирали заголовок и описание строкой `"stub"`. **Если поймали — `npx -y gitflic-cli-mcp@latest`** (или `rm -rf ~/.npm/_npx`).

## [gitflic-cli-mcp 0.4.1] — 2026-06-24

Багфиксы slim-слоя, найденные при live-прогоне всех 77 тулзов «в бою».

- **`gitflic_user_search`** через slim возвращал пусто — клиентский `q`-фильтр искал только по `title`/`description`, а у юзеров их нет. Haystack расширен (`username`/`fullName`/`name`/`alias`/`tagName`).
- **Пустой `*_list`** незамапленного тула отдавал сырую обёртку `{page}` вместо `{items:[],total,returned:0}`. Fallback расширен на любой `*_list`/`*_search`.

## [0.3.5] — 2026-06-24

Ещё несколько частичных edit'ов затирали поля (PUT заменяет объект целиком → нужен read-merge):

- **`branch protection edit`** — правка одного поля сохраняет остальные (проверено вживую). Также **`settings oauth edit`** и **`registry repo edit`**.
- **`mr discuss delete`** — слал `POST` → GitFlic **405**; теперь `DELETE` (проверено вживую). `mr discuss reply`/`resolve`/`delete` работают через CLI (нужен `rootNote.uuid`).

## [0.3.4] — 2026-06-23

- **`issue close` / `reopen` / `edit`** больше не затирают `title`/`description` — раньше `close` молча превращал заголовок в `«stub»` (GitFlic PUT заменяет объект целиком; теперь read-merge).

## [0.3.3] + gitflic-cli-mcp [0.4.0] — 2026-06-23 — сжатие токенов MCP

MCP больше не отдаёт LLM «сырой» JSON GitFlic — на реальных данных **≈70% экономии токенов** (на коммитах/ветках до 84%).

- **MCP: сжатие ответов** — list-обёртка `{_embedded,page}` → `{items,total,matched,returned}`, проекция сущностей, вырезание косметики (avatar/cover/hexColor/`_links`), `status` → enum-скаляр. Два режима: `GITFLIC_MCP_OUTPUT=slim|full` + `GITFLIC_MCP_RAW`. Поканальные `raw:true` / `fields:[…]`. Клиентская фильтрация списков (`label`/`q`/`assignee`/…). Новый approval-тул `gitflic_webhook_reveal_secret`; `secret` вебхука маскируется в `secretSet`. Тулзов: **77**. См. [MCP-сервер → Сжатие ответов](/mcp-server#сжатие-ответов-экономия-токенов).
- **CLI: fix пагинации `--all`** — пейджер был 1-индексным, а списки GitFlic 0-индексные → терялась первая страница (`issue list --all` отдавал 40 из 60). `user projects`/`followers`/`following` → поддержка `--all`.

## [0.3.2] + gitflic-cli-mcp [0.3.1] — 2026-06-23

Багфиксы из живого E2E-прогона всех MCP-тулзов. Добавлен `scripts/e2e-live.mjs`.

- **CLI `project edit`** — `PUT /project` (405) → теперь `…/setting/change-setting` (title/description/language).
- **CLI `mr create`** — требует непустой `--description` (иначе GitFlic 422).
- **CLI `blob get`/`recursive`/`download`** — работают без `--commit` (по `--branch` или дефолтной ветке).
- **MCP `gitflic_blob_files`** → `blob recursive` (звал несуществующую `blob files`).
- **MCP `gitflic_blob_archive`** — удалён (нет репо-тарбола в REST). Тулзов: 76.
- **MCP `gitflic_mr_create`** — `description` обязателен; **`gitflic_project_edit`** — убраны visibility/default-branch.

## [0.3.1] — 2026-06-23

- **Fix `gitflic release create` / `release edit`** — не отправлялось обязательное поле `preRelease`, из-за чего GitFlic API падал с 500/422. Теперь `preRelease` шлётся всегда (default `false`); `edit` дочитывает текущий релиз и мёржит изменения. Добавлены unit-тесты.

## [gitflic-cli-mcp 0.3.0] — 2026-06-23

> Релиз только MCP-пакета. CLI `gitflic-cli` без изменений (0.3.0).

- **`GITFLIC_MCP_NO_DESTRUCTIVE=1`** — overlay-флаг, который жёстко убирает 7 удаляющих тулзов (`*_delete`) на уровне регистрации (надёжнее approval-prompt'а). Остальные мутации, включая `gitflic_mr_merge`, остаются и идут через подтверждение хоста. Цепочка: база → `READONLY` → `NO_DESTRUCTIVE` → `EXCLUDE`.

## [gitflic-cli-mcp 0.2.0] — 2026-06-23

> Релиз только MCP-пакета. CLI `gitflic-cli` без изменений (0.3.0).

### MCP-сервер (`gitflic-cli-mcp`)

- **Фильтрация набора тулзов** для экономии контекста модели. Через env-переменные: `GITFLIC_MCP_GROUPS` (по группам, напр. `mr,issue`), `GITFLIC_MCP_READONLY=1` (только read-only), `GITFLIC_MCP_TOOLS` (allowlist), `GITFLIC_MCP_EXCLUDE` (denylist). По умолчанию регистрируются все 77 тулзов. См. [MCP-сервер → Ограничение набора тулзов](/mcp-server#ограничение-набора-тулзов-экономия-контекста).
- **Fix MCP-аннотаций:** `gitflic_project_list_my` и `gitflic_mr_by_commit` помечены read-only; `gitflic_mr_discuss_resolve` помечен write. Итог: 40 read / 37 write.

## [0.3.0] — 2026-06-23

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

## [0.2.0] — 2026-06-23

> Не выпускалось отдельным тегом — вошло в 0.3.0.

### Changed

- **CI/CD выпилен.** Удалён `gitflic-ci.yaml` и страница `docs/ci-cd.md`: на публичном `gitflic.ru` нет shared runners, а self-hosted `runner.jar` требует платный VPS. Сборка/релиз — локально (`npm run build`, `npm run release`), дока — статикой на Timeweb.

### Fixed

- `cicd pipeline list` в pretty-режиме показывал `(no pipelines)` при наличии записей — реальный HAL-ключ `restPipelineModelList` (а не `pipelineList`). Поправлено в `lib/cmd/cicd.mjs` (со старыми ключами как fallback).

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
