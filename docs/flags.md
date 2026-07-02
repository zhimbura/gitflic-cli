---
description: "Глобальные флаги gitflic-cli: --project, --api-base, --token, --format, --page/--size/--all, --stream и другие — как задаётся контекст команд."
---

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

## Scope-флаги (team/company/instance)

Многие сущности глобальны и работают в нескольких контекстах. Контекст задаётся
парой флагов: `--scope` + alias соответствующего владельца.

| Флаг | Аргумент | Описание |
|---|---|---|
| `--scope` | `project\|company\|team\|instance` | Контекст команды (default обычно `project`) |
| `--team` | `<teamAlias>` | Alias команды (для `--scope team`) |
| `--company` | `<companyAlias>` | Alias компании (для `--scope company`) |
| `--project` | `<owner>/<alias>` | Проект (для `--scope project`) |

```bash
# registry в контексте компании
gitflic registry package list --scope company --company acme --format json

# branch-protection команды
gitflic branch protection list --scope team --team backend --format json

# tag-protection компании
gitflic tag protection list --scope company --company acme
```

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
- `--file-path <p>` `--base-hash <h>` `--compare-hash <h>` — для `compare-file` / `commits`
- Branch-protection (`branch protection …`, по умолчанию scope `project`; для company/team — `--scope company|team` + `--company/--team <alias>`):
  - `--branch-template <pattern>` — паттерн ветки
  - `--allowed-to-push <NO_ONE\|DEVELOPER\|ADMINS>`
  - `--allowed-to-merge <NO_ONE\|DEVELOPER\|ADMINS>`
  - `--allow-force-push`
  - `--code-owner-approval`
  - `--auto-merge`

### tag

- `--branch <b>` / `--commit <hash>` — источник при `tag create` (branch по умолчанию `master`)
- `--message <text>` — сообщение тега
- Tag-protection (`tag protection …`, scope team/company — `--scope team|company` + `--team/--company <alias>`):
  - `--tag-template <pattern>` — паттерн тега
  - `--allow-to-create <NO_ONE\|DEVELOPER\|ADMINS>`

```bash
gitflic tag protection create --scope team --team backend \
  --tag-template 'v*' --allow-to-create ADMINS
```

### release

- `--title <text>` — заголовок релиза
- `--description <text>` — release notes
- `--tag <vN[.N[.N]]>` — связанный тег
- `--pre-release` — пометить как pre-release (в `edit` принимает `true|false`)
- `--attach-archive` — приложить архив при создании
- `--archive-format <tar\|zip\|tar.gz\|...>`
- `--name <name>` — имя файла для `release upload` (default = basename)
- `--out <path>` — путь сохранения для `release download` (default = `<fileUuid>`)

```bash
# загрузка/скачивание файлов релиза
gitflic release upload <releaseUuid> ./build.zip --name build.zip
gitflic release download <releaseUuid> <fileUuid> --out ./build.zip
```

> GitFlic проверяет тип загружаемого файла по allow-list: архивы (`.zip` и т.п.) проходят,
> а `.txt`/`.png` могут вернуть HTTP 415 — это ограничение сервера, не CLI.

### issue

- `--title <text>` `--description <text>`
- `--status <OPEN\|IN_PROGRESS\|CLOSED\|COMPLETED>`
- `--assign-to <userUuid>`
- `--label <labelUuid>`
- `--name <name>` — имя файла для `issue attach` (default = basename)

```bash
# загрузить файл в проект и привязать его к issue одной командой
gitflic issue attach 42 ./report.pdf --name report.pdf
```

### registry

Registry — глобальный модуль; контекст задаётся через `--scope` + `--project/--company`.

- `--scope <project\|company\|instance>` — контекст (default `project`)
- `--fmt <format>` — формат пакета для `package upload`/`package download`
  (`generic`, `maven`, `npm`, `pypi`, `nuget`, `composer`, `opm`, `cran`, `rubygem`, `cargo`, `conda`).
  **Это НЕ `--format`** — `--format` зарезервирован под вывод `json|pretty`.
- `--type <t>` — фильтр по типу при `package list`
- `--version <v>` — версия при `package files`
- `--content-type <mime>` — Content-Type при загрузке
- `--npm-scope <scope>` — npm-scope при загрузке npm-пакета
- `--out <path>` — путь сохранения для `package download`
- `--tag <tagName>` — git-тег для `package composer-tag`
- `--node-path <path>` — путь узла для `registry repo upload/download`

```bash
gitflic registry package list --scope company --company acme --type maven --format json
gitflic registry package upload --fmt maven --project tikhon/wave ./app-1.0.jar com.acme app 1.0
gitflic registry package download --fmt npm --project tikhon/wave my-pkg my-pkg-1.0.tgz --out ./out.tgz
```

> `registry repo …` (registry-repositories) — функционал Enterprise/Atlas, на публичном
> SaaS возвращает 404 (реализован по спеке, но code-only).

### team / company

- `--alias <a>` `--title <t>` `--description <d>` — при `create`
- `--private` — приватная команда/компания
- `--owner <alias>` `--owner-type <USER\|COMPANY>` — владелец при `team create` (default = вы)
- `--owner <newOwner>` `--team <alias>` — для `team transfer`
- `--role <GUEST\|REPORTER\|DEVELOPER\|ADMIN>` — для `member invite/role`
- `--q <query>` — поиск в `list` / `member list`
- import-флаги (`team import set` / `company import run`): `--branch`, `--environment`,
  `--tag`, `--mr-approval`, `--pipeline-lifetime`

```bash
gitflic team create --alias backend --title "Backend" --private \
  --owner acme --owner-type COMPANY
gitflic team transfer --team backend --owner newlead
```

> У `team` и `company` нет REST-эндпоинтов `edit`/`delete` (PUT/DELETE → 405) — правка и
> удаление только через web-интерфейс; для смены владельца используйте `team transfer`.

### project

- `--title <t>` `--alias <a>` `--description <d>` `--language <l>` — при `create`/`edit`
- `--private` / `--public` — видимость
- `--default-branch <b>` — ветка по умолчанию при `edit`
- `--topics <a,b,c>` — теги проекта при `change-setting`
- `--owner-alias <u>` `--owner-alias-type <USER\|TEAM\|COMPANY>` — владелец при `create`
- `--new-alias <a>` `--owner-alias <u>` — при `fork`
- `--url <git-url>` `--new-alias <a>` — при `import`
- `--out <file>` — путь для `project archive`

```bash
gitflic project create --title "Wave" --alias wave --private \
  --owner-alias acme --owner-alias-type COMPANY
```

> `project archive` (`/file/getArchive`) на публичном `api.gitflic.ru` отдаёт 404
> (скачивание архива отключено / только в web) — используйте `git clone`.

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

## См. также

- [ENV переменные](env.md)
- [Все команды](/commands/)
- [Аутентификация](/auth/)
