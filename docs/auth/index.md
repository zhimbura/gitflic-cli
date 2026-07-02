---
description: "Аутентификация в gitflic-cli: хранение токена GitFlic с автовыбором самого безопасного бэкенда — Keychain, libsecret или файл с chmod 0600."
---

# Аутентификация

CLI поддерживает несколько сценариев хранения токена с автоматическим выбором самого безопасного доступного бэкенда.

## Краткая картина

| Где лежит токен | Как попадает туда | Когда это работает |
|---|---|---|
| **macOS Keychain** | `gitflic auth login` | На любом маке (бинарь `security` встроен) |
| **Linux libsecret** | `gitflic auth login` | Если установлен `secret-tool` (libsecret + GNOME Keyring / KWallet) |
| **Файл с chmod 0600** | fallback | Если ничего из вышеперечисленного не нашлось — с warning в stderr |
| **env var `GITFLIC_TOKEN`** | `export GITFLIC_TOKEN=...` в шелле | Универсально, но требует ручной настройки |
| **`--token <flag`** | per-call | Для одноразовых вызовов (CI, scripts) |

## Подкоманды

- **[`auth login`](login.md)** — валидирует и сохраняет токен.
- **[`auth logout`](login.md#logout)** — удаляет токен.
- **[`auth status`](login.md#status)** — показывает текущего юзера + бэкенд.
- **[`auth list`](login.md#list)** — все аккаунты (маскированные).
- **[`auth switch`](multi-account.md#switch)** — переключить активный аккаунт.
- **[`auth bind`](per-project.md)** — привязать проект к аккаунту.
- **`auth unbind`** / **`auth bindings`** — управление привязками.

## Resolution chain

Когда любая команда CLI ищет токен, она проходит этот список сверху вниз:

1. **`--token <value>`** (per-call override).
2. **`GITFLIC_TOKEN`** env var.
3. **`account-bind:<project>`** — если `flags.project` задан (per-project override, см. [Per-project bindings](per-project.md)).
4. **`token:<active-account>`** — если `auth switch` установил активный аккаунт.
5. **`token`** — legacy-ключ для default-аккаунта (если `active-account` не задан).
6. **die** с подсказкой: `no token. Run gitflic auth login --token <value> ...`.

Каждый уровень проверяется по очереди. Ничего не "проваливается" молча.

## Угрозы и защита

Подробный разбор — [auth/security.md](security.md). TL;DR:

| Угроза | Защита |
|---|---|
| Стиллер ищет `~/.zshrc`, `~/.aws/credentials`, `~/.netrc` | Keychain не попадает в plaintext grep |
| Бэкап диска украден | Keychain зашифрован паролем юзера (без него не расшифровать) |
| Другой юзер на маке | File mode `chmod 0600`, keychain — owner-only |
| Стиллер запущен от твоего юзера | Все токены утекают — это game over независимо от нас |
| Токен ушёл в scrollback / history | `alias list/get` маскирует sensitive значения |

## Что НЕ реализовано (по сравнению с `gh`)

- ❌ OAuth browser flow — GitFlic OAuth-документация не подтверждена, нет смысла делать вслепую.
- ❌ `git credential.helper` интеграция — отдельная UX-история, есть в планах.
- ❌ TTL / auto-refresh токенов — нужна поддержка expiry в API GitFlic.

Если что-то из этого нужно — отдельным коммитом.
