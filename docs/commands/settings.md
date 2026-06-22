# Настройки пользователя (`gitflic settings ...`)

Управление SSH-ключами, OAuth-приложениями, токенами и профилем.

## SSH ключи

```bash
# Добавить SSH-ключ (читает файл или stdin)
gitflic settings ssh add ~/.ssh/id_ed25519.pub --title "macbook"

# С expires
gitflic settings ssh add ~/.ssh/id_ed25519.pub --title "temp" --expires 2026-12-31
```

> ⚠️ List и delete SSH-ключей **не доступны через REST API**. Управляется только через Web UI.

## OAuth apps

```bash
# Список своих OAuth-приложений
gitflic settings oauth list
gitflic settings oauth list --format json

# Получить одно приложение по id
gitflic settings oauth get <id>

# Создать приложение
gitflic settings oauth create \
  --name "My App" \
  --homepage https://myapp.example.com \
  --callback https://myapp.example.com/callback \
  --description "..."

# Standalone app (без редиректа, для service-to-service)
gitflic settings oauth create \
  --name "CI bot" \
  --homepage https://ci.example.com \
  --callback https://ci.example.com/cb \
  --standalone

# Редактировать приложение (имя обязательно, остальное опционально)
gitflic settings oauth edit <id> \
  --name "My App v2" \
  --homepage https://myapp.example.com \
  --callback https://myapp.example.com/callback/v2 \
  --description "обновлённое описание"

gitflic settings oauth delete <id>
```

## Transport tokens (для git push через HTTPS)

```bash
gitflic settings transport-token create \
  --name "CI deploy" \
  --scope READ_REGISTRY

gitflic settings transport-token create \
  --name "CI deploy" \
  --scope READ_REGISTRY --scope WRITE_REGISTRY
```

> ⚠️ GitFlic **не принимает transport-token для HTTPS git push** (как и большинство GitLab-подобных серверов). Используйте SSH-ключ для git push. Transport-token работает только для registry (Maven/NPM/etc).

## Смена профиля

```bash
gitflic settings change-email --email new@example.com
gitflic settings change-username --username new-alias    # НЕОБРАТИМО!
gitflic settings change-password \
  --old-password "old" \
  --password "new" \
  --password-confirm "new"
```

## Access tokens (API-токены)

Создание API-токена с явным набором прав. Права задаются повторяемым флагом `--scope`
(`USER_READ`, `USER_WRITE`, `PROJECT_READ`, `PROJECT_WRITE`, `PROJECT_EDIT`, `TEAM_READ`,
`TEAM_WRITE`, `COMPANY_READ`, `COMPANY_WRITE`, `READ_REGISTRY`, `WRITE_REGISTRY`).

```bash
gitflic settings access-token create \
  --name "CI read-only" \
  --scope PROJECT_READ --scope USER_READ

# С датой истечения
gitflic settings access-token create \
  --name "temp full" \
  --scope PROJECT_READ --scope PROJECT_WRITE \
  --expires 2026-12-31
```

> ⚠️ По известным проблемам этот эндпоинт может требовать **HTTP Basic auth** (логин + пароль).
> Если запрос возвращает 401/403, создайте токен через Web UI в **Профиль → API-токены → Создать**.
