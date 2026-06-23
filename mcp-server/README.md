# gitflic-cli MCP-сервер

[Model Context Protocol](https://modelcontextprotocol.io/) сервер, оборачивающий CLI `gitflic` и отдающий **76 типизированных тулзов** поверх команд GitFlic REST для AI-агентов (Claude Code, Cursor и т.п.).

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

## Ограничение набора тулзов (экономия контекста)

Все 76 тулзов уходят хосту по `tools/list` ещё до первого вызова — это ~6K токенов «налога» на контекст модели. Если агенту нужны не все, набор можно сузить через **env-переменные** — прописываются в том же `env`-блоке конфига, где `GITFLIC_TOKEN` (своего конфиг-файла у сервера нет, он читает `process.env` при старте).

| Переменная | Значение | Что делает |
|---|---|---|
| `GITFLIC_MCP_GROUPS` | список групп через запятую/пробел | оставить только тулзы указанных групп |
| `GITFLIC_MCP_READONLY` | `1` / `true` / `yes` / `on` | оставить только read-only тулзы (без мутаций) |
| `GITFLIC_MCP_NO_DESTRUCTIVE` | `1` / `true` / `yes` / `on` | убрать деструктивные тулзы (удаление) — см. ниже |
| `GITFLIC_MCP_TOOLS` | список имён тулзов | явный allowlist (имеет приоритет над `GROUPS`) |
| `GITFLIC_MCP_EXCLUDE` | список имён тулзов | убрать конкретные тулзы (применяется последним) |

Все — опциональные. Без них регистрируются все 76 (как и раньше). Неизвестные группы/имена не валят сервер — он пишет `WARN` в stderr и игнорирует их.

**Порядок применения (precedence):**

1. Базовый набор: `GITFLIC_MCP_TOOLS`, если задан; иначе `GITFLIC_MCP_GROUPS`, если задан; иначе — все тулзы.
2. `GITFLIC_MCP_READONLY` — пересечение с read-only (накладывается поверх **в т.ч. на `GITFLIC_MCP_TOOLS`** — write-тул, явно указанный в allowlist, всё равно будет отсеян; так read-only режим гарантированно не пропускает мутации).
3. `GITFLIC_MCP_NO_DESTRUCTIVE` — вычитает деструктивные (удаление) тулзы (поверх базы/READONLY).
4. `GITFLIC_MCP_EXCLUDE` — вычитается в самом конце (всегда побеждает).

Значения списков — через запятую или пробел; регистр не важен ни для групп, ни для имён тулзов (имена всегда в нижнем регистре).

**Допустимые значения `GITFLIC_MCP_GROUPS`** (группа = первый сегмент имени после `gitflic_`):

| Группа | Тулзов | Read / Write |
|---|---|---|
| `auth` | 8 | 3 read / 5 write |
| `blob` | 2 | 2 read / 0 write |
| `branch` | 10 | 5 read / 5 write |
| `commit` | 4 | 4 read / 0 write |
| `issue` | 12 | 4 read / 8 write |
| `mr` | 15 | 5 read / 10 write |
| `project` | 7 | 4 read / 3 write |
| `release` | 6 | 3 read / 3 write |
| `tag` | 3 | 2 read / 1 write |
| `user` | 5 | 5 read / 0 write |
| `webhook` | 4 | 2 read / 2 write |

> ⚠️ Группа `auth` включает **мутирующие** тулзы (`gitflic_auth_login`, `_logout`, `_switch`, `_bind`, `_unbind`) — они меняют локальный keychain/конфиг, а не сервер, но это всё равно запись. Если нужны только проверки личности — добавь `GITFLIC_MCP_READONLY=1` (останутся `gitflic_auth`, `_list`, `_bindings`) или используй `GITFLIC_MCP_TOOLS` с точным набором.

**`GITFLIC_MCP_NO_DESTRUCTIVE=1` — выключить удаление одним флагом.**

Жёстко (на уровне регистрации, не через approval-prompt хоста) убирает **только удаляющие** тулзы — модель их вообще не видит. Это надёжнее, чем полагаться на подтверждение в хосте, которое можно прокликать или «разрешить всё агенту».

Деструктивный набор (7 — всё, что заканчивается на `_delete`):

`gitflic_issue_delete` · `gitflic_issue_comments_delete` · `gitflic_mr_discuss_delete` · `gitflic_branch_delete` · `gitflic_branch_protection_delete` · `gitflic_release_delete` · `gitflic_webhook_delete`

Остальные мутации (`*_create`, `*_edit`, `*_close`, `*_cancel`, `gitflic_mr_merge` и т.п.) **остаются** — у них сохраняется `destructiveHint: true`, так что хост по-прежнему спрашивает подтверждение. `gitflic_mr_merge` необратим, но это не удаление — он намеренно вне флага и идёт через approval.

**Примеры:**

```bash
# Только MR и issue (~27 тулзов вместо 76)
claude mcp add gitflic --env GITFLIC_TOKEN=xxxx \
  --env GITFLIC_MCP_GROUPS=mr,issue -- npx -y gitflic-cli-mcp

# Read-only агент для код-ревью (только тулзы без мутаций)
GITFLIC_MCP_READONLY=1 npx -y gitflic-cli-mcp

# Может всё, кроме удаления (69 тулзов: создаёт/правит/мёрджит — но не удаляет)
GITFLIC_MCP_NO_DESTRUCTIVE=1 npx -y gitflic-cli-mcp

# Точный набор из четырёх тулзов
GITFLIC_MCP_TOOLS="gitflic_mr_list,gitflic_mr_view,gitflic_mr_diff,gitflic_mr_create" \
  npx -y gitflic-cli-mcp
```

В JSON-конфиге это тот же `env`-блок:

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

> Можно поднять один и тот же сервер дважды под разными именами — напр. `gitflic` (полный) и `gitflic-ro` (`GITFLIC_MCP_READONLY=1`) — и держать оба подключёнными. Либо класть конфиг в проектный `.mcp.json` / `.cursor/mcp.json`, чтобы в каждом репозитории грузились свои группы.

## Сжатие ответов (экономия токенов)

GitFlic REST API отдаёт «сырой» JSON с кучей бесполезного для LLM шума: URL аватаров/обложек, `hexColor` лейблов, `status` из 9 полей, вложенные объекты юзеров целиком, HAL-обёртки `_embedded`/`_links`. По умолчанию MCP **сжимает** ответы перед отдачей модели: разворачивает list-обёртку в `{ items, total, matched, returned }`, проецирует каждую сущность до нужных полей и схлопывает мусор. На реальных данных — **≈70% меньше токенов** (на коммитах/ветках до 84%). CLI `--format json` при этом остаётся «сырым» — сжатие живёт только в MCP-слое.

| Переменная / аргумент | Значения | Эффект |
| --- | --- | --- |
| `GITFLIC_MCP_OUTPUT` | `slim` (по умолч.) / `full` (=`raw`) | глобальный режим: `full` = старый сырой ответ один-в-один |
| `GITFLIC_MCP_RAW` | `1`/`true`/`yes`/`on` | то же, что `OUTPUT=full` (булев алиас, побеждает при конфликте) |
| аргумент `raw: true` | на **любом** тулзе | вернуть полный несжатый ответ для **одного** вызова — если модели не хватило поля в slim-виде |
| аргумент `fields: [...]` | на read/list тулзах | вернуть только указанные поля (+ id-ключи) |

**Фильтрация списков на стороне MCP.** У GitFlic почти нет серверных фильтров для списков, поэтому list-тулзы принимают аргументы фильтра/сортировки (`label`, `q`, `assignee`, `status`, `author`, `name`, `sort`, `limit`, …). При их наличии хендлер автоматически дотягивает `--all` (полный набор), фильтрует и возвращает только совпадения + `matched`/`total`. Напр. «найди открытые issue с лейблом Security» вернёт 3 совпадения вместо всех 60.

**Секреты вебхуков.** В slim-режиме `secret` маскируется в `secretSet: true|false` — сырой ответ его раньше **утекал** в модель. Прочитать реальное значение можно тулзом `gitflic_webhook_reveal_secret` — он помечен деструктивным, поэтому MCP-хост спросит подтверждение перед выдачей.

## Все 77 тулзов

Полный список по группам. **R** = read-only (`readOnlyHint: true`, не меняет состояние — попадает в `GITFLIC_MCP_READONLY=1`); **W** = write/мутация.

### `auth` (8)
`R` `gitflic_auth` · `W` `gitflic_auth_login` · `W` `gitflic_auth_logout` · `R` `gitflic_auth_list` · `W` `gitflic_auth_switch` · `W` `gitflic_auth_bind` · `W` `gitflic_auth_unbind` · `R` `gitflic_auth_bindings`

### `blob` (2)
`R` `gitflic_blob_get` · `R` `gitflic_blob_files`

### `branch` (10)
`R` `gitflic_branch_list` · `W` `gitflic_branch_create` · `W` `gitflic_branch_delete` · `R` `gitflic_branch_get` · `R` `gitflic_branch_default` · `R` `gitflic_branch_protection_list` · `R` `gitflic_branch_protection_get` · `W` `gitflic_branch_protection_create` · `W` `gitflic_branch_protection_edit` · `W` `gitflic_branch_protection_delete`

### `commit` (4)
`R` `gitflic_commit_list` · `R` `gitflic_commit_get` · `R` `gitflic_commit_files` · `R` `gitflic_commit_compare`

### `issue` (12)
`R` `gitflic_issue_list` · `R` `gitflic_issue_view` · `W` `gitflic_issue_create` · `W` `gitflic_issue_close` · `W` `gitflic_issue_comment` · `W` `gitflic_issue_edit` · `W` `gitflic_issue_reopen` · `W` `gitflic_issue_delete` · `R` `gitflic_issue_comments_list` · `W` `gitflic_issue_comments_edit` · `W` `gitflic_issue_comments_delete` · `R` `gitflic_issue_relations_list`

### `mr` (15)
`R` `gitflic_mr_list` · `R` `gitflic_mr_view` · `R` `gitflic_mr_diff` · `R` `gitflic_mr_by_commit` · `R` `gitflic_mr_discuss_list` · `W` `gitflic_mr_create` · `W` `gitflic_mr_approve` · `W` `gitflic_mr_merge` · `W` `gitflic_mr_close` · `W` `gitflic_mr_cancel` · `W` `gitflic_mr_edit` · `W` `gitflic_mr_comment` · `W` `gitflic_mr_discuss_reply` · `W` `gitflic_mr_discuss_resolve` · `W` `gitflic_mr_discuss_delete`

### `project` (7)
`R` `gitflic_project_resolve` · `R` `gitflic_project_get` · `R` `gitflic_project_list_my` · `R` `gitflic_project_member_list` · `W` `gitflic_project_create` · `W` `gitflic_project_edit` · `W` `gitflic_project_member_invite`

### `release` (6)
`R` `gitflic_release_list` · `R` `gitflic_release_get` · `R` `gitflic_release_latest` · `W` `gitflic_release_create` · `W` `gitflic_release_edit` · `W` `gitflic_release_delete`

### `tag` (3)
`R` `gitflic_tag_list` · `R` `gitflic_tag_get` · `W` `gitflic_tag_create`

### `user` (5)
`R` `gitflic_user_me` · `R` `gitflic_user_search` · `R` `gitflic_user_get` · `R` `gitflic_user_projects` · `R` `gitflic_user_followers`

### `webhook` (5)
`R` `gitflic_webhook_list` · `R` `gitflic_webhook_get` · `W` `gitflic_webhook_create` · `W` `gitflic_webhook_delete` · `W` `gitflic_webhook_reveal_secret` (требует подтверждения хоста)

Итого: **39 read / 38 write**. Каждый тул маппится 1-в-1 на подкоманду CLI (`gitflic …`).

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
