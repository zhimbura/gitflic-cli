---
layout: home
title: "GitFlic CLI и MCP: консольный клиент и AI-агенты для GitFlic"
titleTemplate: false
description: "GitFlic CLI (gitflic-cli) — консольный клиент для GitFlic: 100% REST API и MCP-сервер для AI-агентов Claude Code и Cursor. Установка: npm i -g gitflic-cli"

hero:
  name: GitFlic CLI
  text: CLI и MCP-сервер для GitFlic
  tagline: Ноль внешних зависимостей. 100% покрытие ~199 эндпоинтов в 20 модулях. MCP-сервер для AI-агентов.
  image:
    src: /_media/icon.svg
    alt: gitflic-cli
  actions:
    - theme: brand
      text: Быстрый старт
      link: /quickstart
    - theme: alt
      text: Все команды
      link: /commands/
    - theme: alt
      text: Покрытие API
      link: /api-coverage

features:
  - icon: 🧩
    title: 100% REST API
    details: Все 20 разделов GitFlic REST — MR, релизы, задачи, ветки/теги, коммиты, файлы, проекты, команды, компании, окружения, вебхуки, реестр пакетов, CI/CD, раннеры, админ, SAML.
  - icon: 🪶
    title: Ноль зависимостей
    details: Чистый Node ESM (≥18) на глобальном fetch. Никакого npm install — один бинарь gitflic.
  - icon: 🤖
    title: Дружелюбен к агентам
    details: --format json + NDJSON streaming + стабильные коды возврата. MCP-сервер (78 тулзов) поверх всего CLI — со сжатием ответов (~70% экономии токенов).
  - icon: 🔐
    title: Безопасные токены
    details: macOS Keychain / Linux libsecret / chmod 0600 fallback. Multi-account и per-project bindings.
  - icon: 📦
    title: Реестр пакетов
    details: list/get/versions/files/delete + upload/download для generic, maven, npm, pypi, nuget, composer, opm, cran, rubygem, cargo, conda.
  - icon: ⚙️
    title: Надёжность
    details: Авто-ретраи на 429/502/503/504, пагинация --all, TUI-браузер MR, 256 self-тестов.
---

## За 30 секунд

```bash
npm install -g gitflic-cli                       # или разово: npx gitflic-cli help

gitflic auth login --token xxxx-xxxx-xxxx       # валидирует через /user/me, кладёт в Keychain
gitflic mr list --project tikhon/gitflic-cli    # список MR
gitflic mr create --title "Fix login" --to main
```

Ноль транзитивных зависимостей — чистый Node ESM (`>=18`), один бинарь `gitflic`. [Другие способы установки →](/install.html)

## Что такое GitFlic CLI

GitFlic CLI (`gitflic-cli`) — неофициальный консольный клиент для [GitFlic](https://gitflic.ru). Он работает с публичным REST API: merge-реквесты, релизы, задачи, ветки, теги, проекты, реестр пакетов и CI/CD вызываются командами `gitflic …` из терминала и скриптов. Это пользовательский клиент, а не серверная утилита администратора `cli.jar`.

## GitFlic MCP для AI-агентов

GitFlic MCP — сервер Model Context Protocol (пакет `gitflic-cli-mcp`), который даёт AI-агентам Claude Code и Cursor 78 инструментов GitFlic. Подключение одной командой:

```bash
claude mcp add gitflic --env GITFLIC_TOKEN=xxxxxxxx -- npx -y gitflic-cli-mcp
```

[Подробнее про MCP-сервер →](/mcp-server.html)

## Архитектура

```
gitflic-cli/
├── bin/gitflic              # bash-шим → node lib/gitflic.mjs
├── bin/gitflic.cmd          # Windows .cmd-шим → node lib/gitflic.mjs
├── bin/gitflic.ps1          # PowerShell-шим → node lib/gitflic.mjs
├── lib/
│   ├── gitflic.mjs          # диспетчер команд
│   ├── http.mjs             # fetch + retry + parseArgs + resolveToken + httpText/httpDownload/httpUploadFile
│   ├── secret.mjs           # macOS Keychain / Linux libsecret / chmod 0600
│   ├── config.mjs           # persistent user config (chmod 0600)
│   ├── cache.mjs            # file-based project-UUID cache
│   ├── paginate.mjs         # --all auto-pagination + NDJSON streaming
│   ├── format.mjs           # вывод + цвета (NO_COLOR / FORCE_COLOR) + htmlUnescape
│   ├── tui.mjs              # интерактивный браузер MR
│   └── cmd/                 # модули команд (mr, branch, release, registry, ...)
├── mcp-server/              # Model Context Protocol сервер
└── docs/                    # эта документация (VitePress)
```

## Лицензия

MIT.
