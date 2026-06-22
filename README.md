# gitflic-cli

Лёгкий CLI без внешних зависимостей для REST API [GitFlic](https://gitflic.ru) — merge-реквесты, обсуждения, задачи, релизы, ветки, теги, коммиты, файлы, вебхуки, окружения, пакеты, CI/CD и администрирование проектов. Около 150 эндпоинтов GitFlic REST упакованы в единый бинарник `gitflic`, который можно дёргать из скриптов (и из AI-агентов).

> **Примечание:** официальный `cli.jar` от GitFlic — это *серверный* инструмент админа (починка LFS/релизов для self-hosted инстанса). Это — недостающий **пользовательский** CLI для повседневной работы с MR/задачами/релизами.

## Зачем

- **Ноль зависимостей.** Чистый Node ESM (>=18). Использует глобальный `fetch`. Без `npm install`.
- **Дружелюбен к агентам.** Каждая команда принимает `--format json` и выдаёт стабильный JSON в stdout. Код возврата: `0` при успехе, `1` при любой HTTP-ошибке.
- **Самодокументирующийся.** `gitflic help` и `gitflic <cmd> help` показывают все подкоманды и флаги.
- **Покрывает публичный REST** — 20 модулей верхнего уровня, ~125 обёрток эндпоинтов.

## Установка

### Быстрая (SSH)

Требуется Node 18+ (использует глобальный `fetch`) и SSH-ключ, добавленный в https://gitflic.ru.

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
cd ~/tools/gitflic-cli
bash install.sh
```

`install.sh` установит CLI в `~/.local/share/gitflic-cli`, создаст symlink `~/.local/bin/gitflic` и подскажет что добавить в PATH, если `~/.local/bin` ещё не там.

### Альтернативы

- **Windows / PowerShell:** `git clone ...` → `cd ...` → `powershell -ExecutionPolicy Bypass -File install.ps1`
- **Кастомный путь:** `bash install.sh --prefix ~/my-tools`
- **Только файлы, без symlink:** `bash install.sh --no-symlink`
- **Проверить заранее без записи:** `bash install.sh --dry-run`
- **С токеном (HTTPS вместо SSH):** `GITFLIC_TOKEN=xxxxxxxx bash install.sh`
- **Удалить:** `bash uninstall.sh`

### Ручная установка (без install.sh)

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
chmod +x ~/tools/gitflic-cli/bin/gitflic
ln -sf ~/tools/gitflic-cli/bin/gitflic ~/.local/bin/gitflic
export PATH="$HOME/.local/bin:$PATH"   # добавь в ~/.bashrc / ~/.zshrc
```

## Аутентификация

1. Откройте <https://gitflic.ru> → **Профиль** → **API-токены** → **Создать**.
2. Выберите скоупы — как минимум `PROJECT_READ` и `PROJECT_WRITE` / `PROJECT_EDIT` для работы с MR.
3. Экспортируйте токен:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Для self-hosted GitFlic также задайте:

```bash
export GITFLIC_API_BASE="https://git.example.com"
```

Можно также положить `.env` рядом с проектом (режим `0600`) — он подхватится автоматически, если вы оборачиваете бинарник, например:

```bash
set -a; source .env; set +a; gitflic mr list
```

## Использование

```bash
gitflic auth
gitflic project get tikhon/gitflic-cli                # resolve project (alias → UUID)
gitflic mr list --project tikhon/gitflic-cli          # list MRs
gitflic mr view 42 --project tikhon/gitflic-cli
gitflic mr diff 42 --project tikhon/gitflic-cli
gitflic mr create --title "Fix login" --to main       # auto: current branch → default
gitflic mr approve 42
gitflic mr merge 42 --message "Squash: fix login"
gitflic mr close 42
gitflic mr comment 42 "Please rebase"                 # or anchored: --new-path F --new-line N
gitflic mr discuss list 42
gitflic branch list                                  # auto-detected from `origin` remote
gitflic branch protection create --branch-template master --allowed-to-push NO_ONE --allowed-to-merge DEVELOPER
gitflic issue create --title "Bug" --description "..."
gitflic release create --title "v1.0.0" --tag v1.0.0
gitflic tag create v1.0.0 --branch master --message "Release"
gitflic webhook create --url https://example.com/h --event PUSH
gitflic user me                                       # current user (with email)
```

Запустите `gitflic help` для полного списка верхнего уровня или `gitflic <cmd> help` для модуля.

## Справка по командам

| Модуль | Главная команда | Чем интересен |
|---|---|---|
| auth | `gitflic auth` | Проверка личности через `/user/me` |
| **mr** | `gitflic mr ...` | list / view / diff / create / edit / approve / merge / close / cancel / by-commit / comment (общий + инлайн) / discuss (list / reply / resolve / delete) |
| **branch** | `gitflic branch ...` | list / get / default / create / delete / compare / protection (list / get / create / edit / delete) |
| **tag** | `gitflic tag ...` | list / get / create / protection (list / create / edit / delete) — *API для удаления тегов отсутствует* |
| **release** | `gitflic release ...` | list / get / latest / create / edit / delete — *загрузка/скачивание файлов не реализована* |
| **issue** | `gitflic issue ...` | list / view / create / edit / close / reopen / delete / comments (list / add / edit / delete) / relations (list) |
| **commit** | `gitflic commit ...` | list / get / files / diff / compare / cherry-pick |
| **blob** | `gitflic blob ...` | get (текст) / files (список) / archive (скачивание бинарей) |
| **settings** | `gitflic settings ...` | ssh add / oauth (list / get / create / delete) / transport-token create / change-email / change-username / change-password |
| **user** | `gitflic user ...` | me / search / get / projects / followers / following |
| **project** | `gitflic project ...` | list / get / create / edit / delete / files / archive / followers / stars / fork / mirror / import / member / team / deploy-token |
| **team** | `gitflic team ...` | list / get / create / edit / delete / members |
| **company** | `gitflic company ...` | list / get |
| **environment** | `gitflic environment ...` | protection (list / create / delete) — *универсальный CRUD окружений не в REST* |
| **webhook** | `gitflic webhook ...` | list / get / create / edit / delete |
| **registry** | `gitflic registry ...` | list (instance/company/project скоуп) / repos |
| **cicd** | `gitflic cicd ...` | pipeline (list / get / start) / jobs |
| **runner** | `gitflic runner ...` | list / get |
| **admin** | `gitflic admin ...` | user list / project list (только admin — code-only) |
| **saml** | `gitflic saml ...` | list (только admin — code-only) |

## Покрытие API (vs https://docs.gitflic.ru/latest/api/)

| # | Раздел | Эндпоинтов в доке | Реализовано | Покрытие | Заметки |
|---|---|---:|---:|---:|---|
| 1 | **merge-request** (`mr`) | 17 | 17 | **100%** | Весь жизненный цикл MR + обсуждения + by-commit |
| 2 | **mergeRequestDiscussion** | 6 | 4 | 67% | delete + get-one + create-reply отсутствуют в доке; покрыты list/reply/resolve/delete + create-via-comment |
| 3 | **branch** | 11 | 11 | **100%** | вкл. branch protection (CRUD) |
| 4 | **tag** | 11 | 4 | 36% | tag CRUD частично; tag-protection доступен только team/company и реализован (CRUD) |
| 5 | **release** | 10 | 7 | 70% | загрузка/скачивание файлов (multipart) не реализовано; CRUD метаданных сделан |
| 6 | **issue** | 11 | 11 | **100%** | вкл. comments + relations (list) |
| 7 | **commit** | 8 | 8 | **100%** | вкл. cherry-pick |
| 8 | **blob** | 5 | 3 | 60% | get / files / archive; загрузка бинарей отсутствует в API |
| 9 | **settings** (user) | 14 | 7 | 50% | ssh list+delete + access-token create отсутствуют в REST; покрыто ssh-add, oauth CRUD, transport-token create, смена профиля |
| 10 | **user** | 6 | 6 | **100%** | |
| 11 | **project** | 25 | 22 | 88% | file attach (multipart), выполнение скриптов, размер проекта не отдаются; member/team/follower/stars/deploy-token покрыты |
| 12 | **team** | 7 | 6 | 86% | базовый CRUD + members |
| 13 | **company** | 6 | 2 | 33% | только list / get — создание/изменение/удаление компании только через web UI |
| 14 | **environment** | 6 | 3 | 50% | только environment-protection (CRUD) — универсального CRUD окружений в REST нет |
| 15 | **webhook** | 5 | 5 | **100%** | вкл. create / update / delete (POST-эндпоинты) |
| 16 | **package-registry** (registry) | 19 | 1 | 5% | только list (instance); подтипы (Maven/NPM и т.п.) не обёрнуты |
| 17 | **cicd** | 15 | 5 | 33% | pipeline list/get/start + jobs list; artifacts / job-* не обёрнуты |
| 18 | **runner** | 4 | 0 | 0% | заглушка code-only — публичный list не подтверждён |
| 19 | **admin** | 10 | 2 | 20% | только user list / project list; большинство admin-операций только в web UI |
| 20 | **saml** | 3 | 1 | 33% | только list |

| | **ИТОГО** | **~199** | **~113** | **~57%** | от задокументированных публичных REST-эндпоинтов |

> Оставшиеся ~43% — в основном:
> - **Multipart-загрузка файлов** (ассеты релизов, вложения задач) — вне скоупа CLI, но возможны в будущей v2.
> - **Под-API по типу реестра пакетов** (Maven, NPM, Docker и т.п.) — большая поверхность, низкая ценность для MR-работы.
> - **Webhook/UI-only сценарии** (SAML admin, регистрация runner'ов, статистика размера проекта) — публичного REST-эндпоинта нет.
> - **Per-MR настройки проекта** (правила аппрувов, merge-шаблоны) — вне MR-скоупа, но могут появиться через `gitflic project settings mr` в будущей версии.

## Известные проблемы / особенности

- **`gitflic tag get <name>`** возвращает HTTP 400 от GitFlic для *любого* имени при project-scoped вызове. Используем `tag list` + поиск. Зафиксировано, обхода с клиента нет.
- **`mr merge`** на новом проекте может упасть с `MergeCheckException`, потому что дефолтная branch-protection требует аппрув от пользователя, не являющегося автором. Это поведение GitFlic, не баг CLI.
- **SSH push** в GitFlic требует SSH-ключ (transport-token — для реестра пакетов, а не для `git push`). Ключ можно добавить через web UI или через этот CLI, если публичный ключ уже добавлен вручную.
- **Создание access-token** через REST требует HTTP Basic auth; CLI это не поддерживает. Создавайте токены через web UI GitFlic.
- **Многоязычные ответы** GitFlic локализованы (русские заголовки вроде «Открыт», «Слит»). CLI печатает их as-is; значения `status.id` — английские константы (`OPENED`, `MERGED`, `CLOSED`, `CANCELED`, `FAILED`).

## Для AI-агентов

Каждая команда поддерживает `--format json` для машинного чтения. Агент (или shell-пайплайн) получает стабильный JSON. Несколько рецептов:

```bash
# Посчитать открытые MR в проекте
gitflic mr list --project tikhon/wave --format json \
  | jq '[._embedded.mergeRequestModelList[] | select(.status.id == "OPENED")] | length'

# Только заголовок и статус последнего MR
gitflic mr list --project tikhon/wave --format json \
  | jq -r '._embedded.mergeRequestModelList[0] | "#\(.localId) [\(.status.title)] \(.title)"'

# Создать MR из текущей ветки в master, подставить title/description
TITLE="Fix login"
DESC=$(git log -1 --pretty=%B)
gitflic mr create --project tikhon/wave --title "$TITLE" --description "$DESC" --to master
```

Рекомендуемые соглашения:

- Храните `GITFLIC_TOKEN` в окружении шелла, а не в проекте.
- Для мульти-репо предпочитайте явный `--project owner/alias`; авто-детект из `origin` работает только внутри `git clone`.
- Пропускайте через `jq` для фильтрации или трансформации JSON.

## Архитектура

```
gitflic-cli/
├── bin/gitflic                # bash-шим → node lib/gitflic.mjs
├── lib/
│   ├── gitflic.mjs            # entry: разбор аргументов, диспетчер модулей
│   ├── http.mjs               # обёртка над fetch + авто-детект git
│   ├── format.mjs             # цвет, pretty-принтеры, общие хелперы
│   └── cmd/
│       ├── mr.mjs             # модуль merge-request
│       ├── branch.mjs         # ветка + branch-protection
│       ├── tag.mjs            # тег + tag-protection
│       ├── release.mjs        # релизы
│       ├── issue.mjs          # задачи + issueNote + relations
│       ├── commit.mjs         # коммиты
│       ├── blob.mjs           # файлы / archive
│       ├── settings.mjs       # настройки пользователя (ssh, oauth, токены, профиль)
│       ├── user.mjs           # пользователи (me, search, by-alias, projects, followers)
│       ├── project.mjs        # проекты (CRUD, members, teams, fork, mirror, import)
│       ├── team.mjs           # команды
│       ├── company.mjs        # компании
│       ├── environment.mjs    # environment-protection
│       ├── webhook.mjs        # вебхуки проекта
│       ├── registry.mjs       # реестр пакетов
│       ├── cicd.mjs           # пайплайны и джобы CI/CD
│       ├── runner.mjs         # раннеры/агенты CI/CD
│       ├── admin.mjs          # admin-эндпоинты
│       └── saml.mjs           # SAML SSO
├── mcp-server/                # Model Context Protocol сервер (см. mcp-server/README.md)
│   ├── server.mjs             # MCP stdio сервер
│   ├── tools.mjs              # описания тулзов
│   ├── runner.mjs             # обёртка над bin/gitflic
│   └── package.json
├── package.json               # type:module, engines.node>=18
├── README.md                  # этот файл
├── CHANGELOG.md               # release notes
├── install.sh                 # установщик (Linux/macOS/WSL)
├── install.ps1                # установщик (Windows PowerShell)
├── uninstall.sh               # удаление (Linux/macOS/WSL)
├── uninstall.ps1              # удаление (Windows)
├── .gitignore
└── .env.example               # GITFLIC_TOKEN, GITFLIC_API_BASE
```

Каждый модуль команды экспортирует `usage` (строка) и `handle(ctx, sub, args, flags)`. Диспетчер (`lib/gitflic.mjs`) берёт на себя резолв токена, резолв проекта (флаг `--project` или авто-детект из git) и генерацию `help`.

## Разработка

```bash
# Синтакс-чек всех модулей
for f in lib/gitflic.mjs lib/http.mjs lib/format.mjs lib/cmd/*.mjs; do
  node --check "$f"
done

# Запуск без установки
node lib/gitflic.mjs help

# Добавить новый модуль
# 1. Создайте lib/cmd/<name>.mjs, экспортирующий { usage, handle }
# 2. Импортируйте и добавьте в COMMANDS в lib/gitflic.mjs
# 3. Добавьте в GLOBAL, если не требует --project
```

## Лицензия

MIT.
