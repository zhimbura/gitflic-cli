# gitflic-cli MCP-сервер

[Model Context Protocol](https://modelcontextprotocol.io/) сервер, оборачивающий CLI `gitflic` и отдающий **77 типизированных тулзов** поверх команд GitFlic REST для AI-агентов (Claude Code, Cursor и т.п.).

## Что внутри

- `server.mjs` — MCP-сервер на stdio, регистрирует все тулзы, диспетчеризует в CLI.
- `tools.mjs` — описания тулзов (имя, описание, JSON-схема, билдер аргументов CLI).
- `runner.mjs` — обёртка над `child_process`, запускает `gitflic` CLI (`node …/lib/gitflic.mjs`) и парсит JSON.
- зависимости: `@modelcontextprotocol/sdk`, `zod` и сам `gitflic-cli` (CLI).

MCP-сервер — это **тонкая прослойка**: каждая тулза маппится 1-в-1 на подкоманду CLI. Всё, что можно сделать через `gitflic …`, доступно и из MCP-хоста.

## Установка

Ставить ничего не нужно — запуск через `npx`:

```bash
GITFLIC_TOKEN="xxxx" npx -y gitflic-cli-mcp
```

`npx` подтянет пакет, его зависимости и сам CLI `gitflic-cli`. Из исходников — вручную:

```bash
cd mcp-server && npm install
GITFLIC_TOKEN="xxxx" node server.mjs
```

Требуется Node 18+.

## Настройка токена

Сервер читает `GITFLIC_TOKEN` из окружения родительского процесса — ровно так же, как CLI:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Для self-hosted GitFlic дополнительно: `export GITFLIC_API_BASE=https://git.example.com`.

## Регистрация в MCP-хосте

### Claude Code

```bash
claude mcp add gitflic --env GITFLIC_TOKEN=xxxxxxxx -- npx -y gitflic-cli-mcp
```

Или вручную в `~/.claude.json`:

```json
{
  "mcpServers": {
    "gitflic": {
      "command": "npx",
      "args": ["-y", "gitflic-cli-mcp"],
      "env": { "GITFLIC_TOKEN": "xxxxxxxx" }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

Та же структура. Перезапустите хост. (Из исходников: `"command": "node", "args": ["/absolute/path/to/gitflic-cli/mcp-server/server.mjs"]`.)

## Тулзы (77) — основные

Ниже — выборка; полный список из 77 тулзов хост получает по `tools/list`.

| Тулз | Маппится на |
|---|---|
| `gitflic_auth` | `gitflic auth` |
| `gitflic_project_resolve` | `gitflic project get` |
| `gitflic_mr_list` / `view` / `diff` | `gitflic mr list/view/diff` |
| `gitflic_mr_create` | `gitflic mr create` (авто from→to) |
| `gitflic_mr_approve` / `merge` / `close` | `gitflic mr approve/merge/close` |
| `gitflic_mr_comment` (общий + инлайн-якорный) | `gitflic mr comment` |
| `gitflic_mr_discuss_list` / `reply` / `resolve` | `gitflic mr discuss …` |
| `gitflic_issue_list` / `view` / `create` / `close` / `comment` | `gitflic issue …` |
| `gitflic_branch_list` / `create` / `delete` | `gitflic branch …` |
| `gitflic_tag_list` / `create` | `gitflic tag …` |
| `gitflic_release_list` / `create` | `gitflic release …` |
| `gitflic_commit_list` | `gitflic commit list` |
| `gitflic_user_me` / `gitflic_user_search` | `gitflic user …` |
| `gitflic_project_list_my` | `gitflic project list --scope my` |
| `gitflic_webhook_list` | `gitflic webhook list` |
| `gitflic_branch_protection_list` | `gitflic branch protection list` |

Эта таблица — лишь самые ходовые тулзы. Всего их 77 (каждая команда CLI имеет свой тул); что не попало в таблицу — всё равно доступно как MCP-тул или через `gitflic …` напрямую.

## Как это работает

```
[Claude Code / Cursor]
        │   JSON-RPC по stdio
        ▼
  mcp-server/server.mjs
        │   тулз-вызов после zod-валидации
        ▼
  mcp-server/runner.mjs   ── spawn ──►  node …/gitflic-cli/lib/gitflic.mjs mr create --title "…" --format json
        │
        ▼
  распарсенный JSON-ответ
```

Каждый хендлер тулза возвращает `["gitflic", "subcommand", "--flag", "value", …, "--format", "json"]`. Runner форсит добавление `--format json` в конец, парсит и возвращает структурированные данные.

При ненулевом коде выхода (HTTP 422, 403, 404) тулз возвращает `isError: true` с текстом ошибки от gitflic — агент видит сбой и может восстановиться.

## Расширение

Добавьте тулз, дописав в `TOOLS` в `tools.mjs`:

```js
{
  name: "gitflic_release_delete",
  description: "Delete a release by uuid.",
  inputSchema: {
    type: "object",
    required: ["project", "uuid"],
    properties: { project: { type: "string" }, uuid: { type: "string" } },
  },
  handler: (a) => ["release", "delete", a.uuid, "--project", a.project, "--format", "json"],
}
```

Отдельного кода регистрации нет — цикл в `server.mjs` подхватит тулз автоматически.

## Лицензия

MIT (как у родительского проекта).
