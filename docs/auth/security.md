---
description: "Как gitflic-cli хранит токены GitFlic: приоритет бэкендов (macOS Keychain, Linux libsecret, файл chmod 0600) и модель безопасности учётных данных."
---

# Безопасность хранения токенов

## Угрозы и защита — TL;DR

| Угроза | Защита | Уровень |
|---|---|---|
| Стиллер ищет `~/.zshrc`, `~/.aws/credentials`, `~/.netrc` | Токен в Keychain, не в plaintext файлах | ✅ Невозможно промахнуться |
| Бэкап диска украден | Keychain зашифрован на пароль юзера + системный ключ | ✅ Без пароля не расшифровать |
| Другой юзер на shared-хосте | File mode `0600` (только owner); keychain — owner-only | ✅ Другой uid не прочитает |
| Screen-share / video-call | `alias list/get` маскирует значения | ✅ Не утечёт в кадр |
| Стиллер запущен от твоего юзера | Все токены читаются тем же процессом | ❌ Не защищает (но и `gh`/`glab` тоже) |
| Токен в shell history | `GITFLIC_TOKEN=...` попадает в `~/.zsh_history` | ⚠️ Используй `--token <flag>` или read из файла |

## Подробно по каждому сценарию

### 1. Хранение на диске

`gitflic auth login` выбирает бэкенд в таком порядке:

```
macOS → security add-generic-password      (login.keychain, encrypted at rest)
Linux → secret-tool store                  (gnome-keyring / kwallet)
иначе → ~/.config/gitflic-cli/config.json  (chmod 0600, fallback)
```

Управляется переменной `GITFLIC_NO_SECRET_STORE=1` (полностью отключает keychain-путь — тогда токен хранится только в env var).

### 2. File fallback — почему `chmod 0600` достаточно

Когда keychain недоступен (например, в Docker-контейнере без `dbus`), CLI пишет в файл. Режим `0600` означает "только владелец может читать и писать".

```bash
$ ls -la ~/.config/gitflic-cli/config.json
-rw-------  1 user  staff  200 Jun 22 10:30 config.json
```

Это **не панацея**: любой процесс, запущенный от твоего юзера, прочитает файл. Это та же модель угроз, что и для `~/.ssh/id_ed25519` или `~/.aws/credentials`.

Если у тебя **shared-сервер** с несколькими юзерами — инсталлируй `secret-tool` и привязывай к GNOME Keyring / KWallet.

### 3. Защита от утечки в scrollback

`gitflic alias list` и `gitflic alias get token` маскируют значения:

```bash
$ gitflic alias list
token = def***xxx
(token backend: keychain)

$ gitflic alias get token
def***xxx
(masked — pass --reveal to print the full value)

$ gitflic alias get token --reveal
def-xxxx-1234-xxxx
```

Даже если вывод уйдёт в screencast, в лог CI, или в chat — там будет `def***xxx`, не реальный токен.

`--reveal` нужен редко (для отладки). В скриптах и пайпах НЕ используй его без крайней нужды.

### 4. Защита в process memory

Токен существует в памяти процесса только на время выполнения одной команды. Каждый вызов `gitflic ...` — отдельный процесс Node, токен живёт ~миллисекунды.

Если в системе есть подозрительный процесс, делающий `ps aux` — он увидит аргументы командной строки, но НЕ значение env var другого процесса. Поэтому `GITFLIC_TOKEN=... gitflic ...` лучше чем `gitflic --token xxx` (последнее видно в `ps`).

### 5. Stiller, запущенный от твоего юзера — единственная реальная угроза

Если на твоей маке запустился malware с твоими привилегиями:

- `security find-generic-password -w -s gitflic-cli` — **прочитает токен** (login.keychain разлочен пока ты залогинен).
- `secret-tool lookup service gitflic-cli` — аналогично на Linux.
- `cat ~/.config/gitflic-cli/config.json` — если file fallback, тоже прочитает.

Все три — game over для токена. **Это та же модель угроз, что и для `gh auth login` / `glab auth login` / `aws-vault`.**

Что реально защищает от такого:

| Защита | Усилие | Эффект |
|---|---|---|
| **Отдельный keychain с паролем** (`security create-keychain -p "strong" gitflic`) | низкое | Токен не доступен пока keychain залочен |
| **Hardware token (YubiKey)** для OAuth/WebAuthn | высокое | Токен вообще не на маке, выдаётся по запросу |
| **mTLS / SSH cert вместо bearer-токена** | среднее | Нет секрета для кражи |

`gitflic-cli` сейчас НЕ реализует ни одну из этих защит (это уровень `gh`/`glab`/`aws-vault` — отраслевой стандарт). Если нужна отдельная залочка — скажи, добавлю отдельным коммитом.

## Сводка по бэкендам

| Бэкенд | Когда доступен | Где хранится | Уровень защиты |
|---|---|---|---|
| macOS Keychain | На любом маке (бинарь `security` встроен) | `~/Library/Keychains/login.keychain-db` (зашифрован) | Хороший (game over только при локальном malware) |
| Linux libsecret | Если установлен `secret-tool` (libsecret + gnome-keyring / kwallet) | GNOME Keyring / KWallet (зашифровано) | Хороший |
| Файл `chmod 0600` | Всегда (fallback) | `~/.config/gitflic-cli/config.json` | Базовый (читается любым процессом юзера) |

## Что я НЕ рекомендую

- ❌ Хранить токен в `~/.zshrc` (mode 0644 → world-readable + утекает в любой `git add .` если zshrc в dotfiles-репо).
- ❌ Коммитить `.env` с токеном (даже в private-репо).
- ❌ Использовать один и тот же токен для всего (нет blast-radius control).
- ❌ Передавать `--token xxx` через CI logs.

## Связанное

- [Multi-account](multi-account.md) — несколько токенов с разными scope.
- [Per-project bindings](per-project.md) — роутинг токенов по проектам.
