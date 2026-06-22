# Флаги

## Глобальные (почти все команды)

| Флаг | Короткая | Аргумент | Default | Описание |
|---|---|---|---|---|
| `--project` | `-p` | `owner/alias` | авто-детект или `default-project` | Целевой проект |
| `--api-base` | | URL | `https://api.gitflic.ru` | API endpoint |
| `--token` | | строка | — | Токен (per-call override) |
| `--format` | `-f` | `json\|pretty` | auto | Формат вывода |
| `--page` | | число | `1` | Номер страницы |
| `--size` | | число | endpoint-specific | Размер страницы |
| `--all` | | флаг | false | Авто-пагинация до конца |
| `--stream` | | флаг | false | NDJSON output |
| `--tui` | | флаг | false | Интерактивный браузер (где применимо) |
| `--json` | | флаг | false | Эквивалент `--format json` |
| `--pretty` | | флаг | false | Эквивалент `--format pretty` |
| `--help` | `-h` | флаг | false | Справка |
| `--no-remove-branch` | | флаг | false | Для `mr merge`: не удалять source-ветку |
| `--no-color` | | флаг | false | Отключить цвета (per-call override `NO_COLOR`) |

## Специфичные для модулей

### mr

- `--title <text>` — заголовок MR
- `--description <text>` — описание
- `--to <branch>` — target ветка
- `--from <branch>` — source ветка (default = текущая)
- `--squash` — squash при merge
- `--squash-message <text>` — сообщение коммита при squash merge
- `--message <text>` — merge commit message
- `--new-path <p>` `--new-line <n>` — для inline-комментариев (new side)
- `--old-path <p>` `--old-line <n>` — для inline-комментариев (old side)

### branch

- `--from <branch>` — базовая ветка при создании
- `--base <branch>` — база при compare
- `--branch-template <pattern>` — для protection rules
- `--allowed-to-push <NO_ONE\|DEVELOPER\|ADMINS>`
- `--allowed-to-merge <NO_ONE\|DEVELOPER\|ADMINS>`
- `--allow-force-push`
- `--code-owner-approval`
- `--auto-merge`

### release

- `--title <text>` — заголовок релиза
- `--description <text>` — release notes
- `--tag <vN[.N[.N]]>` — связанный тег
- `--pre-release` — пометить как pre-release
- `--attach-archive` — приложить архив при создании
- `--archive-format <tar\|zip\|tar.gz>`
- `--archive-path <file>` — путь к архиву
- `--name <name>` — для asset upload (default = basename)

### issue

- `--title <text>` `--description <text>`
- `--status <OPEN\|IN_PROGRESS\|CLOSED\|COMPLETED>`
- `--assign-to <userUuid>`
- `--label <labelUuid>`

### auth

- `--token <value>` — токен для login
- `--stdin` — читать токен из stdin
- `--as <name>` — named-аккаунт
- `--api-base <url>` — для login-валидации
- `--reveal` — показать полное значение sensitive ключа
- `--all` — для logout: удалить всё

### alias

- `--reveal` — для get: показать полное значение

## Boolean флаги

`--key` без значения = `true`. `--no-key` = `false`. Например:

```bash
gitflic mr merge 42 --squash              # flags.squash = true
gitflic mr merge 42 --no-remove-branch    # flags.removeBranch = false
```

## Парсинг

`parseArgs` в `lib/http.mjs`:
- `--key value` — два токена
- `--key=value` — один токен (тоже работает)
- `--key` (последний в строке) — boolean `true`
- `--no-key` — boolean `false`
- `-abc` — grouped short flags (`-abc` = `-a -b -c`)
- Всё остальное — позиционный аргумент в `flags._`.

## Пример

```bash
gitflic mr create --project FerdBur/wave \
  --title "Fix login" \
  --description "$(git log -1 --pretty=%B)" \
  --to main \
  --squash \
  --no-remove-branch \
  --format json
```
