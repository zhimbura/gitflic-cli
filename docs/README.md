# gitflic-cli

> Лёгкий CLI без внешних зависимостей для REST API [GitFlic](https://gitflic.ru).

![version](https://img.shields.io/badge/version-0.1.0-blue)
![node](https://img.shields.io/badge/node-%E2%89%A518-green)
![deps](https://img.shields.io/badge/deps-0-success)
![tests](https://img.shields.io/badge/tests-163%2F163-brightgreen)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

[Начать](quickstart.md) · [Установка](install.md) · [Аутентификация](auth/README.md) · [Команды](commands/README.md) · [MCP-сервер](mcp-server.md) · [Разработка](development.md) · [CI/CD](ci-cd.md)

---

## За 30 секунд

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
cd ~/tools/gitflic-cli && bash install.sh

gitflic auth login --token xxxx-xxxx-xxxx      # валидирует через /user/me, кладёт в Keychain
gitflic mr list --project tikhon/gitflic-cli  # список MR
gitflic mr create --title "Fix login" --to main
```

Никакого `npm install` — чистый Node ESM (`>=18`), один бинарь `gitflic`.

## Что внутри

- **~150 эндпоинтов GitFlic REST** — MR, релизы, задачи, ветки, теги, коммиты, файлы, вебхуки, CI/CD, окружения, пакеты, администрирование.
- **MCP-сервер** для AI-агентов (Claude Code, Cursor и т.п.) — 77 типизированных тулов.
- **Безопасное хранение токенов** — macOS Keychain / Linux libsecret / chmod 0600 fallback (как у `gh`/`glab`).
- **Multi-account** + **per-project bindings** — для людей, у которых несколько личностей на GitFlic (работа + личное).
- **NDJSON streaming** + пагинация `--all` + авто-ретраи на 429/502/503/504.
- **TUI-браузер** для `mr list` — интерактивный пикер без выхода из терминала.
- **Multipart upload** для ассетов релизов и вложений задач.
- **Self-tests** — 163 теста, zero flakes.

## Архитектура

```
gitflic-cli/
├── bin/gitflic              # bash-шим → node lib/gitflic.mjs
├── lib/
│   ├── gitflic.mjs          # диспетчер команд
│   ├── http.mjs             # fetch + retry + parseArgs + resolveToken
│   ├── secret.mjs           # macOS Keychain / Linux libsecret / chmod 0600
│   ├── config.mjs           # persistent user config (chmod 0600)
│   ├── cache.mjs            # file-based project-UUID cache
│   ├── paginate.mjs         # --all auto-pagination
│   ├── format.mjs           # вывод + цвета (NO_COLOR / FORCE_COLOR)
│   ├── tui.mjs              # интерактивный браузер MR
│   └── cmd/                 # модули команд (mr, branch, release, ...)
├── mcp-server/              # Model Context Protocol сервер
├── docs/                    # эта документация
├── scripts/                 # служебные (docs dev server)
├── install.sh / install.ps1 # установщики
└── gitflic-ci.yaml          # GitFlic CI (lint + test + docs archive + release)
```

## Лицензия

MIT.
