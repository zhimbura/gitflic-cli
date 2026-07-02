---
description: "Команды gitflic auth login, logout, status и list: вход в GitFlic по токену, проверка через /user/me и управление сохранёнными учётными записями."
---

# `auth login` / `logout` / `status` / `list`

## login

```bash
gitflic auth login --token xxxx-xxxx-xxxx           # вставить напрямую
echo $TOKEN | gitflic auth login --stdin             # из stdin (удобно для scripts)
gitflic auth login --token xxxx --as work            # в named-аккаунт
```

Что происходит:

1. CLI читает токен из `--token`, `--stdin` или `GITFLIC_TOKEN` (по порядку).
2. Дёргает `GET /user/me` с этим токеном.
3. Если 200 — показывает identity (alias + email) и сохраняет в keychain.
4. Если 401/403/сетевая ошибка — **die**, токен НЕ сохраняется.

```
gitflic: logged in as tikhon <t@example.com> (account: default, backend: keychain)
```

Если бэкенд — не keychain, а файл (например, на сервере без `secret-tool`), будет warning:

```
gitflic: WARNING — storing 'token' in plaintext file /home/u/.config/gitflic-cli/config.json (chmod 0600).
gitflic: For stronger protection, install an OS keychain …
```

### Многословие флагов

| Флаг | Что делает |
|---|---|
| `--token <value>` | Значение токена (иначе читает из `--stdin` / `GITFLIC_TOKEN`) |
| `--stdin` | Читает токен из stdin (до первого перевода строки, или весь stdin если однострочный) |
| `--as <name>` | Сохраняет в `token:<name>`, делает активным (см. [multi-account](multi-account.md)) |
| `--api-base <url>` | Override API base для валидационного запроса |

## logout

```bash
gitflic auth logout                  # удалить активный аккаунт
gitflic auth logout --as work        # удалить конкретный named
gitflic auth logout --all            # удалить ВСЕ токены + все bindings
```

С `logout --all` CLI:

1. Удаляет все `token:*` ключи из secret store + file fallback.
2. Удаляет `active-account` если был.
3. Удаляет все `account-bind:*` (привязки на удалённые аккаунты — мёртвые).
4. Сообщает: `gitflic: all tokens cleared (3 account key(s), 2 binding(s))`.

Keychain-записи (`security find-generic-password`) после этого не находятся (exit code 44).

## status

```bash
gitflic auth status
```

```
account:    work
backend:    keychain
identity:   user-work <user-work@corp.example.com>
api:        https://api.gitflic.ru
```

Exit code 1 если токен не доходит до API (network / 401 / 403). Это полезно для pre-flight checks в CI:

```bash
gitflic auth status || echo "auth broken, run gitflic auth login"
```

## list

```bash
gitflic auth list
```

```
  default   def***aaa
* personal  per***ccc
  work      wor***bbb
(active: personal, backend: keychain)
```

- `*` — активный аккаунт (используется для команд без `--project` или без `account-bind`).
- Все токены маскированы (`abc***xyz`), даже если вывод направлен в pipe/log.
- `(active: X, backend: Y)` — последняя строка показывает какой бэкенд используется.
