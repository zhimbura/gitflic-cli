# SAML SSO (`gitflic saml ...`)

> ⚠️ Admin-only. Требуются права администратора инстанса (для обычного токена — 403/404). Code-only — не live-tested на self-hosted с настроенным SAML.

Управление SAML-подключениями (Single Sign-On) через `/admin/saml`.

## `saml list`

Список SAML-подключений (`GET /admin/saml`).

```bash
gitflic saml list
gitflic saml list --page 0 --size 50 --format json
```

## `saml create`

Создать SAML-подключение (`POST /admin/saml`).

```bash
gitflic saml create \
  --name "Corp IdP" \
  --idp-metadata-url https://idp.example.com/metadata \
  --idp-issuer https://idp.example.com/entity \
  --idp-initiated-sso-url https://idp.example.com/sso \
  --cert ./idp-cert.pem
```

## `saml edit`

Изменить SAML-подключение по UUID (`PUT /admin/saml/{uuid}`).

```bash
gitflic saml edit <samlUuid> --name "New name"
gitflic saml edit <samlUuid> --idp-metadata-url https://idp.example.com/metadata2
```

## `saml change-status`

Включить/выключить подключение (`PUT /admin/saml/{uuid}change-status`).

```bash
gitflic saml change-status <samlUuid> --enabled true
gitflic saml change-status <samlUuid> --enabled false
```
