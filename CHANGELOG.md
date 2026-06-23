# Changelog

## gitflic-cli-mcp 0.4.1 — 2026-06-24 — fix: slim `q`-фильтр отбрасывал результаты поиска

> Релиз только MCP-пакета. CLI `gitflic-cli` без изменений — остаётся 0.3.5.

- **Live-прогон всех 77 тулзов** (рой агентов гонял CLI в бою на тест-репо) выявил баг: клиентский `q`-фильтр в `slim.mjs` искал только по `title`/`description`/`shortMessage`/`message`, поэтому `gitflic_user_search` отбрасывал **все** найденные сервером результаты (`matched:0`) — у пользователей нет `title`/`description`. Haystack расширен: добавлены `username`/`fullName`/`name`/`alias`/`tagName`, так что `q` корректно работает для user/project/release. Тест + живая проверка. (Итог прогона: 69 ✓, 0 падений; остальные — легитимные skip: auth-мутации keychain, member-invite, `tag get` 400-quirk, mr-discuss без треда.)
- **Прямой sweep slim-слоя** (реальный ответ каждого read-тула → `slimResult`, 34 тула) добил ещё одну мелочь: пустой список **незамапленного** list-тула (напр. `gitflic_branch_protection_list` без правил) отдавал сырую обёртку `{page}` вместо `{items:[],total,returned:0}`. Fallback пустого списка расширен на любой `*_list`/`*_search`. Все 34 read-тула дают валидный slim, секрет вебхука не утекает ни на одном пути.

## gitflic-cli 0.3.5 — 2026-06-24 — fix: ещё несколько partial-edit затирали поля

После фикса `issue edit` (0.3.4) — аудит **всех** мутирующих хендлеров на тот же класс (GitFlic PUT заменяет объект целиком, поэтому частичный edit без read-merge стирает не переданные поля). Найдено и починено через read-merge (как `mr edit`/`release edit`):

- **`branch protection edit`** — правка одного поля (напр. `--auto-merge`) затирала `branchTemplate` / `allowedToPush` / `allowedToMerge` / `codeOwnerApprovalRequired`. Теперь читает текущее правило и мёржит. **Проверено вживую** (правка `--auto-merge` сохраняет остальные поля). Выделен `buildProtectionEditBody` + тесты.
- **`settings oauth edit`** — PUT затирал омитнутые поля OAuth-приложения (`description`/`homepage`/`callback`/`standalone`). Теперь read-merge; `--name` больше не обязателен. `buildOauthEditBody` + тесты.
- **`registry repo edit`** — то же (Enterprise/Atlas-only): read-merge `title`/`repositoryType`/`packageType`/`description`.

> Под наблюдением (admin/gated, ждут живой проверки эндпоинтов): `saml edit` (нет отдельного `saml get` для merge) и `runner edit` (`POST …/edit` — неясно, мёржит ли сервер сам). Потенциально тот же класс — если подтвердится, починим аналогично.

## gitflic-cli 0.3.4 — 2026-06-23 — fix: `issue close/edit` затирали заголовок/описание

- **Data-loss fix.** `gitflic issue close` / `reopen` / частичный `edit` слали `title`/`description` как `"stub"`, а GitFlic PUT `/issue/edit` заменяет объект целиком — поэтому закрытие задачи **молча превращало её заголовок и описание в «stub»**. Теперь `edit` сначала читает текущую issue и мёржит изменения (как уже сделано для `release edit` / `mr edit`), сохраняя title/description/исполнителей/лейблы. Выделен чистый билдер `buildIssueEditBody` + unit-тесты. Затрагивало и MCP-тулзы `gitflic_issue_close`/`reopen`/`edit` — фикс подхватится автоматически (зависимость `gitflic-cli-mcp@0.4.0` → `^0.3.3`).

## gitflic-cli 0.3.3 + gitflic-cli-mcp 0.4.0 — 2026-06-23 — сжатие токенов MCP (issue #1)

Главное: **MCP больше не отдаёт LLM «сырой» JSON GitFlic** — на реальных данных **≈70% экономии токенов** (на коммитах/ветках до 84%).

**MCP `gitflic-cli-mcp` 0.4.0:**
- **Сжатие ответов** (`mcp-server/slim.mjs`, в единой точке ответа `server.mjs`): list-обёртка `{_embedded,page}` → `{items,total,matched,returned}`; проекция каждой сущности до нужных полей (keep-наборы из CLI-принтеров); вырезается косметика (avatar/cover/hexColor/`_links`), `status` схлопывается в enum-скаляр, юзеры — в логины, лейблы — в названия.
- **Два режима** (как просили в issue): `GITFLIC_MCP_OUTPUT=slim|full` (по умолч. `slim`) + булев `GITFLIC_MCP_RAW`. `full`/`raw` отдаёт прежний сырой ответ.
- **Поканальные escape-hatch'и для самой LLM**: аргумент `raw: true` (полный несжатый ответ для одного вызова) и `fields: [...]` (сузить проекцию) — на каждом тулзе.
- **Фильтрация списков** (проблема #1): клиентские `label`/`q`/`assignee`/`status`/`author`/`sort`/`limit` на list-тулзах с авто-`--all` (фильтр видит полный набор), в ответе `matched` vs `total`. Закрывает «найди открытые issue с лейблом Security».
- **Безопасность секретов**: `secret` вебхука маскируется в `secretSet` **на всех путях** (включая `raw`/`full`) — раньше сырой ответ его утекал в модель. Реальное значение отдаёт только новый тул **`gitflic_webhook_reveal_secret`** (с подтверждением хоста). Тулзов: **77**.

**CLI `gitflic` 0.3.3:**
- **Fix пагинации `--all`**: пейджер был 1-индексным, а списки GitFlic — 0-индексные, поэтому `--all` молча терял первую (новейшую) страницу (`issue list --all` возвращал 40 из 60). Теперь забирает весь набор.
- **`user projects` / `followers` / `following`** переведены на `paginatedList` — теперь поддерживают `--all`/`--stream`.

## gitflic-cli 0.3.2 + gitflic-cli-mcp 0.3.1 — 2026-06-23

Багфиксы, найденные **живым E2E-прогоном всех MCP-тулзов** против GitFlic (раньше API-команды не были покрыты автотестами). Добавлен переиспользуемый live-харнес `scripts/e2e-live.mjs`.

**CLI `gitflic` 0.3.2:**
- **`project edit`** — `PUT /project` отдавал **405**; теперь редактирование title/description/language идёт через рабочий эндпоинт `…/setting/change-setting`. Visibility и default-branch не редактируются по REST — команда честно сообщает об этом, а не молча игнорит.
- **`mr create`** — требует непустой `--description` (GitFlic отклоняет пустое описание с 422 `error.field.empty`); раньше слался `""` → криптовый 422.
- **`blob get` / `recursive` / `download`** — больше не требуют `--commit`: принимают `--branch` или по умолчанию берут дефолтную ветку (резолв через `…/branch?name=`).

**MCP `gitflic-cli-mcp` 0.3.1:**
- **`gitflic_blob_files`** — звал несуществующую подкоманду `blob files`; теперь `blob recursive`.
- **`gitflic_blob_archive`** — удалён: репо-тарбола в GitFlic REST на SaaS нет (`blob download` — это один файл).
- **`gitflic_mr_create`** — `description` добавлен в `required`.
- **`gitflic_project_edit`** — убраны неработающие `isPrivate`/`defaultBranch`; остаются title/description/language.
- Итого тулзов: **76** (было 77).

## gitflic-cli 0.3.1 — 2026-06-23

- **Fix `gitflic release create`** — команда не слала поле `preRelease`, без которого GitFlic API падает с **500 NPE** (или **422** при наличии `--description`). Теперь `preRelease` отправляется всегда (по умолчанию `false`, `true` при `--pre-release`). Тот же фикс для `gitflic release edit`: PUT требует полный объект — команда теперь дочитывает текущий релиз и мёржит изменения, не обнуляя `preRelease`/остальные поля. Выделены чистые билдеры `buildCreateBody`/`buildEditBody` + unit-тесты. (Баг нашли при создании GitFlic-релиза для `mcp-v0.3.0` — теперь релиз создаётся самим CLI.)

## gitflic-cli-mcp 0.3.0 — 2026-06-23

> Релиз только MCP-пакета (`gitflic-cli-mcp`). CLI `gitflic-cli` без изменений — остаётся 0.3.0.

- **`GITFLIC_MCP_NO_DESTRUCTIVE=1`** — новый overlay-флаг: жёстко (на уровне регистрации) убирает деструктивные тулзы — **7 удаляющих** (`*_delete`: issue/issue_comments/mr_discuss/branch/branch_protection/release/webhook). Надёжнее, чем approval-prompt хоста (его можно прокликать / «разрешить всё»). Остальные мутации (`*_create`/`*_edit`/`*_close`/`gitflic_mr_merge`) остаются и идут через подтверждение (`destructiveHint` не меняли). Цепочка overlay'ев: база → `READONLY` → `NO_DESTRUCTIVE` → `EXCLUDE`. Логика в `mcp-server/filter.mjs`, покрыта тестами.

## gitflic-cli-mcp 0.2.0 — 2026-06-23

> Релиз только MCP-пакета (`gitflic-cli-mcp`). CLI `gitflic-cli` без изменений — остаётся 0.3.0.

- **Фильтрация набора тулзов** для экономии контекста модели (все 77 тулзов = ~6K токенов «налога» ещё до первого вызова). Через env: `GITFLIC_MCP_GROUPS` (по группам: `mr,issue` и т.п.), `GITFLIC_MCP_READONLY=1` (только read-only), `GITFLIC_MCP_TOOLS` (точный allowlist), `GITFLIC_MCP_EXCLUDE` (denylist). По умолчанию — все 77 (поведение не изменилось). Логика в `mcp-server/filter.mjs`, покрыта тестами.
- **Fix MCP-аннотаций** (влияет на `READONLY`-режим и confirm-prompt'ы хоста): `gitflic_project_list_my` и `gitflic_mr_by_commit` теперь `readOnlyHint:true` (были помечены как мутирующие — лишний prompt + не попадали в read-only набор); `gitflic_mr_discuss_resolve` теперь `readOnlyHint:false` (resolve меняет состояние треда — раньше ошибочно числился read-only). Итог: **40 read / 37 write**. Соответствующий fix в классификаторе `scripts/annotate-mcp-tools.mjs`.

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
- **Дистрибуция в npm:** опубликованы `gitflic-cli` (`npm i -g gitflic-cli` / `npx gitflic-cli`) и `gitflic-cli-mcp` (MCP-сервер через `npx -y gitflic-cli-mcp`; зависит от `gitflic-cli`). `mcp-server/runner.mjs` теперь запускает CLI как `node <resolved gitflic-cli>` вместо bash-шима — работает при отдельной установке и на Windows. Добавлены Homebrew-формула (`packaging/homebrew/`, tap — скоро) и `scripts/publish.mjs` (dry-run / bump-formula / publish).

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
