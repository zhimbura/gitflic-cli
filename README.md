# gitflic-cli

Лёгкий CLI без внешних зависимостей для REST API [GitFlic](https://gitflic.ru) — merge-реквесты, обсуждения, задачи, релизы, ветки, теги, коммиты, файлы, вебхуки, окружения, пакеты, CI/CD и администрирование проектов. Около 150 эндпоинтов GitFlic REST упакованы в единый бинарник `gitflic`, который можно дёргать из скриптов (и из AI-агентов).

> **Примечание:** официальный `cli.jar` от GitFlic — это *серверный* инструмент админа (починка LFS/релизов для self-hosted инстанса). Это — недостающий **пользовательский** CLI для повседневной работы с MR/задачами/релизами.

📖 **Документация:** https://cli-gitflic.ru — все команды, флаги, ENV, multi-account, MCP для AI-агентов и changelog.

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

**Рекомендуемый путь — `gitflic auth login`.** Токен валидируется через `/user/me` ДО сохранения, чтобы опечатка не отравила keychain, и кладётся в системное хранилище секретов:

```bash
gitflic auth login --token xxxx-xxxx-xxxx            # интерактивно: вставить токен
gitflic auth status                                  # проверить: backend + identity
```

Хранилище выбирается автоматически (как в `gh`/`glab`):
- **macOS** → Keychain (`security add-generic-password`).
- **Linux** → libsecret через `secret-tool` (если установлен).
- **иначе** → файл `~/.config/gitflic-cli/config.json` с `chmod 0600` + предупреждение в stderr.

Просмотр и очистка:

```bash
gitflic auth list              # все аккаунты, токены замаскированы
gitflic auth logout            # удалить активный токен
gitflic auth logout --all      # удалить ВСЕ токены (включая named accounts)
```

### Несколько аккаунтов (multi-account)

`--as <name>` сохраняет токен под `token:<name>` и делает его активным:

```bash
gitflic auth login --as work    --token xxxx    # → token:work, active-account=work
gitflic auth login --as personal --token yyyy   # → token:personal
gitflic auth switch work                        # переключиться на work
gitflic auth status                             # identity от work
```

`auth list` помечает активный аккаунт звёздочкой.

### Привязка проекта к аккаунту (per-project binding)

Если для разных проектов нужны разные аккаунты (например, в `FerdBur/wave` — work-токен, в личном — personal), используй `auth bind`:

```bash
gitflic auth login --as work    --token xxxx
gitflic auth login --as personal --token yyyy
gitflic auth bind FerdBur/wave work       # все команды для FerdBur/wave → work-токен
gitflic auth bind tikhon/personal personal

gitflic mr list --project FerdBur/wave   # автоматически подставит token:work
gitflic mr list --project tikhon/personal # автоматически подставит token:personal

gitflic auth bindings                     # список всех привязок
gitflic auth unbind FerdBur/wave          # убрать привязку
```

**Полный порядок резолва токена** в `gitflic`:

1. `--token <flag>` (per-call override)
2. `GITFLIC_TOKEN` env var
3. **Per-project binding** — `account-bind:<project>` если `flags.project` задан
4. `token:<active-account>` (если `auth switch`)
5. `token` (legacy / default account)
6. die с подсказкой про `auth login`

Если привязка указывает на аккаунт без токена — warning в stderr + fallthrough на active-account.



### Альтернативы (env var / .env)

Если не хотите хранить токен в CLI — через окружение:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
gitflic mr list
```

Порядок резолва токена в `gitflic`: `--token <flag>` → `GITFLIC_TOKEN` → secret store (с учётом `active-account`) → die.

Для self-hosted GitFlic задайте `GITFLIC_API_BASE` (env или `gitflic alias set api-base https://git.example.com`).

### `.env` файл

CLI сам не подхватывает `.env` — нужно `source` его в shell, либо использовать `direnv`/подобное. Пример:

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

**Покрыты все 20 разделов публичного REST API GitFlic** (≈199 эндпоинтов, со всеми scope-вариантами — project / company / team / instance — заметно больше). Большинство протестировано вживую (см. ниже); часть — code-only там, где нужны admin-права или Enterprise/Atlas-функционал.

| # | Раздел | Покрытие | Заметки |
|---|---|---:|---|
| 1 | **merge-request** (`mr`) | **100%** | жизненный цикл + обсуждения + by-commit + approval rules/configuration + squash/method/template (team/company) + apply-settings |
| 2 | **mergeRequestDiscussion** | **100%** | list / get-one / create / reply / resolve / delete |
| 3 | **branch** | **100%** | ветки + compare + compare-file + commits-between + branch-protection (project/team/company CRUD + apply) |
| 4 | **tag** | **100%** | tag list/get/create + tag-protection (team/company list/get/create/edit/delete/apply). *Удаления тега в REST нет.* |
| 5 | **release** | **100%** | CRUD + загрузка/скачивание/удаление файлов релиза (multipart) |
| 6 | **issue** | **100%** | CRUD + comments + relations (CRUD) + files (list/link/unlink) + `issue attach` (upload+link) |
| 7 | **commit** | **100%** | list (`/commits`) + get/file/diff/for-file + commit-diff + tag-diff + cherry-pick |
| 8 | **blob** | **100%** | get (raw) + download + recursive + file-size |
| 9 | **settings** (user) | **100%** | ssh add + oauth CRUD + access-token create + transport-token create + смена email/username/password |
| 10 | **user** | **100%** | me / get / projects / followers / following |
| 11 | **project** | **100%** | CRUD + search/my/shared + members/teams + fork/mirror/import + archive + files/attachments + change-setting + deploy-token + run-script |
| 12 | **team** | **100%** | list/my/shared/get/create/transfer + members + import. *edit/delete — UI-only (нет REST).* |
| 13 | **company** | **100%** | list/my/shared/get/create + members + import |
| 14 | **environment** | **100%** | environment-protection (team/company list/get/create/edit/delete/apply) |
| 15 | **webhook** | **100%** | list/get/create/edit/delete |
| 16 | **package-registry** (`registry package`) | **100%** | list/get/versions/version/files/delete (3 scope) + upload/download для всех форматов (generic/maven/npm/pypi/nuget/composer/opm/cran/rubygem/cargo/conda) |
| 16b | **registry-repository** (`registry repo`) | **100%** ¹ | CRUD + packages + per-format up/down. *Enterprise/Atlas-only — code-only.* |
| 17 | **cicd** | **100%** | pipeline list/start/artifacts/restart/cancel/delete + job get/artifacts/lock/unlock/download/restart/cancel + variables + pipeline-lifetime |
| 18 | **runner** | **100%** | project/company/instance: list/get/jobs/edit/shutdown/delete/registration-info/reset-token ² |
| 19 | **admin** | **100%** ² | user CRUD + ban/unban + ssh-key + push-stats + 18 settings-мутаторов + ldap import |
| 20 | **saml** | **100%** ² | `/admin/saml` list/create/edit/change-status |

> ¹ registry-repository доступен только в Enterprise/Atlas — на публичном `api.gitflic.ru` отдаёт 404. Реализовано строго по спеке (code-only).
> ² admin / saml / instance-scoped runner требуют прав администратора — реализованы по спеке, но не тестировались живым пользовательским токеном.

## Известные проблемы / особенности

- **`gitflic tag get <name>`** возвращает HTTP 400 от GitFlic для *любого* имени при project-scoped вызове. Используем `tag list` + поиск. Зафиксировано, обхода с клиента нет.
- **`mr merge`** на новом проекте может упасть с `MergeCheckException`, потому что дефолтная branch-protection требует аппрув от пользователя, не являющегося автором. Это поведение GitFlic, не баг CLI.
- **`project archive`** (`GET .../file/getArchive`) отдаёт HTTP 404 на публичном `api.gitflic.ru` (скачивание архива отключено/доступно только через web). Команда реализована по спеке; используйте `git clone` для получения кода.
- **`registry repo …`** (репозитории реестра) доступны только в Enterprise/Atlas — на публичном инстансе 404. Реализовано по спеке (code-only).
- **Файлы релиза**: GitFlic валидирует тип загружаемого файла (allowlist). `.zip`/архивы проходят, `.txt`/`.png` могут вернуть HTTP 415 — это ограничение сервера, не CLI.
- **`team edit` / `team delete`** в публичном REST отсутствуют (PUT/DELETE `/team/{alias}` → 405) — редактирование/удаление команды только через web UI. Используйте `team transfer` для смены владельца.
- **SSH push** в GitFlic требует SSH-ключ (transport-token — для реестра пакетов, а не для `git push`). HTTPS-push работает с токеном: `git push https://oauth2:<TOKEN>@gitflic.ru/project/<owner>/<alias>.git`.
- **Создание access-token** через REST (`settings access-token create`) может требовать HTTP Basic auth — если эндпоинт вернёт 401/403, создайте токен через web UI GitFlic.
- **admin / saml / instance-scoped runner** требуют прав администратора инстанса — обычный токен получит 403/404. Команды реализованы по спеке.
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
