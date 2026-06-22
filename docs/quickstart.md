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

CLI покрывает REST API GitFlic почти на 100% — ниже несколько примеров «посерьёзнее».

### Реестр пакетов (registry)

Загрузка и скачивание артефактов. Формат указывается через `--fmt` (не `--format` — он зарезервирован под вывод):

```bash
# Загрузить Maven-артефакт в реестр проекта
gitflic registry package upload --fmt maven --project tikhon/wave \
  ./app-1.0.jar com.acme app 1.0

# Скачать npm-пакет
gitflic registry package download --fmt npm --project tikhon/wave \
  my-pkg my-pkg-1.0.tgz --out ./out.tgz

# Список пакетов компании в формате JSON
gitflic registry package list --scope company --company acme --type maven --format json
```

### Релизы (release)

```bash
# Создать релиз с тегом
gitflic release create --title "v1.2.0" --tag v1.2.0 --project tikhon/wave

# Прикрепить файл к релизу (.zip/архивы проходят валидацию типа на сервере)
gitflic release upload <releaseUuid> ./build.zip --name build.zip --project tikhon/wave
```

### Задачи (issue)

```bash
# Загрузить файл в проект и прикрепить его к задаче одной командой
gitflic issue attach 17 ./screenshot.png --name bug.png --project tikhon/wave
```

### Защита веток и тегов

Правила защиты можно задавать на уровне проекта, команды или компании:

```bash
# Запретить force-push в main на уровне проекта
gitflic branch protection create --project tikhon/wave \
  --branch-template main --allowed-to-push ADMINS --allowed-to-merge DEVELOPER

# Защита тегов на уровне команды
gitflic tag protection create --scope team --team backend \
  --tag-template "v*" --allow-to-create ADMINS
```

### CI/CD-раннеры

```bash
gitflic runner list --project tikhon/wave --format json   # раннеры проекта
gitflic runner list --scope company --company acme         # раннеры компании
```

## Что дальше

- [Аутентификация — обзор](auth/README.md) — multi-account, per-project bindings, threat model.
- [Команды — справочник](commands/README.md) — все доступные модули и флаги.
- [MCP-сервер](mcp-server.md) — для AI-агентов (Claude Code, Cursor).
- [Известные проблемы](known-issues.md) — что может пойти не так.
