# Admin endpoints (`gitflic admin ...`)

> ⚠️ Требует admin-токен. Code-only — не live-tested на self-hosted.

```bash
gitflic admin user list              # все юзеры
gitflic admin project list           # все проекты
```

Большинство admin-операций (suspend user, force-merge MR, etc) **не имеют публичного REST-эндпоинта** — только Web UI в admin-панели.

Если у тебя есть конкретный use-case (например, батч-операция над юзерами), открой issue — посмотрим, есть ли API и стоит ли оборачивать.
