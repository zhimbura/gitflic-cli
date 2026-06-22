# MCP-сервер для AI-агентов

`mcp-server/` — это [Model Context Protocol](https://modelcontextprotocol.io) сервер, оборачивающий CLI `gitflic` в **типизированные тулзы** для AI-агентов (Claude Code, Cursor и т.п.).

## Что внутри

```
mcp-server/
├── server.mjs              # MCP stdio сервер
├── tools.mjs               # описания тулзов (имя, описание, JSON-схема)
├── runner.mjs              # child_process-обёртка над bin/gitflic
├── project-resolver.mjs    # авто-резолв project из git remote
└── __tests__/              # vitest
```

77 инструментов — каждый маппится 1-в-1 на подкоманду CLI.

## Установка и запуск

```bash
cd mcp-server
npm install
# Один раз — нужна зависимость @modelcontextprotocol/sdk (≈2MB)
```

CLI `gitflic` сам по себе не требует npm-зависимостей, но MCP-сервер использует `@modelcontextprotocol/sdk` (~единственная dev-зависимость mcp-server).

## Настройка токена

MCP-сервер наследует `GITFLIC_TOKEN` от родительского процесса — так же, как CLI:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Если токен лежит в OS keychain (через `gitflic auth login`), MCP-сервер тоже его увидит — он запускает `bin/gitflic` как subprocess, а тот умеет резолвить из keychain.

## Конфигурация в Claude Code / Cursor

### Claude Code

В `~/.claude.json` (или через UI):

```json
{
  "mcpServers": {
    "gitflic": {
      "command": "node",
      "args": ["/path/to/gitflic-cli/mcp-server/server.mjs"],
      "env": {
        "GITFLIC_TOKEN": "xxxxxxxx"
      }
    }
  }
}
```

### Cursor

В `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gitflic": {
      "command": "node",
      "args": ["/path/to/gitflic-cli/mcp-server/server.mjs"]
    }
  }
}
```

## Примеры использования (в Claude Code)

После подключения агент получает доступ к 77 тулову. Несколько типичных сценариев:

```
> Создай MR из текущей ветки в main с описанием из последнего коммита

> Найди все открытые MR в проекте FerdBur/wave, которые ждут моего approve

> Закрой все issue старше 60 дней, которые в статусе OPEN и без assignee
```

Агент сам составляет правильные аргументы, валидирует результат, итерирует при ошибках.

## Авто-резолв проекта

`mcp-server/project-resolver.mjs` автоматически определяет `owner/alias` из `git remote get-url origin` — агенту не нужно каждый раз передавать `--project`:

```bash
cd ~/code/FerdBur/wave
# Агент теперь работает с FerdBur/wave по умолчанию для всех команд.
```

## Безопасность

MCP-сервер — **тонкая прослойка**: каждая тулза маппится 1-в-1 на CLI. Всё, что CLI может сделать, может и MCP-хост. Это и фича, и риск — следите за:

- Кто имеет доступ к MCP-хосту (любой промпт там может вызвать тулзы).
- Scope токена (минимизируйте: `PROJECT_READ` для read-only агентов).
- Не давайте токен с `ADMIN_*` scope без крайней нужды.

## Что в планах

- ❌ OAuth browser flow для токена (вместо env-var).
- ❌ Read-only mode (отдельный MCP-сервер с фильтром tools = только read-*).
- ❌ Audit log (кто какую тулзу вызвал).

Если нужно — issue/PR.
