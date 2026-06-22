# Быстрый старт

За 2 минуты от нуля до `gitflic mr list`.

## 1. Установить

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
cd ~/tools/gitflic-cli
bash install.sh
```

Подробности про все опции (Windows, custom prefix, dry-run) — [Установка](install.md).

## 2. Получить токен

Открой <https://gitflic.ru> → **Профиль** → **API-токены** → **Создать**.

Минимально нужные скоупы: `PROJECT_READ` + `PROJECT_WRITE` (или `PROJECT_EDIT`) для работы с MR.

## 3. Сохранить токен в системное хранилище

```bash
gitflic auth login --token xxxx-xxxx-xxxx
```

Что произойдёт:

1. CLI дёрнет `/user/me` с этим токеном — убедится, что токен валиден.
2. Покажет identity (alias + email).
3. Сохранит токен в:
   - **macOS** → Keychain (`security add-generic-password`)
   - **Linux** → libsecret (`secret-tool`)
   - **иначе** → `~/.config/gitflic-cli/config.json` с `chmod 0600` + предупреждение.

Битый токен **не сохраняется** — keychain остаётся чистым.

## 4. Пользоваться

```bash
gitflic project get tikhon/gitflic-cli              # резолв alias → UUID
gitflic mr list --project tikhon/gitflic-cli        # открытые MR
gitflic mr view 42 --project tikhon/gitflic-cli    # детали MR #42
gitflic mr create --title "Fix login" --to main    # создать MR
gitflic auth status                                 # проверить текущий аккаунт
```

## Что дальше

- [Аутентификация — обзор](auth/README.md) — multi-account, per-project bindings, threat model.
- [Команды — справочник](commands/README.md) — все доступные модули и флаги.
- [MCP-сервер](mcp-server.md) — для AI-агентов (Claude Code, Cursor).
- [Известные проблемы](known-issues.md) — что может пойти не так.
