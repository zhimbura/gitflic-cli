# Задачи (`gitflic issue ...`)

Полный CRUD + комментарии + relations + attachment upload.

## Подкоманды

```bash
gitflic issue list --project FerdBur/wave                          # все
gitflic issue list --project FerdBur/wave --status OPEN             # фильтр по статусу
gitflic issue list --project FerdBur/wave --all --format json      # с пагинацией
gitflic issue view <localId> --project FerdBur/wave                # детали
```

### create

```bash
gitflic issue create --project FerdBur/wave \
  --title "Bug: login broken" \
  --description "Steps to reproduce..."

# С опциональными полями
gitflic issue create --project FerdBur/wave \
  --title "Feature: dark mode" \
  --description "..." \
  --assign-to <userUuid> \
  --label <labelUuid> \
  --status OPEN       # OPEN | IN_PROGRESS | CLOSED | COMPLETED
```

### edit

```bash
gitflic issue edit <localId> --project FerdBur/wave \
  --title "New title" \
  --description "..." \
  --status IN_PROGRESS \
  --assign-to <userUuid>
```

### close / reopen

```bash
gitflic issue close <localId> --project FerdBur/wave     # shortcut: edit --status CLOSED
gitflic issue reopen <localId> --project FerdBur/wave    # shortcut: edit --status OPEN
```

### delete

```bash
gitflic issue delete <localId> --project FerdBur/wave
```

### Comments

```bash
gitflic issue comments list <localId> --project FerdBur/wave
gitflic issue comments add <localId> "Comment text" --project FerdBur/wave
gitflic issue comments edit <localId> <noteUuid> "New text" --project FerdBur/wave
gitflic issue comments delete <localId> <noteUuid> --project FerdBur/wave
```

### Relations

```bash
gitflic issue relations list <localId> --project FerdBur/wave
# Связи между issue (blocks, relates-to, etc). Создание/edit — нет публичного API.
```

### Attachment upload

```bash
gitflic issue attachment upload <localId> ./screenshot.png --project FerdBur/wave
gitflic issue attachment upload <localId> ./logs.txt --name debug-logs.txt --project FerdBur/wave
```

Multipart upload, аналогично release asset.

## Пайплайн: triage

```bash
# Все открытые без assignee
gitflic issue list --project FerdBur/wave --status OPEN --all --format json \
  | jq -r '.[] | select(.assignee == null) | "#\(.localId) \(.title)"'
```
