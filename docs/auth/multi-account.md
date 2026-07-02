---
description: "Multi-account в gitflic-cli: храните несколько токенов GitFlic (рабочий и личный) и переключайтесь между ними флагом --as и командой auth switch."
---

# Multi-account

Если у тебя несколько личностей на GitFlic (рабочая + личная, например), `--as <name>` позволяет хранить токены для каждой отдельно.

## Базовый flow

```bash
gitflic auth login --token def-xxxx               # default аккаунт
gitflic auth login --as work --token work-yyyy    # work-аккаунт
gitflic auth login --as personal --token pers-zz  # personal

gitflic auth list
#   default   def***xxx
# * work      wor***yyy     ← активный сейчас
#   personal  per***zzz

gitflic auth switch personal                     # переключиться
gitflic auth status                              # identity от personal
```

`auth switch` валидирует, что токен для указанного аккаунта существует. Если нет — отказывается:

```
gitflic: auth switch: no token stored for account 'ghost'.
gitflic: run: gitflic auth login --as ghost
```

## Resolution chain с multi-account

Когда `flags.project` НЕ задан:

1. `--token <flag>`
2. `GITFLIC_TOKEN` env
3. `token:<active-account>` (или `token` если active не задан)
4. die

`active-account` хранится в `~/.config/gitflic-cli/config.json`, меняется через `auth switch`.

## Где живут токены

| Аккаунт | Storage key | Бэкенд |
|---|---|---|
| `default` | `token` | OS keychain (если есть) или файл |
| `work` | `token:work` | то же |
| `personal` | `token:personal` | то же |

Default-аккаунт использует legacy-ключ `token` для backward-compat с первой версией CLI (когда multi-account ещё не было).

## Очистка

```bash
gitflic auth logout --as work     # удалить только work
gitflic auth logout --all         # удалить ВСЕ
```

`logout --all` дополнительно чистит все `account-bind:*` (per-project привязки, см. [per-project.md](per-project.md)).

## Сценарии

### Один юзер, разные GitFlic-инстансы (cloud + self-hosted)

```bash
gitflic auth login --as cloud --token xxx
GITFLIC_API_BASE=https://git.corp.io gitflic auth login --as corp --token yyy

gitflic alias set api-base https://api.gitflic.ru      # для cloud
gitflic auth switch cloud
gitflic mr list --project FerdBur/wave                # → cloud-токен, api.gitflic.ru
GITFLIC_API_BASE=https://git.corp.io gitflic auth switch corp
gitflic mr list --project myteam/internal             # → corp-токен, self-hosted
```

### Личное и рабочее в одном репо

Используй [per-project bindings](per-project.md):

```bash
gitflic auth bind FerdBur/wave work       # этот проект — от work
gitflic auth bind tikhon/personal personal # этот — от personal
# любые команды автоматически подставят правильный токен
```
