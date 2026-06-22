# Admin endpoints (`gitflic admin ...`)

> ⚠️ Все команды требуют **admin-токен** (instance-admin права). Для обычного токена вернётся 403/404. Code-only: реализовано по спеке, не live-tested на публичном SaaS.

Покрытие admin-API: управление пользователями (CRUD), бан/разбан, SSH-ключи, push-статистика, настройки сервиса и импорт из LDAP.

## Пользователи

### user list

Список всех пользователей инстанса (legacy-эндпоинт, отсутствует в публичной REST-доке — может вернуть 404).

```bash
gitflic admin user list --all --format json
gitflic admin user list --page 0 --size 50
```

### user create

Создать пользователя (`POST /user`).

```bash
gitflic admin user create --email ivan@example.com --password 'S3cret!' --alias ivanov
```

### user change-email

Сменить email пользователя.

```bash
gitflic admin user change-email ivanov --email new@example.com
```

### user change-username

Сменить username пользователя.

```bash
gitflic admin user change-username ivanov --username petrov
```

### user change-password

Сменить пароль пользователя.

```bash
gitflic admin user change-password ivanov --password 'N3wPass!' --password-confirm 'N3wPass!'
```

### user ban / unban

Заблокировать (причина ≤ 128 символов) или разблокировать пользователя. Указывается **UUID** пользователя.

```bash
gitflic admin user ban 3f1c2a90-... --reason "spam"
gitflic admin user unban 3f1c2a90-...
```

## SSH-ключи пользователя

### user key-create

Добавить SSH-ключ пользователю.

```bash
gitflic admin user key-create ivanov --public-key "ssh-ed25519 AAAA..." --title "laptop" --expires-at 2027-01-01T00:00:00Z
```

### user key-list

Список SSH-ключей пользователя.

```bash
gitflic admin user key-list ivanov --format json
```

## Проекты

### project list

Список всех проектов инстанса (legacy-эндпоинт, может вернуть 404).

```bash
gitflic admin project list --all --format json
```

## Push-статистика

### push-stats all

Push-статистика по всем пользователям.

```bash
gitflic admin push-stats all --page 0 --size 100 --format json
```

### push-stats specified

Push-статистика по конкретным пользователям (UUID списком или через `--uuids`).

```bash
gitflic admin push-stats specified a1b2c3 d4e5f6
gitflic admin push-stats specified --uuids a1b2c3,d4e5f6 --format json
```

## Настройки сервиса

### settings get

Показать объект настроек сервиса.

```bash
gitflic admin settings get --format json
```

### settings set

Обновить группу настроек (`POST /admin/settings/<group>`). Группа передаётся первым аргументом, далее — флаги группы.

```bash
# регистрация / способы аутентификации
gitflic admin settings set registration --disable-ldap-auth --disable-mail-auth

# скачивание файлов и релизов анонимами
gitflic admin settings set download --file-download true
gitflic admin settings set download-release --download-from-anon-user-enable false

# pull анонимом, авто-подтверждение, валидация email
gitflic admin settings set pull --pull-repo-from-anon-user false
gitflic admin settings set auto-confirm --auto-confirm true
gitflic admin settings set email-validation --enable-email-validation true

# валидация доменов (white/black-list)
gitflic admin settings set domain-validation --enable-domain-validation true --enable-white-list true --white-list-domains example.com,corp.ru

# лимиты API
gitflic admin settings set api-limit --disable-api-limit false --user-api-count-limit 1000

# кастомный SSH-порт
gitflic admin settings set ssh-port --enable-custom-ssh-port true --ssh-port 2222

# доступ к глобальному registry анонимам
gitflic admin settings set anonymous-global-registry-access --anonymous-global-registry-access false

# авто-права для публичных репозиториев
gitflic admin settings set public-repository-auto-permission --enabled true

# лаг и интервалы обновления зеркал
gitflic admin settings set mirror-update-lag --project-update-lag 5
gitflic admin settings set mirror-update-interval --push-mirror-update-interval-minutes 15 --pull-mirror-update-interval-minutes 30

# таймаут неактивной сессии
gitflic admin settings set session-max-inactive-interval --session-max-inactive-interval-minutes 60

# права на создание сущностей
gitflic admin settings set create-permissions --enable-create-project true --enable-create-team true --enable-create-company false

# страница входа и доступные провайдеры
gitflic admin settings set login-page --login-page-url BASIC --is-enable-basic --is-enable-ldap

# блокировка аккаунта при неудачных попытках
gitflic admin settings set lock-account --lock-user true --max-attempts 5 --time-to-lock-user 30 --time-to-count-fail-user-login-attempts 15

# архив паролей пользователя
gitflic admin settings set archive-password --enable-archive-user-passwords true --max-user-archived-passwords 5
```

Доступные группы и флаги:

| Группа | Флаги |
|---|---|
| `registration` | `--disable-ldap-auth` `--disable-saml-auth` `--disable-oidc-auth` `--disable-mail-auth` |
| `download` | `--file-download <bool>` |
| `pull` | `--pull-repo-from-anon-user <bool>` |
| `download-release` | `--download-from-anon-user-enable <bool>` |
| `auto-confirm` | `--auto-confirm <bool>` |
| `email-validation` | `--enable-email-validation <bool>` |
| `domain-validation` | `--enable-domain-validation <bool>` `--enable-white-list <bool>` `--black-list-domains a,b` `--white-list-domains a,b` |
| `api-limit` | `--disable-api-limit <bool>` `--user-api-count-limit <n>` |
| `ssh-port` | `--enable-custom-ssh-port <bool>` `--ssh-port <n>` |
| `anonymous-global-registry-access` | `--anonymous-global-registry-access <bool>` |
| `public-repository-auto-permission` | `--enabled <bool>` |
| `mirror-update-lag` | `--project-update-lag <n>` |
| `session-max-inactive-interval` | `--session-max-inactive-interval-minutes <n>` |
| `mirror-update-interval` | `--push-mirror-update-interval-minutes <n>` `--pull-mirror-update-interval-minutes <n>` |
| `create-permissions` | `--enable-create-project <bool>` `--enable-create-team <bool>` `--enable-create-company <bool>` |
| `login-page` | `--login-page-url BASIC\|SAML\|LDAP\|OIDC` `--is-enable-basic` `--is-enable-ldap` `--is-enable-saml` `--is-enable-oidc` |
| `lock-account` | `--lock-user <bool>` `--max-attempts <n>` `--time-to-lock-user <n>` `--time-to-count-fail-user-login-attempts <n>` |
| `archive-password` | `--enable-archive-user-passwords <bool>` `--max-user-archived-passwords <n>` |

## LDAP

### ldap import

Запустить синхронизацию пользователей из LDAP по UUID конфигурации.

```bash
gitflic admin ldap import 7c8d9e10-...
```

## См. также

- Раннеры инстанса — `gitflic runner` (требует instance-admin права).
- SAML — `gitflic saml` (требует instance-admin права).
