---
description: "Команды gitflic branch и tag: список, создание и удаление веток и тегов GitFlic, правила защиты веток (branch protection) и ветка по умолчанию."
---

# Ветки и теги

## branch

```bash
gitflic branch list --project FerdBur/wave                # все ветки
gitflic branch list --project FerdBur/wave --all          # авто-пагинация
gitflic branch get master --project FerdBur/wave          # детали
gitflic branch default --project FerdBur/wave             # default branch проекта
```

### create / delete

```bash
gitflic branch create my-feature --project FerdBur/wave
gitflic branch create my-feature --project FerdBur/wave --from master  # от другой ветки (по умолчанию master)
gitflic branch delete my-feature --project FerdBur/wave
```

### compare

File-level diff между двумя ветками:

```bash
gitflic branch compare my-feature --project FerdBur/wave
gitflic branch compare my-feature --base master --project FerdBur/wave
```

### compare-file

Diff одного файла между двумя коммитами:

```bash
gitflic branch compare-file --project FerdBur/wave \
  --file-path src/main.js \
  --base-hash <oldHash> \
  --compare-hash <newHash>
```

### commits

Список коммитов между двумя хэшами (base должен быть старше):

```bash
gitflic branch commits --project FerdBur/wave \
  --base-hash <oldHash> \
  --compare-hash <newHash> --format json
```

### Branch protection

По умолчанию правила привязаны к проекту. Для company/team-уровня добавьте `--scope company|team` и `--company/--team <alias>`.

```bash
gitflic branch protection list --project FerdBur/wave
gitflic branch protection list --project FerdBur/wave --all
gitflic branch protection get <uuid> --project FerdBur/wave

gitflic branch protection create --project FerdBur/wave \
  --branch-template master \
  --allowed-to-push NO_ONE \
  --allowed-to-merge DEVELOPER

# Флаги:
#   --allow-force-push        — разрешить force push
#   --code-owner-approval     — требовать code-owner approval
#   --auto-merge              — auto-merge когда все checks pass

gitflic branch protection edit <uuid> --project FerdBur/wave \
  --allowed-to-merge ADMINS

gitflic branch protection delete <uuid> --project FerdBur/wave
```

`NO_ONE | DEVELOPER | ADMINS` — уровни доступа для push/merge.

Company/team scope:

```bash
gitflic branch protection list --scope team --team tikhon
gitflic branch protection create --scope company --company acme \
  --branch-template "release/*" \
  --allowed-to-push ADMINS \
  --allowed-to-merge ADMINS

# Применить настройки protection company/team к её проектам:
gitflic branch protection apply-settings --scope team --team tikhon
```

## tag

```bash
gitflic tag list --project FerdBur/wave                   # все теги
gitflic tag list --project FerdBur/wave --all             # авто-пагинация
gitflic tag get v1.0.0 --project FerdBur/wave             # ⚠️ может вернуть 400 — см. ниже
gitflic tag create v1.0.0 --project FerdBur/wave --branch master
gitflic tag create v1.0.0 --project FerdBur/wave --commit <hash> --message "Release"
gitflic tag delete v1.0.0 --project FerdBur/wave          # см. ниже
```

> ⚠️ `tag get <name>` возвращает HTTP 400 от GitFlic для любого имени — это поведение API. Получайте тег через `tag list` + grep.

> ⚠️ В GitFlic нет REST-эндпоинта для удаления тегов. Команда `tag delete` — no-op с предупреждением. Удаляйте тег через git: `git push origin :v1.0.0`.

### Tag protection (team/company scope)

Правила защиты тегов живут на уровне team/company, не проекта. Передавайте `--scope team|company` с `--team/--company <alias>`.

```bash
gitflic tag protection list --scope team --team tikhon
gitflic tag protection get <uuid> --scope company --company acme

gitflic tag protection create --scope team --team tikhon \
  --tag-template "v*" \
  --allow-to-create ADMINS

gitflic tag protection edit <uuid> --scope team --team tikhon \
  --allow-to-create DEVELOPER

gitflic tag protection delete <uuid> --scope team --team tikhon

# Применить настройки tag-protection team/company к её проектам:
gitflic tag protection apply-settings --scope team --team tikhon
```

`NO_ONE | DEVELOPER | ADMINS` — уровни доступа для создания тегов.

## См. также

- [Merge Requests](mr.md)
- [Коммиты и файлы](commit-blob.md)
- [Известные проблемы](../known-issues.md)
