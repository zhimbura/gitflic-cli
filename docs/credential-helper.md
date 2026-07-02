---
description: "Настройка gitflic как git credential helper: git push и git pull к GitFlic автоматически получают токен через CLI, без ручного ввода паролей."
---

# Git credential helper

> ⚠️ Не реализовано. Это страница-плейсхолдер для будущей фичи.

`gitflic` можно зарегистрировать как **credential helper** для git — тогда `git push` и `git pull` автоматически получат токен через CLI.

## Как это должно работать

```bash
git config --global credential.helper '!gitflic credential helper'
git push origin main
# CLI читает action из stdin, возвращает username + token
```

## Формат credential helper

Git вызывает credential helper через stdin/stdout:

```
action=get
protocol=https
host=gitflic.ru
```

Helper должен ответить (на stdout):

```
protocol=https
host=gitflic.ru
username=oauth2
password=<token>
```

## Почему пока не реализовано

GitFlic поддерживает HTTPS push только с **SSH-ключом или Personal Access Token**. Transport-token (который CLI умеет создавать через `settings transport-token create`) НЕ работает для git push (см. [settings.md](commands/settings.md)).

Так что для git push поверх HTTPS нужно:
1. Создать Personal Access Token через Web UI (CLI не поддерживает — basic auth нужен).
2. Передать его credential helper'у.

Сложность vs выгода пока не в нашей пользе — большинство пользователей используют SSH.

## Если очень нужно

Открой issue: https://gitflic.ru/project/tikhon/gitflic-cli/-/issues с описанием use-case. Реализуем, если спрос есть.

## См. также

- [Аутентификация](/auth/) — хранение токена и resolution chain.
- [settings](commands/settings.md) — SSH-ключи, access- и transport-токены.
- [Известные проблемы](known-issues.md) — HTTPS git push с токеном и через SSH-ключ.
