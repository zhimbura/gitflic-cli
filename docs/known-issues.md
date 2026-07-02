---
description: "Известные ограничения GitFlic REST API и обходные пути в gitflic-cli: tag get 400, mr merge 422, архив проекта 404, загрузка ассетов 415 и другие."
---

# Известные проблемы и обходы

> CLI покрывает ~100% публичного REST API GitFlic. Перечисленные ниже ограничения — это
> поведение **серверной стороны** GitFlic (а не баги CLI) либо эндпоинты, которых в публичном
> REST просто нет. Команды реализованы по спецификации; ограничения снимаются на стороне сервиса.

## `tag get <name>` возвращает HTTP 400 для любого имени

**Симптом:**

```
gitflic tag get v1.0.0 --project FerdBur/wave
gitflic: HTTP 400 — ...
```

**Причина:** GitFlic отдаёт `400` на `GET /tag/{name}` для любого имени тега — это поведение API.

**Обход:** используйте `tag list` + фильтрацию:

```bash
gitflic tag list --project FerdBur/wave | grep v1.0.0
gitflic tag list --project FerdBur/wave --format json | jq '.[] | select(.name == "v1.0.0")'
```

---

## `tag delete` — нет REST-эндпоинта

Публичный REST GitFlic не предоставляет эндпоинт для удаления тегов.

**Обход:** удаляйте тег через git:

```bash
git push origin :v1.0.0   # удаление тега через push
```

---

## `mr merge` падает с `MergeCheckException` на свежих проектах

**Симптом:**

```
gitflic mr merge 1 --project myorg/new-repo
gitflic: HTTP 422 — MergeCheckException
```

**Причина:** branch protection по умолчанию требует approve от пользователя, который **не является
автором** MR. Это политика GitFlic по умолчанию, а не баг CLI.

**Обход:** получите approve своего MR от другой учётки, либо ослабьте branch protection через
Web UI / `gitflic branch protection edit`.

---

## `project archive` → HTTP 404 на публичном api.gitflic.ru

**Симптом:**

```
gitflic project archive owner/alias --out repo.zip
gitflic: HTTP 404 — Not Found
URL: GET https://api.gitflic.ru/project/owner/alias/file/getArchive
```

**Причина:** эндпоинт `/file/getArchive` отключён на публичном SaaS (скачивание архива доступно
только через Web UI). Команда реализована по спецификации.

**Обход:** используйте `git clone`:

```bash
git clone https://gitflic.ru/project/owner/alias.git
```

---

## `registry repo ...` (репозитории реестра) → 404 на публичном SaaS

Подкоманды управления репозиториями реестра (`registry repo ...`) относятся к
**Enterprise / Atlas**-функциональности и недоступны на публичном `api.gitflic.ru` (отдаёт `404`).
Реализованы по спецификации (code-only) и работают только на соответствующем инстансе.

Управление пакетами (`registry package ...`) на публичном SaaS работает.

---

## `release` — загрузка ассетов проверяется по типу файла (HTTP 415)

**Симптом:**

```
gitflic release upload v1.0.0 ./notes.txt --project owner/alias
gitflic: HTTP 415 — Unsupported Media Type
```

**Причина:** GitFlic валидирует тип загружаемого файла по allowlist на стороне сервера.
Архивы (`.zip` и т. п.) проходят; `.txt`, `.png` и ряд других типов могут отдавать `415`.
Это ограничение сервера, а не CLI.

**Обход:** упакуйте файл в архив:

```bash
zip notes.zip notes.txt
gitflic release upload v1.0.0 ./notes.zip --project owner/alias
```

---

## `team` / `company`: edit и delete — только Web UI (HTTP 405)

У GitFlic **нет** REST-эндпоинтов для редактирования и удаления команд и компаний — `PUT`/`DELETE`
возвращают `405 Method Not Allowed`. Создание, просмотр и управление участниками работают через REST.

**Обход:**

- Редактирование/удаление — через Web UI.
- Для передачи владения командой используйте `team transfer`:

```bash
gitflic team transfer my-team --to newowner
```

---

## `settings access-token create` может требовать HTTP Basic auth

Создание access-token на части инстансов требует **HTTP Basic auth** (логин + пароль), а не токен.

**Симптом:** `401`/`403` при `settings access-token create`.

**Обход:** создавайте токен через Web UI: **Профиль → API-токены → Создать**.

---

## HTTPS git push с токеном

HTTPS git push работает с access-токеном — токен передаётся в URL:

```bash
git push https://oauth2:<TOKEN>@gitflic.ru/project/<owner>/<alias>.git <branch>
```

Альтернатива — SSH-ключ:

```bash
gitflic settings ssh add ~/.ssh/id_ed25519.pub --title "macbook"
```

---

## `admin`, `saml`, instance-scoped `runner` — требуют прав инстанс-админа

Команды уровня инстанса реализованы по спецификации, но требуют **прав инстанс-администратора**.
С обычным токеном они отдают `403`/`404`:

- `gitflic admin user list` / `admin project list` — admin-эндпоинты инстанса.
- `gitflic saml ...` — настройки SAML SSO (только self-hosted с включённым SAML).
- `gitflic runner ...` в instance-scope — управление runner'ами на уровне инстанса.

**Обход:** используйте токен инстанс-админа либо Web UI. Project/team-scoped runner'ы при этом
доступны обычному токену.

---

## GitFlic отдаёт локализованные значения для некоторых полей

**Симптом:** `status.title` = «Открыт», «Слит», «Закрыт» (русский) вместо английских констант.

**Решение:** CLI передаёт `Accept-Language: en`, где это возможно, но не все эндпоинты это уважают.
Для машинной обработки используйте `status.id` — там всегда английские константы:
`OPENED`, `MERGED`, `CLOSED`, `CANCELED`, `FAILED`.

---

## `registry package` upload использует `--fmt` (не `--format`)

При загрузке пакета формат пакета задаётся флагом `--fmt`, потому что `--format` зарезервирован
под формат вывода (`json` | `pretty`):

```bash
gitflic registry package upload ./pkg.tgz --fmt npm --format json
```

---

## `npm install` в подпапке `mcp-server/`

CLI (`gitflic`) — **zero deps**, работает только на Node stdlib.

MCP-сервер (`mcp-server/`) требует `@modelcontextprotocol/sdk`. Это сознательное решение — MCP-протокол
слишком сложный, чтобы реализовать руками, а SDK небольшой (~2MB).

Если вы используете только CLI (не MCP), `npm install` в `mcp-server/` не нужен.

---

## Исправленные баги

- **BUG-001 — `mr diff` не декодировал HTML-entities (`&quot;`, `&lt;`, `&gt;`, `&amp;`).**
  ✅ **Исправлено.** Добавлен `htmlUnescape()` в `lib/format.mjs`, применяется к строкам диффа и
  заголовкам ханков в `printChanges()` (`lib/cmd/mr.mjs`). Декодирование однопроходное (`&amp;`
  обрабатывается без двойного прохода), покрыто тестами в `lib/__tests__/format.test.mjs`.

## См. также

- [Все команды](/commands/)
- [Покрытие API](api-coverage.md)
- [MCP-сервер](mcp-server.md)
