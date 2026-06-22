<div align="center">

<img src="https://cli-gitflic.ru/_media/icon.svg" width="92" alt="gitflic-cli logo" />

# gitflic-cli

**Полный консольный клиент для REST API [GitFlic](https://gitflic.ru).**
100% покрытие · ноль внешних зависимостей · MCP-сервер для AI-агентов.

[![docs](https://img.shields.io/badge/docs-cli--gitflic.ru-e8423a?style=flat-square)](https://cli-gitflic.ru)
[![version](https://img.shields.io/badge/version-0.3.0-e8423a?style=flat-square)](https://cli-gitflic.ru/changelog.html)
[![node](https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-0-success?style=flat-square)](#-почему)
[![tests](https://img.shields.io/badge/tests-166%20passing-brightgreen?style=flat-square)](#-разработка)
[![GitFlic REST](https://img.shields.io/badge/GitFlic%20REST-100%25-e8423a?style=flat-square)](https://cli-gitflic.ru/api-coverage.html)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#-лицензия)

**[📖 Документация](https://cli-gitflic.ru)** · [🚀 Быстрый старт](https://cli-gitflic.ru/quickstart.html) · [🧩 Команды](https://cli-gitflic.ru/commands/) · [📦 Скачать](https://cli-gitflic.ru/downloads/) · [🤖 MCP для AI](https://cli-gitflic.ru/mcp-server.html)

</div>

---

`gitflic-cli` — лёгкий CLI для повседневной работы с GitFlic из терминала, скриптов и AI-агентов: merge-реквесты, обсуждения, задачи, релизы, ветки, теги, коммиты, файлы, вебхуки, окружения, реестр пакетов, CI/CD и администрирование. Все **20 разделов** публичного REST API GitFlic обёрнуты в единый бинарник `gitflic`.

> **Чем это не является:** официальный `cli.jar` от GitFlic — это *серверный* инструмент админа (починка LFS/релизов для self-hosted). `gitflic-cli` — недостающий **пользовательский** CLI для ежедневной работы.

## ✨ Почему

- **Ноль зависимостей.** Чистый Node ESM (≥18) на глобальном `fetch`. Никакого `npm install`.
- **100% REST API.** Все 20 разделов (~199 эндпоинтов со scope-вариантами). Большинство протестировано вживую. → [таблица покрытия](https://cli-gitflic.ru/api-coverage.html)
- **Дружелюбен к агентам.** Каждая команда принимает `--format json` и пишет стабильный JSON в stdout. Код возврата: `0` при успехе, `1` при HTTP-ошибке. Плюс NDJSON-стриминг (`--stream`) и авто-пагинация (`--all`).
- **MCP-сервер** для AI (Claude Code, Cursor и т.п.) — типизированные тулы поверх всего CLI.
- **Безопасное хранение токенов** — macOS Keychain / Linux libsecret / `chmod 0600` fallback (как у `gh`/`glab`). Multi-account + per-project bindings.
- **Самодокументирующийся.** `gitflic help` и `gitflic <cmd> help` показывают все подкоманды и флаги.

## 📦 Установка

Требуется Node 18+ и SSH-ключ в [gitflic.ru](https://gitflic.ru).

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
cd ~/tools/gitflic-cli
bash install.sh
```

`install.sh` ставит CLI в `~/.local/share/gitflic-cli`, делает symlink `~/.local/bin/gitflic` и подсказывает про PATH. Готовые tar.gz — на [странице загрузок](https://cli-gitflic.ru/downloads/).

<details>
<summary>Альтернативы (Windows, кастомный путь, ручная установка)</summary>

```bash
# Windows / PowerShell
powershell -ExecutionPolicy Bypass -File install.ps1

# Кастомный путь / без symlink / dry-run
bash install.sh --prefix ~/my-tools
bash install.sh --no-symlink
bash install.sh --dry-run

# С токеном (HTTPS вместо SSH)
GITFLIC_TOKEN=xxxx bash install.sh

# Ручками
ln -sf ~/tools/gitflic-cli/bin/gitflic ~/.local/bin/gitflic
```
</details>

→ Подробно: [Установка](https://cli-gitflic.ru/install.html)

## 🔐 Аутентификация

```bash
gitflic auth login --token xxxx-xxxx-xxxx   # валидирует через /user/me, кладёт в Keychain
gitflic auth status                         # backend + identity
```

Поддерживаются **несколько аккаунтов** (`auth login --as work`, `auth switch`) и **привязка проектов** к аккаунтам (`auth bind owner/alias work`). Альтернатива — `GITFLIC_TOKEN` в окружении.

→ Подробно: [Аутентификация](https://cli-gitflic.ru/auth/) · [Multi-account](https://cli-gitflic.ru/auth/multi-account.html) · [Безопасность](https://cli-gitflic.ru/auth/security.html)

## 🚀 Использование

```bash
gitflic mr list --project tikhon/gitflic-cli            # список merge-реквестов
gitflic mr create --title "Fix login" --to main         # авто: текущая ветка → default
gitflic mr diff 42                                       # дифф (с декодом HTML-entities)
gitflic mr merge 42 --message "Squash: fix login"

gitflic issue create --title "Bug" --description "..."
gitflic release create --title v1.0.0 --tag v1.0.0
gitflic release upload <uuid> ./build.zip               # ассеты релиза

gitflic branch protection create --scope team --team acme \
  --branch-template "main" --allowed-to-push NO_ONE --allowed-to-merge DEVELOPER

gitflic registry package upload --fmt maven --project me/app \
  ./app.jar com.example app 1.0.0 app.jar               # реестр пакетов

gitflic user me --format json | jq .username           # машинный вывод
```

`gitflic help` — полный список, `gitflic <cmd> help` — справка по модулю.

## 🧩 Команды

| Модуль | Что умеет |
|---|---|
| **`auth`** | login / logout / status / switch / list / bind / unbind — multi-account, per-project |
| **`mr`** | list / view / diff / create / edit / approve / merge / close / cancel / by-commit / comment / discuss + approval rules & MR-settings (team/company) |
| **`branch`** | list / get / default / create / delete / compare / compare-file / commits + branch-protection (project/team/company) |
| **`tag`** | list / get / create + tag-protection (team/company) |
| **`release`** | list / get / latest / create / edit / delete + upload / download / delete-file |
| **`issue`** | CRUD + comments + relations + files (link/unlink) + `attach` |
| **`commit`** | list / get / files / diff / for-file / commit-diff / tag-diff / cherry-pick |
| **`blob`** | get (raw) / download / recursive / file-size |
| **`project`** | CRUD + search/my/shared + members/teams + fork/mirror/import + archive + attachments + change-setting + deploy-token + run-script |
| **`user`** | me / get / projects / followers / following |
| **`settings`** | ssh / oauth / access-token / transport-token / смена email·username·password |
| **`team`** · **`company`** | list / my / shared / get / create + members + import (+ team transfer) |
| **`environment`** | environment-protection (team/company) |
| **`webhook`** | list / get / create / edit / delete |
| **`registry`** | `package` (CRUD + upload/download для maven/npm/pypi/nuget/cargo/conda/… в 3 scope) · `repo` (Enterprise) |
| **`cicd`** | pipeline + job lifecycle, artifacts, variables, pipeline-lifetime |
| **`runner`** | project / company / instance: list / get / jobs / edit / shutdown / delete |
| **`admin`** · **`saml`** | админ-эндпоинты инстанса (нужны права администратора) |

→ Полный справочник с примерами: **[cli-gitflic.ru/commands](https://cli-gitflic.ru/commands/)**

## ✅ Покрытие API

**100% — все 20 разделов** публичного REST GitFlic (~199 эндпоинтов; со scope-вариантами project/company/team/instance — больше). Часть admin/SAML/Enterprise — code-only (нужны права/редакция инстанса).

→ Подробная таблица по разделам: **[cli-gitflic.ru/api-coverage](https://cli-gitflic.ru/api-coverage.html)**

## 🤖 Для AI-агентов

Каждая команда поддерживает `--format json` — агент или shell-пайплайн получает стабильный JSON.

```bash
# Открытые MR в проекте
gitflic mr list --project tikhon/wave --format json \
  | jq '[._embedded.mergeRequestModelList[] | select(.status.id == "OPENED")] | length'
```

Есть **MCP-сервер** (Model Context Protocol) с типизированными тулами поверх CLI — подключается к Claude Code, Cursor и др. → [MCP-сервер](https://cli-gitflic.ru/mcp-server.html). Для ИИ также опубликованы [`/llms.txt`](https://cli-gitflic.ru/llms.txt) и [`/llms-full.txt`](https://cli-gitflic.ru/llms-full.txt).

## 🏗️ Архитектура

<details>
<summary>Структура проекта</summary>

```
gitflic-cli/
├── bin/gitflic              # bash-шим → node lib/gitflic.mjs
├── lib/
│   ├── gitflic.mjs          # диспетчер команд
│   ├── http.mjs             # fetch + retry + httpText/httpDownload/httpUploadFile
│   ├── secret.mjs           # Keychain / libsecret / chmod 0600
│   ├── paginate.mjs         # --all авто-пагинация + NDJSON streaming
│   ├── format.mjs           # вывод, цвета, htmlUnescape
│   └── cmd/                 # модули команд (mr, branch, release, registry, …)
├── mcp-server/              # Model Context Protocol сервер
├── docs/                    # документация (VitePress → cli-gitflic.ru)
└── install.sh / install.ps1 # установщики
```

Каждый модуль экспортирует `usage` и `handle(ctx, sub, args, flags)`. Диспетчер берёт на себя резолв токена, резолв проекта (`--project` или авто-детект из git) и генерацию `help`.
</details>

## 🛠️ Разработка

```bash
npm test            # 166 unit-тестов (vitest)
npm run build       # lint + тесты + portable tar.gz → dist/
npm run docs:dev    # локальный VitePress dev-server
npm run docs:publish # собрать и задеплоить доку
```

→ Подробно: [Локальная разработка](https://cli-gitflic.ru/development.html)

## 📄 Лицензия

[MIT](LICENSE).

<div align="center">
<sub>Неофициальный пользовательский CLI для GitFlic · <a href="https://cli-gitflic.ru">cli-gitflic.ru</a></sub>
</div>
