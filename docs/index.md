---
layout: home

hero:
  name: gitflic-cli
  text: Полный CLI для REST API GitFlic
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
    details: --format json + NDJSON streaming + стабильные коды возврата. MCP-сервер с типизированными тулами поверх всего CLI.
  - icon: 🔐
    title: Безопасные токены
    details: macOS Keychain / Linux libsecret / chmod 0600 fallback. Multi-account и per-project bindings.
  - icon: 📦
    title: Реестр пакетов
    details: list/get/versions/files/delete + upload/download для generic, maven, npm, pypi, nuget, composer, opm, cran, rubygem, cargo, conda.
  - icon: ⚙️
    title: Надёжность
    details: Авто-ретраи на 429/502/503/504, пагинация --all, TUI-браузер MR, 166 self-тестов.
---

## За 30 секунд

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
cd ~/tools/gitflic-cli && bash install.sh

gitflic auth login --token xxxx-xxxx-xxxx       # валидирует через /user/me, кладёт в Keychain
gitflic mr list --project tikhon/gitflic-cli    # список MR
gitflic mr create --title "Fix login" --to main
```

Никакого `npm install` — чистый Node ESM (`>=18`), один бинарь `gitflic`.

## Архитектура

```
gitflic-cli/
├── bin/gitflic              # bash-шим → node lib/gitflic.mjs
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
