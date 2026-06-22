# Известные проблемы и обходы

## `tag get <name>` возвращает 400 для большинства имён

**Симптом:**

```
gitflic tag get v1.0.0 --project FerdBur/wave
gitflic: HTTP 400 — ...
```

**Причина:** GitFlic API не поддерживает `GET /tag/{name}` для project-scoped запросов надёжно.

**Обход:** используйте `gitflic tag list | grep v1.0.0` или `gitflic tag list --format json | jq '.[] | select(.name == "v1.0.0")'`.

---

## `mr merge` падает с `MergeCheckException` на свежих проектах

**Симптом:**

```
gitflic mr merge 1 --project myorg/new-repo
gitflic: HTTP 422 — MergeCheckException
```

**Причина:** default branch protection требует approve от пользователя, который НЕ является автором MR. Это политика GitFlic по умолчанию.

**Обход:** approve свой MR от другой личности (если есть), или измени branch protection через Web UI / `gitflic branch protection edit`.

---

## GitFlic отдаёт локализованные значения для некоторых полей

**Симптом:** `status.title` = «Открыт», «Слит», «Закрыт» (русский) вместо английских констант.

**Решение:** CLI передаёт `Accept-Language: en` где возможно, но не все эндпоинты это уважают. Используйте `status.id` для машинной обработки (всегда английские константы: `OPENED`, `MERGED`, `CLOSED`, `CANCELED`, `FAILED`).

---

## SSH push требует SSH-ключ (не токен)

Transport-token (создаётся через `settings transport-token create`) **НЕ работает для HTTPS git push**. GitFlic, как и GitLab, требует SSH-ключ для push.

**Обход:** добавь SSH-ключ через Web UI или через CLI:

```bash
gitflic settings ssh add ~/.ssh/id_ed25519.pub --title "macbook"
```

После этого `git push` через SSH работает без пароля.

---

## `gitflic tag delete` — no-op с предупреждением

Нет публичного REST-эндпоинта для удаления тегов.

**Обход:**

```bash
git push origin :v1.0.0   # standard git tag delete via push
```

---

## Multipart upload endpoints — best-guess

Для `release asset upload` и `issue attachment upload` URL эндпоинтов — best-guess на основе публичной API-документации. Если получаешь 404 — проверь `lib/cmd/release.mjs:140` и `lib/cmd/issue.mjs:217`, поправь URL.

PR приветствуется.

---

## Access-token через REST — нет

Создание access-token требует **HTTP Basic auth** (логин + пароль). CLI не поддерживает Basic auth.

**Обход:** создавай токены через Web UI в **Профиль → API-токены → Создать**.

---

## `runner list` может быть пустым даже при наличии runner'ов

**Симптом:** `gitflic runner list` возвращает пустой массив, хотя в Web UI runner'ы видны.

**Причина:** возможно, у твоего токена нет admin scope для просмотра всех runner'ов (только self-hosted видимые лично тебе).

**Обход:** используй admin-токен, или проверь через Web UI.

---

## `saml list` — code-only, не live-tested

Модуль реализован, но живое тестирование против self-hosted GitFlic с SAML SSO не проводилось. Если у тебя есть такой инстанс — проверь и открой issue если что-то сломано.

---

## `admin` модуль — code-only

`gitflic admin user list` / `admin project list` — реализованы, но используют admin-эндпоинты которые могут быть недоступны на твоём инстансе или требовать особых scope.

---

## `npm install` в подпапке `mcp-server/`

CLI (`gitflic`) — **zero deps**, работает только на Node stdlib.

MCP-сервер (`mcp-server/`) требует `@modelcontextprotocol/sdk`. Это сознательное решение — MCP-протокол слишком сложный чтобы реализовать руками, и SDK маленький (~2MB).

Если ты используешь только CLI (не MCP), `npm install` в `mcp-server/` не нужен.

---

## Vitest warnings о esbuild

При прогоне тестов может появиться:

```
Module "form-data" has been externalized
```

Это нормально — vitest lazy-loads модули. Не влияет на результаты тестов.
