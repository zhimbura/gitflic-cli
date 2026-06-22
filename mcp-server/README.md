# gitflic-cli MCP-сервер

[Model Context Protocol](https://modelcontextprotocol.io/) сервер, оборачивающий CLI `gitflic` и отдающий ~30 эндпоинтов GitFlic REST как **типизированные тулзы** для AI-агентов (Claude Code, Cursor и т.п.).

## Что внутри

- `server.mjs` — MCP-сервер на stdio, регистрирует все тулзы, диспетчеризует в CLI.
- `tools.mjs` — описания тулзов (имя, описание, JSON-схема, билдер аргументов CLI).
- `runner.mjs` — обёртка над `child_process`, спавнит `../bin/gitflic` и парсит JSON.
- `package.json` — единственная зависимость `@modelcontextprotocol/sdk`.

MCP-сервер — это **тонкая прослойка**: каждая тулза маппится 1-в-1 на подкоманду CLI. Всё, что можно сделать через `gitflic …`, доступно и из MCP-хоста.

## Установка

```bash
cd mcp-server
npm install
```

Требуется Node 18+ и собранный бинарник `gitflic` по пути `../bin/gitflic` (родительский проект собирает его при первом запуске — отдельный шаг сборки не нужен, это чистый ESM).

## Настройка токена

Сервер читает `GITFLIC_TOKEN` из окружения родительского процесса — ровно так же, как CLI:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Для self-hosted GitFlic дополнительно: `export GITFLIC_API_BASE=https://git.example.com`.

## Регистрация в MCP-хосте

### Claude Code (`~/.claude/mcp_servers.json`)

```json
{
  "mcpServers": {
    "gitflic": {
      "command": "node",
      "args": ["/absolute/path/to/gitflic-cli/mcp-server/server.mjs"],
      "env": { "GITFLIC_TOKEN": "xxxxxxxx" }
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

Та же структура. Перезапустите хост.

## Тулзы (30)

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

Что не выставлено здесь — всё равно доступно через `gitflic …` напрямую: агенты могут дёргать шелл, если нужен менее ходовой эндпоинт.

## Как это работает

```
[Claude Code / Cursor]
        │   JSON-RPC по stdio
        ▼
  mcp-server/server.mjs
        │   тулз-вызов после zod-валидации
        ▼
  mcp-server/runner.mjs   ── spawn ──►  ../bin/gitflic mr create --title "…" --format json
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
