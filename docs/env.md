---
description: "Все переменные окружения gitflic-cli: GITFLIC_TOKEN, GITFLIC_API_BASE, ретраи, кеш, отключение keychain, NO_COLOR и другие настройки поведения CLI."
---

# ENV переменные

Все поддерживаемые переменные окружения.

## Аутентификация и API

| Переменная | Что делает | Default |
|---|---|---|
| `GITFLIC_TOKEN` | Токен для запросов | — |
| `GITFLIC_API_BASE` | API endpoint | `https://api.gitflic.ru` |
| `GITFLIC_NO_CONFIG=1` | Не читать `~/.config/gitflic-cli/config.json` | — |
| `GITFLIC_NO_SECRET_STORE=1` | Не использовать keychain (только env var) | — |

## HTTP / retry

| Переменная | Что делает | Default |
|---|---|---|
| `GITFLIC_HTTP_RETRIES` | Макс. ретраев на 429/502/503/504 | `3` |
| `GITFLIC_HTTP_RETRY_DELAY` | Базовая задержка backoff (ms), реальная задержка случайная в `[0, base*2^attempt]` (jitter) | `500` |
| `GITFLIC_NO_RETRY=1` | Полностью отключить ретраи | — |

## Кеш

| Переменная | Что делает | Default |
|---|---|---|
| `GITFLIC_NO_CACHE=1` | Не использовать file-based project-UUID cache | — |

## Вывод

| Переменная | Что делает | Default |
|---|---|---|
| `NO_COLOR=1` | Отключить ANSI-цвета (по [no-color.org](https://no-color.org)) | — |
| `FORCE_COLOR=1` | Принудительно включить цвета даже без TTY | — |
| `GITFLIC_STREAM=1` | Всегда выводить NDJSON (как `--stream`) | — |

## Секреты

| Переменная | Что делает | Default |
|---|---|---|
| `XDG_CONFIG_HOME` | Базовая директория для config-файла | `$HOME/.config` |
| `XDG_CACHE_HOME` | Базовая директория для кеша | `$HOME/.cache` |

## Пример: полностью headless CI

```bash
export GITFLIC_TOKEN="$(cat ~/.gitflic-ci-token)"
export GITFLIC_NO_CACHE=1
export GITFLIC_NO_CONFIG=1
export GITFLIC_NO_RETRY=1      # fail fast
export NO_COLOR=1             # чистый вывод для grep/jq

gitflic mr list --project tikhon/wave --format json | jq '.[] | .localId'
```

## Пример: sandbox разработка

```bash
export GITFLIC_API_BASE=https://gitflic-staging.example.com
export GITFLIC_TOKEN="$(security find-generic-password -a tikhon-staging -s gitflic-cli -w)"
export GITFLIC_HTTP_RETRIES=0
# Без ретраев — увидишь ошибки сразу, удобно при дебаге.
```

## См. также

- [Флаги](flags.md)
- [Все команды](/commands/)
- [MCP-сервер](mcp-server.md)
