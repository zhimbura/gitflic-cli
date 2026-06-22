# Команды

Полный справочник по всем 21 модулю CLI. Каждый модуль — отдельная страница с примерами и флагами.

## Содержание

- **[`auth`](auth/README.md)** — login, logout, status, multi-account, per-project bindings.
- **[`mr`](mr.md)** — merge requests (list, view, diff, create, approve, merge, close, comments, discussions).
- **[`branch`](branch-tag.md#branch)** / **[`tag`](branch-tag.md#tag)** — управление ветками и тегами + protection rules.
- **[`release`](release.md)** — релизы + multipart upload ассетов.
- **[`issue`](issue.md)** — задачи + комментарии + relations + attachment upload.
- **[`commit`](commit-blob.md#commit)** — коммиты, diff, cherry-pick.
- **[`blob`](commit-blob.md#blob)** — файлы и архивы репозитория.
- **[`project`](project.md)** — CRUD проектов, members, teams, fork, mirror, import, deploy tokens.
- **[`user`](user-team.md#user)** — поиск юзеров, profile info, followers.
- **[`team`](user-team.md#team)** — команды GitFlic.
- **[`company`](user-team.md#company)** — компании.
- **[`environment`](cicd-webhook.md#environment)** — environment protection.
- **[`webhook`](cicd-webhook.md#webhook)** — вебхуки проекта.
- **[`registry`](registry.md)** — реестр пакетов (instance/company/project scopes).
- **[`cicd`](cicd-webhook.md#cicd)** — пайплайны и джобы.
- **[`runner`](cicd-webhook.md#runner)** — CI/CD runners.
- **[`admin`](commands/admin.md)** — admin endpoints (только для админов).
- **[`saml`](commands/saml.md)** — SAML SSO (admin only).
- **[`cache`](commands/cache.md)** — локальный кеш project UUID.
- **[`completion`](commands/completion.md)** — shell completion (bash/zsh/fish).
- **[`alias`](commands/alias.md)** — persistent user config.

## Глобальные флаги

Почти все команды принимают:

| Флаг | Что делает | Default |
|---|---|---|
| `--project <owner>/<alias>` | Целевой проект | авто-детект из `git remote get-url origin` или из `default-project` config |
| `--api-base <url>` | API endpoint | `https://api.gitflic.ru` или `GITFLIC_API_BASE` |
| `--token <token>` | Токен (per-call override) | из env / keychain / active-account |
| `--format json\|pretty` | Формат вывода | pretty для list, json для single |
| `--page <n>` | Номер страницы (1-based) | 1 |
| `--size <n>` | Размер страницы | 20 (зависит от эндпоинта) |
| `--all` | Авто-пагинация до конца | false |
| `--stream` | NDJSON в stdout (для пайплайнов) | false |
| `-h`, `--help` | Справка по команде | — |

## Глобальные ENV переменные

См. [env.md](../env.md) — полный список.

Самые важные:

- `GITFLIC_TOKEN` — override токена (полезно в CI).
- `GITFLIC_API_BASE` — для self-hosted.
- `GITFLIC_HTTP_RETRIES` — макс. ретраев на 429/502/503/504 (default 3).
- `GITFLIC_NO_RETRY=1` — отключить ретраи.
- `GITFLIC_NO_CACHE=1` — отключить кеш project UUID.
- `GITFLIC_NO_CONFIG=1` — отключить чтение `~/.config/gitflic-cli/config.json`.
- `GITFLIC_NO_SECRET_STORE=1` — отключить хранение токенов в keychain (только env var).
- `NO_COLOR=1` / `FORCE_COLOR=1` — управление цветом (по [no-color.org](https://no-color.org)).

## Выход и пайплайны

### Stable JSON

Каждая команда с `--format json` (или при одиночном запросе) выдаёт стабильный JSON. Exit code = 0 при успехе, 1 при любой HTTP-ошибке.

```bash
gitflic mr list --project tikhon/wave --format json | jq '._embedded.mergeRequestModelList | length'
```

### NDJSON streaming

`--stream` (или `GITFLIC_STREAM=1`) — одна JSON-запись на строку, не дожидаясь конца пагинации:

```bash
gitflic mr list --project tikhon/wave --all --stream | jq -c 'select(.status.id == "OPENED") | {id: .localId, title: .title}'
```

Идеально для долгих запросов в большие репо — видишь результаты сразу, а не через минуту после полной пагинации.

### TUI mode

`gitflic mr list --tui` — интерактивный браузер в TTY. Управление: `j/k` (next/prev), `g/G` (top/bottom), `Enter` (print localId в stdout, удобно для пайпа), `q/Esc` (выход).

```bash
gitflic mr list --tui --project FerdBur/wave
```

Подробнее — [mr.md](mr.md#tui-mode).

## Ошибки и коды возврата

| Exit code | Значение |
|---|---|
| 0 | Успех |
| 1 | HTTP-ошибка (4xx/5xx), network error, или `die()` от любой проверки |
| 2 | Usage error (не хватает аргументов, плохой формат) |

В stderr — человекочитаемое объяснение с URL и HTTP status. В stdout (если `--format json`) — JSON с полями `{ message, error, ... }`.

## Конфигурация

CLI хранит persistent state в:

- **macOS** → `~/Library/Keychains/login.keychain-db` (зашифровано)
- **Linux** → GNOME Keyring / KWallet (зашифровано)
- **иначе** → `~/.config/gitflic-cli/config.json` (`chmod 0600`)

Управляется через [alias](../commands/alias.md) (config-ключи) и [auth](../auth/README.md) (токены + привязки).

## Отладка

```bash
GITFLIC_HTTP_RETRIES=0 GITFLIC_NO_RETRY=1 gitflic mr list --project x/y
# Без ретраев — увидишь оригинальную ошибку сразу.

gitflic mr list --project x/y --format json | jq .
# Сырой JSON для inspection.

gitflic --help
# Полный help по top-level командам.
```
