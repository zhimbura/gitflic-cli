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
gitflic settings oauth list
gitflic settings oauth get <id>

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

## Access tokens через REST

Создание access-token требует **HTTP Basic auth** (логин + пароль). CLI это не поддерживает — создавайте через Web UI в **Профиль → API-токены → Создать**.
