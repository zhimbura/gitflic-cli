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
├── docs/                        # эта документация (Docsify)
├── scripts/                     # утилиты (docs dev-server)
├── install.sh / install.ps1      # установщики
├── gitflic-ci.yaml              # GitFlic CI pipeline
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
6. Обнови README + docs/commands/<name>.md.

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
for f in lib/gitflic.mjs lib/*.mjs lib/cmd/*.mjs mcp-server/*.mjs scripts/*.mjs; do
  node --check "$f" || exit 1
done
```

(Это то, что GitFlic CI гоняет в `lint` job — см. [ci-cd.md](ci-cd.md).)

## Документация

Docs лежат в `docs/` — это **Docsify** сайт (zero-build, CDN-loaded).

```bash
npm run docs:dev          # локальный dev-server на :3000
# или
node scripts/serve-docs.mjs
```

Изменил `.md` файл — обнови страницу в браузере, никакой пересборки.

## Релиз

Manual для now (нет автоматического tag→publish):

```bash
# 1. Обнови CHANGELOG.md, закомить
# 2. Тег
git tag -a v0.2.0 -m "v0.2.0 — see CHANGELOG"
git push origin v0.2.0
# 3. Если хочешь опубликовать npm — отдельный шаг (не делаем сейчас)
```

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
