---
title: "Вопросы и ответы: установка, токен, MCP"
description: "GitFlic CLI: что это, как установить через npm, как войти по токену, есть ли MCP-сервер для Claude Code и Cursor и работает ли с self-hosted GitFlic."
---

# GitFlic CLI: вопросы и ответы

## Что такое GitFlic CLI?

GitFlic CLI (`gitflic-cli`) — неофициальный консольный клиент для [GitFlic](https://gitflic.ru). Он покрывает 20 разделов публичного REST API (~199 эндпоинтов): merge-реквесты, релизы, задачи, ветки, теги, проекты, реестр пакетов, CI/CD.

## Чем он отличается от официального cli.jar?

Официальный `cli.jar` — серверная утилита администратора для self-hosted GitFlic. GitFlic CLI — пользовательский клиент REST API для повседневной работы.

## Как установить GitFlic CLI?

```bash
npm install -g gitflic-cli
```

Или разово: `npx gitflic-cli help`. Нужен Node.js 18 и выше. Другие способы — на странице [Установка](/install.html).

## Как войти в GitFlic из CLI?

```bash
gitflic auth login --token xxxx-xxxx-xxxx
```

Токен проверяется через `/user/me` и сохраняется в Keychain или libsecret. Подробнее: [аутентификация](/auth/).

## Есть ли MCP-сервер для GitFlic?

Да, пакет `gitflic-cli-mcp`. Он даёт AI-агентам 78 инструментов GitFlic. Подробнее: [GitFlic MCP-сервер](/mcp-server.html).

## Как подключить GitFlic к Claude Code?

```bash
claude mcp add gitflic --env GITFLIC_TOKEN=xxxxxxxx -- npx -y gitflic-cli-mcp
```

Для Cursor используйте `~/.cursor/mcp.json`. Пример конфига — на странице [MCP-сервер](/mcp-server.html). Общий обзор: [GitFlic и AI-агенты](/ai-agents.html).

## Работает ли GitFlic CLI с self-hosted GitFlic?

Адрес API задаёт переменная `GITFLIC_API_BASE` (по умолчанию `https://api.gitflic.ru`). Список переменных: [ENV](/env.html).

## Нужен ли npm install для самого CLI?

Нет, у CLI нет runtime-зависимостей. Зависимости ставятся только для MCP-сервера из исходников.
