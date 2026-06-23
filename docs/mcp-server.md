# MCP-сервер для AI-агентов

`mcp-server/` — это [Model Context Protocol](https://modelcontextprotocol.io) сервер, оборачивающий CLI `gitflic` в **типизированные тулзы** для AI-агентов (Claude Code, Cursor и т.п.).

## Что внутри

```
mcp-server/
├── server.mjs              # MCP stdio сервер
├── tools.mjs               # описания тулзов (имя, описание, JSON-схема)
├── runner.mjs              # child_process-обёртка: node <gitflic CLI> <args>
├── project-resolver.mjs    # авто-резолв project из git remote
└── __tests__/              # vitest
```

77 инструментов — каждый маппится 1-в-1 на подкоманду CLI.

## Установка и запуск

Сервер опубликован в npm как `gitflic-cli-mcp` и запускается через `npx` — ставить ничего не нужно:

```bash
GITFLIC_TOKEN="xxxx" npx -y gitflic-cli-mcp
```

`npx` сам подтянет `gitflic-cli-mcp` и его зависимости (`@modelcontextprotocol/sdk`, `zod`) и сам CLI `gitflic-cli`. Из исходников — то же самое вручную:

```bash
cd mcp-server && npm install
GITFLIC_TOKEN="xxxx" node server.mjs
```

## Настройка токена

MCP-сервер наследует `GITFLIC_TOKEN` от родительского процесса — так же, как CLI:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Если токен лежит в OS keychain (через `gitflic auth login`), MCP-сервер тоже его увидит — он запускает `gitflic` CLI как subprocess, а тот умеет резолвить из keychain.

## Конфигурация в Claude Code / Cursor

### Claude Code

Одной командой:

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
      "command": "npx",
      "args": ["-y", "gitflic-cli-mcp"],
      "env": {
        "GITFLIC_TOKEN": "xxxxxxxx"
      }
    }
  }
}
```

> Из исходников вместо `npx -y gitflic-cli-mcp` укажи `"command": "node", "args": ["/path/to/gitflic-cli/mcp-server/server.mjs"]`.

## Ограничение набора тулзов (экономия контекста)

Все 77 тулзов уходят хосту по `tools/list` ещё до первого вызова — это ~6K токенов «налога» на контекст модели. Если агенту нужны не все, набор сужается через **env-переменные** — в том же `env`-блоке конфига, где `GITFLIC_TOKEN`:

| Переменная | Значение | Что делает |
|---|---|---|
| `GITFLIC_MCP_GROUPS` | список групп через запятую/пробел | оставить только тулзы указанных групп |
| `GITFLIC_MCP_READONLY` | `1` / `true` / `yes` / `on` | оставить только read-only тулзы (без мутаций) |
| `GITFLIC_MCP_NO_DESTRUCTIVE` | `1` / `true` / `yes` / `on` | убрать деструктивные (удаление) тулзы |
| `GITFLIC_MCP_TOOLS` | список имён тулзов | явный allowlist (приоритет над `GROUPS`) |
| `GITFLIC_MCP_EXCLUDE` | список имён тулзов | убрать конкретные тулзы (применяется последним) |

Все опциональны; без них регистрируются все 77. Неизвестные имена/группы не валят старт — сервер пишет `WARN` в stderr и игнорирует их. Регистр в списках не важен.

**Порядок применения:** базовый набор (`GITFLIC_MCP_TOOLS` → иначе `GITFLIC_MCP_GROUPS` → иначе все) → пересечение с read-only при `GITFLIC_MCP_READONLY` (накладывается и на allowlist, так что write-тул не «протечёт» в read-only режим) → вычитание деструктивных при `GITFLIC_MCP_NO_DESTRUCTIVE` → вычитание `GITFLIC_MCP_EXCLUDE` в конце.

**`GITFLIC_MCP_NO_DESTRUCTIVE=1`** жёстко убирает (на уровне регистрации, не через approval-prompt) **только удаляющие** тулзы — 7 шт. на `_delete`: `issue_delete`, `issue_comments_delete`, `mr_discuss_delete`, `branch_delete`, `branch_protection_delete`, `release_delete`, `webhook_delete`. Остальные мутации (`*_create` / `*_edit` / `*_close` / `gitflic_mr_merge`) остаются и идут через подтверждение хоста (`destructiveHint:true`). Это надёжнее approval'а, который можно прокликать.

**Допустимые значения `GITFLIC_MCP_GROUPS`** (группа = первый сегмент имени после `gitflic_`):

| Группа | Тулзов | Read / Write |
|---|---|---|
| `auth` | 8 | 3 / 5 |
| `blob` | 2 | 2 / 0 |
| `branch` | 10 | 5 / 5 |
| `commit` | 4 | 4 / 0 |
| `issue` | 12 | 4 / 8 |
| `mr` | 15 | 5 / 10 |
| `project` | 7 | 4 / 3 |
| `release` | 6 | 3 / 3 |
| `tag` | 3 | 2 / 1 |
| `user` | 5 | 5 / 0 |
| `webhook` | 5 | 2 / 3 |

> ⚠️ Группа `auth` содержит мутирующие тулзы (`_login` / `_logout` / `_switch` / `_bind` / `_unbind`) — они меняют локальный keychain/конфиг. Для «только проверка личности» добавь `GITFLIC_MCP_READONLY=1` или перечисли нужное через `GITFLIC_MCP_TOOLS`.

```bash
# Только MR и issue (27 тулзов вместо 77)
claude mcp add gitflic --env GITFLIC_TOKEN=xxxx \
  --env GITFLIC_MCP_GROUPS=mr,issue -- npx -y gitflic-cli-mcp

# Read-only агент для код-ревью (39 read-only тулзов)
GITFLIC_MCP_READONLY=1 npx -y gitflic-cli-mcp

# Может всё, кроме удаления (70 тулзов)
GITFLIC_MCP_NO_DESTRUCTIVE=1 npx -y gitflic-cli-mcp
```

```json
{
  "mcpServers": {
    "gitflic": {
      "command": "npx",
      "args": ["-y", "gitflic-cli-mcp"],
      "env": {
        "GITFLIC_TOKEN": "xxxx",
        "GITFLIC_MCP_GROUPS": "mr,issue",
        "GITFLIC_MCP_READONLY": "1"
      }
    }
  }
}
```

Полный список всех 77 тулзов с пометкой R/W — в [README MCP-сервера](https://gitflic.ru/project/tikhon/gitflic-cli/blob?file=mcp-server%2FREADME.md). Совет: можно держать два подключения — `gitflic` (полный) и `gitflic-ro` (`GITFLIC_MCP_READONLY=1`), либо класть конфиг в проектный `.mcp.json` / `.cursor/mcp.json`, чтобы в каждом репозитории грузились свои группы.

## Сжатие ответов (экономия токенов)

GitFlic REST API отдаёт «сырой» JSON с кучей бесполезного для LLM шума: URL аватаров/обложек, `hexColor` лейблов, `status` из 9 полей, вложенные объекты юзеров целиком, HAL-обёртки `_embedded`/`_links`. По умолчанию (с `gitflic-cli-mcp@0.4.0`) MCP **сжимает** ответы перед отдачей модели: разворачивает list-обёртку в `{ items, total, matched, returned }`, проецирует каждую сущность до нужных полей, схлопывает мусор. На реальных данных — **≈70% меньше токенов** (на коммитах/ветках до 84%). CLI `--format json` при этом остаётся «сырым» — сжатие живёт только в MCP-слое.

| Переменная / аргумент | Значения | Эффект |
| --- | --- | --- |
| `GITFLIC_MCP_OUTPUT` | `slim` (по умолч.) / `full` (=`raw`) | глобальный режим: `full` = старый сырой ответ один-в-один |
| `GITFLIC_MCP_RAW` | `1` / `true` / `yes` / `on` | то же, что `OUTPUT=full` (булев алиас, побеждает при конфликте) |
| аргумент `raw: true` | на **любом** тулзе | вернуть полный несжатый ответ для **одного** вызова |
| аргумент `fields: [...]` | на read/list тулзах | вернуть только указанные поля (+ id-ключи) |

**Фильтрация списков на стороне MCP.** У GitFlic почти нет серверных фильтров для списков, поэтому list-тулзы принимают аргументы фильтра/сортировки (`label`, `q`, `assignee`, `status`, `author`, `sort`, `limit`, …). При их наличии хендлер автоматически дотягивает `--all`, фильтрует и возвращает только совпадения + `matched`/`total`. Напр. «найди открытые issue с лейблом Безопасность» вернёт совпадения вместо всех задач.

**Секреты вебхуков.** В slim-режиме `secret` маскируется в `secretSet: true|false` (сырой ответ его раньше **утекал** в модель). Прочитать реальное значение можно тулзом `gitflic_webhook_reveal_secret` — он помечен деструктивным, поэтому MCP-хост спросит подтверждение перед выдачей.

## Примеры использования (в Claude Code)

После подключения агент получает доступ к 77 тулам. Несколько типичных сценариев:

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

- ✅ ~~Read-only mode~~ — готово: `GITFLIC_MCP_READONLY=1` (см. [«Ограничение набора тулзов»](#ограничение-набора-тулзов-экономия-контекста)).
- ❌ OAuth browser flow для токена (вместо env-var).
- ❌ Audit log (кто какую тулзу вызвал).

Если нужно — issue/PR.

## Annotations: деструктивные операции требуют approval

Все 77 тулов помечены MCP-аннотациями ([MCP 2025-06-18 spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#toolannotations)):

```json
{
  "name": "gitflic_mr_close",
  "annotations": {
    "title": "MR Close",
    "readOnlyHint": false,
    "destructiveHint": true,   // ← клиент запросит подтверждение
    "idempotentHint": true,    // повторный вызов = то же состояние
    "openWorldHint": true      // ходит в GitFlic API
  }
}
```

| Hint | Когда `true` | Когда `false` |
|---|---|---|
| `readOnlyHint` | list / get / view / search / me / status | create / edit / delete / merge |
| `destructiveHint` | (почти всегда — дефолт) | только чисто read-only тулзы |
| `idempotentHint` | close / cancel / delete / bind / set (повтор → то же состояние) | approve (toggle), pipeline start (новый run) |
| `openWorldHint` | любой тул, ходящий в GitFlic API | только локальные (auth login/logout, alias set, cache clear) |

### Что это даёт

Хосты вроде **Claude Code** и **Cursor** при получении тулза с `destructiveHint: true` показывают пользователю prompt:

```
gitflic_mr_close wants to close merge request #42 on project FerdBur/wave.

Approve? [y/N]
```

Это защита от runaway-агентов, которые могут снести прод случайным вызовом `mr_close` или `issue_delete`.

### Как это работает внутри

Аннотации живут в `mcp-server/tools.mjs` рядом с каждым тулзом:

```js
{
  name: "gitflic_mr_close",
  description: "...",
  inputSchema: { ... },
  annotations: {
    title: "MR Close",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: (a) => ["mr", "close", a.localId, "--project", a.project],
}
```

`server.mjs` пробрасывает annotations в `server.tool(name, desc, schema, annotations, handler)` — MCP SDK v1.x их нативно поддерживает и шлёт хосту в `tools/list` ответе.

### Re-classification after adding new tools

Если добавляешь новый тул в `tools.mjs`, прогони классификатор:

```bash
node scripts/annotate-mcp-tools.mjs
```

Скрипт идёт по TOOLS-массиву, классифицирует каждый по суффиксу/префиксу имени, и вставляет `annotations: {...}` если его ещё нет. Полностью идемпотентен — повторный запуск ничего не дублирует.

Логика классификации — в `scripts/annotate-mcp-tools.mjs` (~150 LOC, без зависимостей).

### Caveats

- `destructiveHint` **не означает "обязательно удалит"** — это hint, что *может*. Хосты используют его для UI prompt, но не для блокировки.
- Если хост не поддерживает annotations (старые версии), всё работает как раньше — annotations просто игнорируются.
- `idempotentHint` используется MCP-хостами для авто-retry, но в нашей реализации retry сам делает CLI (через `GITFLIC_HTTP_RETRIES`). Так что это скорее hint для пользователя.
