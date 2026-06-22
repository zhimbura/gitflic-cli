# CI/CD

GitFlic CI/CD живёт в файле **`gitflic-ci.yaml`** в корне репо.

> **Не `.gitlab-ci.yml`!** GitFlic ищет файл с именем `gitflic-ci.yaml` (см. [Pipeline docs](https://docs.gitflic.ru/en/cicd/pipeline/) и [CI/CD Settings](https://docs.gitflic.ru/en/cicd/cicd-settings/) — поле «Configuration File Path»). Старое имя GitLab-стиля GitFlic в упор не видит.

## Синтаксис

GitFlic CI синтаксис **очень похож на GitLab CI**, но не идентичен. Полный reference: <https://docs.gitflic.ru/en/cicd/gitflic-ci-yaml/>. Таблица отличий от GitLab: <https://docs.gitflic.ru/en/common/compare_yaml/>.

**Поддерживаются:** `stages`, `variables`, `before_script`/`after_script` (per-job или глобально), `image`, `script`/`scripts`, `artifacts` (`paths`, `name`, `expire_in`, `reports.junit`), `needs`, `when`, `rules` (`if`, `changes`, `variables`, `when`, `allow_failure`), `tags`, `parallel:matrix`, `cache` (`paths`, `key`), `include` (`local`, `project`, `remote`, `component`), `release`, `trigger`, `environment`, `extends`.

**НЕ поддерживаются** (по сравнению с GitLab):

| Keyword | Что вместо |
|---|---|
| `pages` (и `pages.publish`, `pages.path_prefix`) | **`pages` в GitFlic НЕ СУЩЕСТВУЕТ.** Docs публикуем как downloadable artifact + (на теге) как asset в GitFlic release. |
| `default:` (job-level defaults) | `before_script:` / `after_script:` на верхнем уровне файла или per-job. |
| `coverage`, `dependencies`, `retry`, `timeout`, `inherit` | Нет аналога. |
| `parallel` (как map) | Только `parallel:matrix` (список словарей). |
| `cache:untracked`, `cache:when`, `cache:policy`, `cache:fallback_keys` | Только `cache:paths` + `cache:key`. |
| `include:template`, `include:integrity` | Только `local`, `project`, `remote`, `component`. |
| `services:docker`, `services:kubernetes`, `services:pull_policy` | Нет. |
| `trigger:branch`, `trigger:inputs`, `secrets:*` | Только `trigger:project`, `trigger:include`. |
| `id_tokens`, `hooks`, `identity`, `resource_group` | Нет. |

## Что гоняется в нашем CI

```yaml
stages:
  - validate
  - test
  - docs
  - release
```

| Stage | Job | Что делает |
|---|---|---|
| `validate` | `lint` | `node --check` всех .mjs + JSON-валидация + sanity-checks `docs/` + `bash -n` на installer'ах |
| `test` | `test:node18` / `test:node20` / `test:node22` | vitest на трёх LTS Node параллельно (отдельные jobs на разных image'ах) |
| `docs` | `docs:verify` | Запускает `scripts/serve-docs.mjs`, проверяет `curl /`, `curl /_sidebar.md`, `curl /README.md` |
| `release` | `docs:archive` | `rsync docs/ → docs-site/`, публикует как **artifact** (zip-скачиваемый с pipeline page) |
| `release` | `release:docs` | На git tag → создаёт **GitFlic release** через `release:` keyword, имя/тег подставляются из `$CI_COMMIT_TAG` |

## Pipeline badge

Добавь в README:

```markdown
[![Pipeline](https://gitflic.ru/project/tikhon/gitflic-cli/badges/master/pipeline.svg)](https://gitgitflic.ru/project/tikhon/gitflic-cli/pipelines)
```

## Где посмотреть

- **Pipelines:** <https://gitflic.ru/project/tikhon/gitflic-cli/-/ci-cd/pipelines>
- **Settings:** <https://gitflic.ru/project/tikhon/gitflic-cli/-/settings/ci-cd> (можно поменять путь к yaml-файлу, lifetime, переменные, опасная зона «очистить логи»)
- **Runners:** <https://gitflic.ru/project/tikhon/gitflic-cli/-/settings/agents> (per-project или company-wide shared)

## Как получить docs

Есть **три** способа добраться до `docs/`:

### 1. Скачать artifact с pipeline page

1. Открой любой pipeline → `docs:archive` job → вкладка **Artifacts**.
2. Скачай `gitflic-cli-docs.zip` — там весь `docs/` (включая `_sidebar.md`, `coverpage.md`, `_media/`).
3. `unzip` и `open index.html` локально.

### 2. Скачать с GitFlic release (на tag)

Когда пушишь тег (например `v0.2.0`):

1. Pipeline запускает `docs:archive` (rules: `$CI_COMMIT_TAG`).
2. `release:docs` через keyword `release:` создаёт релиз с `$CI_COMMIT_TAG`.
3. Архив docs прикрепляется к релизу.
4. Скачать: `https://gitflic.ru/project/tikhon/gitflic-cli/-/releases/$CI_COMMIT_TAG`.

### 3. Локально через dev-сервер

```bash
npm run docs:dev
# → http://localhost:3000
```

Использует zero-dep Node HTTP-сервер из `scripts/serve-docs.mjs`.

## Локальный preview vs CI

`scripts/serve-docs.mjs` идентичен тому, что крутится в `docs:verify` job — поэтому если локально `npm run docs:dev` показывает корректный сайт, то и CI его примет.

## Что проверяет `lint` job

Простой sanity-check, никаких внешних линтеров:

```bash
# Syntax-check each .mjs file
for f in lib/gitflic.mjs lib/*.mjs lib/cmd/*.mjs mcp-server/*.mjs scripts/*.mjs; do
  node --check "$f"
done

# JSON files valid
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
node -e "JSON.parse(require('fs').readFileSync('vitest.config.mjs', 'utf8'))"

# docs/ has index.html, _sidebar.md, README.md
test -f docs/index.html
test -f docs/_sidebar.md
test -f docs/README.md

# Shell installers parseable
bash -n install.sh
bash -n uninstall.sh
```

Если хочется полноценный eslint — отдельный PR. Пока что `node --check` ловит ~90% синтаксических ошибок и требует **zero зависимостей**.

## Что проверяет `test` job

`npm ci` + `npm test` (vitest run). Прогоняется на Node 18 / 20 / 22 параллельно в трёх отдельных jobs (по image'у).

## Что проверяет `docs:verify` job

Запускает `node scripts/serve-docs.mjs &` в фоне, ждёт 2 секунды, потом:

- `curl -sf http://127.0.0.1:3000/` → должен вернуть 200 и содержать `gitflic` (проверка что index.html не пустой).
- `curl -sf http://127.0.0.1:3000/_sidebar.md` → должен вернуть 200 и содержать `Аутентификация` (sidebar на месте).
- `curl -sf http://127.0.0.1:3000/README.md` → должен вернуть 200.

Никакой реальной сборки — Docsify это CDN-loaded runtime.

## Переменные окружения

GitFlic прокидывает в job:

- `CI_PROJECT_URL` — `https://gitflic.ru/project/tikhon/gitflic-cli`
- `CI_PROJECT_NAME` — `gitflic-cli`
- `CI_PROJECT_NAMESPACE` — `tikhon`
- `CI_COMMIT_REF_NAME` — текущая ветка / тег
- `CI_COMMIT_SHA` — полный SHA
- `CI_COMMIT_TAG` — имя тега (пусто если не тег)
- `CI_PIPELINE_ID`, `CI_PIPELINE_IID` — pipeline ID
- `CI_REGISTRY` — `registry.gitflic.ru`
- `CI_JOB_TOKEN` — токен для скачивания артефактов / публикации в registry
- `GITFLIC_USER_EMAIL`, `GITFLIC_USER_LOGIN` — кто запустил pipeline
- `CI_SERVER_URL`, `CI_SERVER_REST_URL` — URL самого GitFlic

Полный список: <https://docs.gitflic.ru/en/cicd/gitflic-ci-yaml/#cicd.vars.predefined>.

## Расширение CI

Что легко добавить при необходимости:

- **`release:cli`** — на теге собирать `tar.gz` с `bin/` + `lib/` + `package.json`, прикреплять к release через `release:assets:links`.
- **`registry:docker`** — собрать образ `node:alpine` + скопировать `bin/`, `lib/`, опубликовать в `registry.gitflic.ru/project/$CI_PROJECT_NAMESPACE/$CI_PROJECT_NAME`.
- **`security`** — `npm audit --audit-level=high` (но у нас zero deps, нечего аудитить).
- **`docs:deploy`** — задеплоить docs-site на внешний хостинг через `scp` + переменную `SSH_KEY`.

Если что-то нужно — issue/PR.
