---
description: "Локальная разработка gitflic-cli: структура репозитория, запуск из исходников, самотесты и сборка портативных релизов скриптом build.mjs."
---

# Локальная разработка

## Структура репо

```
gitflic-cli/
├── bin/gitflic                  # bash-шим → node lib/gitflic.mjs
├── lib/
│   ├── gitflic.mjs              # entry: dispatcher
│   ├── http.mjs                 # fetch + retry + parseArgs + resolveToken
│   ├── secret.mjs               # OS keychain / libsecret / chmod 0600
│   ├── config.mjs               # persistent config (chmod 0600)
│   ├── cache.mjs                # file-based project-UUID cache
│   ├── paginate.mjs             # --all auto-pagination
│   ├── format.mjs               # вывод + цвета
│   ├── tui.mjs                  # интерактивный браузер MR
│   └── cmd/                     # один файл = один модуль
├── mcp-server/                  # MCP-сервер для AI-агентов
├── docs/                        # эта документация (VitePress)
├── scripts/                     # утилиты (docs dev-server)
├── install.sh / install.ps1      # установщики
├── gitflic-ci.yaml              # (удалён в 0.2.0 — собираем локально)
├── package.json                 # только devDeps (vitest)
└── vitest.config.mjs
```

## Конвенции

### Стиль кода

- **ESM only**, `"type": "module"` в package.json.
- **Node 18+** baseline (используем `globalThis.fetch`, `node:fs/promises`, etc).
- **`node --check <file>`** для syntax — никакого TypeScript, никакого Babel, никакого bundler.
- **2-space indent**, no semicolons в конце statements… шучу, с semicolons. Single quotes для строк.
- **Каждый модуль экспортирует `usage` (строка) и `handle(ctx, sub, args, flags)`** — это контракт диспетчера.

### Структура cmd-модуля

```js
// lib/cmd/<name>.mjs
export const usage = `
  <command> <subcommand> [--flag value]
    One-line description.
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "list":   return handleList(ctx, args, flags);
    case "create": return handleCreate(ctx, args, flags);
    // ...
    case undefined:
      process.stdout.write(usage);
      return;
    default:
      process.stderr.write(`gitflic ${name}: unknown subcommand: ${sub}\n`);
      process.exit(2);
  }
}
```

### Добавление новой команды

1. Создай `lib/cmd/<name>.mjs` с `usage` и `handle`.
2. Импортируй в `lib/gitflic.mjs` и добавь в `COMMANDS`.
3. Если не требует `--project`, добавь в `GLOBAL` set.
4. Напиши тесты в `lib/__tests__/<name>.test.mjs` (vitest).
5. Если добавляешь новый sensitive параметр — обнови `isSensitiveKey()` в `lib/secret.mjs`.
6. Обнови README + `docs/commands/<name>.md`.

### Тесты

- **Vitest**, 163 теста, ~300ms на полный прогон.
- Тесты лежат рядом с кодом: `lib/__tests__/<name>.test.mjs`.
- Покрытие: все публичные функции, command handlers, edge cases (env vars, file modes, secret backend fallback).
- Не мокай global fetch для тестов auth.mjs — используй `vi.stubGlobal("fetch", mockFn)`.

```bash
npm test                  # один прогон
npm run test:watch        # watch mode
npx vitest run path/to/specific.test.mjs   # один файл
```

### Линтинг

Сейчас нет линтера (только `node --check`). Если хочется eslint — отдельный PR. Минимальный sanity-check:

```bash
npm run lint
# или
node scripts/build.mjs --no-test --no-bundle
```

## Документация

Docs лежат в `docs/` — это **VitePress** сайт (Markdown + конфиг в `docs/.vitepress/config.mjs`).

```bash
npm run docs:dev       # dev-server с HMR (по умолчанию :5173)
npm run docs:build     # статическая сборка → docs/.vitepress/dist
npm run docs:preview   # локальный предпросмотр собранного сайта
npm run docs:publish   # build + пуш собранного сайта в GitHub-зеркало (деплой)
```

- Страницы — обычный Markdown в `docs/**.md`. Навигация/сайдбар — в `docs/.vitepress/config.mjs`.
- Статика (иконки, картинки) — в `docs/public/` (раздаётся из корня сайта, напр. `/_media/icon.svg`).
- Тема/брендинг — `docs/.vitepress/theme/` (GitFlic-красный). Поиск — встроенный локальный.
- Важно: в Markdown вне код-блоков не пиши голые `<плейсхолдеры>` — Vue-компилятор примет их за теги. Оборачивай в backticks: `` `<name>` ``.

## Сборка и релиз

`scripts/build.mjs` — полная локальная сборка: syntax-check всех .mjs, JSON-валидация, vitest, `tar.gz` portable-бандла в `dist/`.

```bash
npm run build               # lint + test + tar.gz
npm run build -- --no-test  # быстрая итерация (без тестов)
npm run build -- --no-bundle # только проверки, без tar.gz
```

`scripts/release.mjs` — бампит версию в `package.json`, пересобирает, копирует tar.gz в **`docs/public/downloads/`** (раздаётся VitePress как `/downloads/<file>` — артефакты качаются прямо с сайта, без S3), и пересобирает там же `index.html` со списком релизов.

Заодно он **автоматически перепинивает MCP на новый CLI**: правит `"gitflic-cli"` в `mcp-server/package.json` на выпускаемую версию и бампит патч-версию самого MCP. Так задумано: MCP спавнит бинарь CLI, поэтому зависимость там — **точный пин, а не диапазон**. Диапазон однажды уже вышел боком — `^0.3.3` удовлетворялся лежащей в кеше `npx` версией 0.3.3, поэтому фикс из 0.3.4 не доезжал до пользователей вообще. Следствие: **новый CLI обязан выходить вместе с новым MCP**, иначе `npx` продолжит резолвить старый CLI. `scripts/publish.mjs` это проверяет и откажется публиковать рассинхронизированную пару.

```bash
npm run release -- --version 0.3.0   # бамп + билд + ship
npm run release                      # интерактивно спросит версию
npm run docs:build                   # собрать VitePress перед деплоем
```

Почему так: на публичном `gitflic.ru` нет shared runners (нужна Company + self-hosted `runner.jar` — это платный VPS), и покупать S3 ради одного tar.gz тоже не хочется. Поэтому:

1. CI/CD выпилен (`gitflic-ci.yaml` удалён).
2. Документация — статический **VitePress** сайт. Исходник (`docs/`) живёт в этом репо; собранный сайт публикуется в **GitHub-зеркало** [`zhimbura/gitflic-cli-docs`](https://github.com/zhimbura/gitflic-cli-docs) (его корень = собранный сайт, без build-шага), а **Timeweb Apps** раздаёт зеркало статикой. Деплой одной командой: `npm run docs:publish` (= `docs:build` + пуш `dist` в зеркало, gh-pages style).
3. Артефакты релизов лежат в `docs/public/downloads/` → попадают в собранный сайт под тем же доменом (`/downloads/`).

Workflow релиза целиком:

```bash
# 1. Поправил код, прогнал тесты
npm run build

# 2. Бамп + ship tar.gz в docs/public/downloads/
#    (заодно перепинит mcp-server на новый CLI и бампнет версию MCP)
npm run release -- --version 0.3.0

# 3. Коммит исходников (код + docs/) в основной репо
git add . && git commit -m "release: v0.3.0"
git push

# 4. Публикация в npm — ОБА пакета, CLI первым.
#    2FA идёт через браузер и запрашивается на каждый publish,
#    поэтому командами по отдельности (см. publish:dry для проверки).
npm run publish:dry          # прогнать проверки, ничего не публикуя
npm publish                  # gitflic-cli
npm publish ./mcp-server     # gitflic-cli-mcp — не пропускать!

# 5. Собрать и опубликовать доку в зеркало (Timeweb подхватит)
npm run docs:publish
```

> ⚠️ Шаг 4 нельзя делать наполовину. MCP пинит точную версию CLI, поэтому выпуск CLI **без** выпуска MCP означает, что пользователи `npx` продолжат резолвить старый CLI, и фикс до них не доедет. Если MCP-пакет менять не пришлось — значит и CLI не менялся; `publish.mjs` не даст опубликовать пару, в которой пин разошёлся с версией CLI.

## Отладка

```bash
# Verbose retry logs
GITFLIC_HTTP_RETRIES=0 GITFLIC_NO_RETRY=1 GITFLIC_HTTP_RETRY_DELAY=10 gitflic ...

# Без кеша
GITFLIC_NO_CACHE=1 gitflic ...

# Без config-файла (CI-mode)
GITFLIC_NO_CONFIG=1 gitflic ...

# Без secret store (только env var)
GITFLIC_NO_SECRET_STORE=1 gitflic ...

# Print resolved API calls
DEBUG=gitflic:* gitflic ...   # пока не реализовано, но легко добавить
```

## См. также

- [Установка](install.md)
- [Релизы и артефакты](/releases/)
- [MCP-сервер](mcp-server.md)
