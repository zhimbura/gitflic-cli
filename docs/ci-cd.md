# CI/CD и GitFlic Pages

GitFlic CI использует **GitLab-compatible** синтаксис (`gitlab-ci.yml`). Конфиг лежит в `.gitlab-ci.yml` в корне репо.

## Что гоняется в CI

```yaml
stages:
  - validate
  - test
  - docs
  - pages
```

| Stage | Job | Что делает |
|---|---|---|
| validate | `lint` | `node --check` на всех .mjs файлах + json-валидация `package.json` |
| test | `test:node18` | vitest на Node 18 |
| test | `test:node20` | vitest на Node 20 |
| test | `test:node22` | vitest на Node 22 (latest LTS) |
| docs | `docs:build` | (no-op — Docsify is build-free) проверка что `docs/index.html` существует + curl local server returns 200 |
| pages | `pages` | Архивирует `docs/` → публикует через GitFlic Pages |

## Pipeline badge

Добавь в README:

```markdown
[![Pipeline](https://gitflic.ru/project/tikhon/gitflic-cli/badges/master/pipeline.svg)](https://gitflic.ru/project/tikhon/gitflic-cli/pipelines)
```

## Включение GitFlic Pages

Одноразовая настройка (не через git):

1. Открой <https://gitflic.ru/project/tikhon/gitflic-cli/-/settings/pages>
2. **Path**: `/docs`
3. **Branch**: `master` (или где у тебя main)
4. Save.

После первого успешного `pages` job в CI — сайт будет доступен по адресу:

```
https://tikhon.gitflic.io/gitflic-cli/
```

(Или какой URL даёт GitFlic для твоего проекта.)

## Альтернатива: ручная публикация в Pages branch

Если автоматический `pages:` job не подходит, можно вручную:

```bash
git checkout --orphan pages
git rm -rf .
cp -r docs/* .
git add .
git commit -m "docs: published site"
git push origin pages
```

В настройках Pages выбрать branch = `pages`, path = `/`.

## Локальный preview docs

```bash
npm run docs:dev
# → http://localhost:3000
```

Использует zero-dep Node HTTP-сервер из `scripts/serve-docs.mjs`.

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

# docs/ has index.html
test -f docs/index.html
test -f docs/_sidebar.md
```

Если хочется полноценный eslint — отдельный PR. Пока что `node --check` ловит 90% синтаксических ошибок и zero зависимостей.

## Что проверяет `test` job

`npm install` + `npm test` (vitest run). Node 18, 20, 22 параллельно — матрица.

## Что проверяет `docs:build` job

Просто грепает что `docs/index.html` существует и содержит ожидаемые элементы (search box, sidebar slot). Никакой реальной сборки — Docsify это CDN-loaded runtime.

## Расширение CI

Что легко добавить при необходимости:

- `release` job по git tag → собрать архив + прикрепить к release (нужен API token).
- `docker` job → собрать минимальный образ (multi-stage с node:alpine).
- `security` job → `npm audit` (но у нас zero deps, нечего аудитить).
- `coverage` job → vitest --coverage + codecov (нужен external token).

Если что-то из этого нужно — issue/PR.
