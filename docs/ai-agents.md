---
title: "GitFlic и AI: Claude Code, Cursor, MCP"
description: "Как подключить AI-агента к GitFlic: MCP-сервер или CLI с --format json для Claude Code и Cursor. Права токена, режим только для чтения, примеры."
---

# GitFlic и AI-агенты

AI-агент (Claude Code, Cursor и другие) работает с GitFlic двумя способами: через MCP-сервер или через GitFlic CLI с машинным выводом. Оба способа используют один токен GitFlic и один и тот же REST API.

## Какой способ выбрать

| Способ | Когда подходит |
|---|---|
| **GitFlic MCP** (`gitflic-cli-mcp`) | Агент сам вызывает типизированные инструменты: MR, задачи, релизы. 78 инструментов, ответы сжимаются. |
| **GitFlic CLI** (`gitflic … --format json`) | Агент уже умеет запускать команды в терминале. Вывод в JSON или NDJSON, коды возврата стабильны. |

## Подключить GitFlic MCP за минуту

1. Создайте токен доступа GitFlic в настройках аккаунта.
2. Выполните команду для Claude Code:

```bash
claude mcp add gitflic --env GITFLIC_TOKEN=xxxxxxxx -- npx -y gitflic-cli-mcp
```

Для Cursor добавьте сервер в `~/.cursor/mcp.json`. Пример конфига есть на странице [MCP-сервер](/mcp-server.html).

## Дать агенту только чтение

Чтобы агент не менял данные, задайте в `env` сервера переменные:

- `GITFLIC_MCP_READONLY=1` — только инструменты без изменений;
- `GITFLIC_MCP_NO_DESTRUCTIVE=1` — без удаления;
- `GITFLIC_MCP_GROUPS` — только нужные группы инструментов (меньше расход токенов контекста).

Полная таблица переменных — в разделе [Ограничение набора тулзов](/mcp-server.html).

## Использовать GitFlic CLI из агента

Установите CLI и войдите по токену:

```bash
npm install -g gitflic-cli
gitflic auth login --token xxxx-xxxx-xxxx
gitflic mr list --project owner/repo --format json
```

Все команды поддерживают `--format json`. Список остальных команд — в [справочнике](/commands/). Переменные окружения (`GITFLIC_TOKEN`, `GITFLIC_API_BASE`) описаны на странице [ENV](/env.html).

## Частые вопросы

**Нужен ли Node.js?** Да, версии 18 и выше.

**Это официальный инструмент GitFlic?** Нет. Это пользовательский клиент для публичного REST API. Ответы на другие вопросы — в [FAQ](/faq.html).
