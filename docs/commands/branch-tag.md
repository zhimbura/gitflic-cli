# Ветки и теги

## branch

```bash
gitflic branch list --project FerdBur/wave                # все ветки
gitflic branch list --project FerdBur/wave --all          # авто-пагинация
gitflic branch get master --project FerdBur/wave          # детали
gitflic branch default --project FerdBur/wave            # default branch проекта
```

### create / delete

```bash
gitflic branch create my-feature --project FerdBur/wave
gitflic branch create my-feature --project FerdBur/wave --from master  # от другой ветки
gitflic branch delete my-feature --project FerdBur/wave
```

### compare

```bash
gitflic branch compare my-feature --project FerdBur/wave
gitflic branch compare my-feature --base master --project FerdBur/wave
# File-level diff между двумя ветками.
```

### Branch protection

```bash
gitflic branch protection list --project FerdBur/wave
gitflic branch protection list --project FerdBur/wave --all

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

## tag

```bash
gitflic tag list --project FerdBur/wave                   # все теги
gitflic tag list --project FerdBur/wave --all
gitflic tag get v1.0.0 --project FerdBur/wave             # ⚠️ может вернуть 400 — см. known-issues
gitflic tag create v1.0.0 --project FerdBur/wave --branch master
gitflic tag create v1.0.0 --project FerdBur/wave --branch master --message "Release"
gitflic tag delete v1.0.0 --project FerdBur/wave
```

> ⚠️ GitFlic API **не предоставляет эндпоинт для удаления тегов через REST**. Команда `tag delete` — no-op с предупреждением. Используйте `git push origin :v1.0.0`.

### Tag protection (team/company scope)

Tag-protection rules живут на уровне team/company, не проекта. Передавайте team/company alias как `--project`:

```bash
gitflic tag protection list --project tikhon                 # для team=tikhon
gitflic tag protection create --project tikhon \
  --tag-template "v*" \
  --allow-to-create ADMINS

gitflic tag protection edit <uuid> --project tikhon \
  --allow-to-create DEVELOPER

gitflic tag protection delete <uuid> --project tikhon
```
