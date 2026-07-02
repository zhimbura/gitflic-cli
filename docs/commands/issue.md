---
description: "Команды gitflic issue для задач GitFlic: полный CRUD, комментарии, связи (relations), работа с файлами и загрузка вложений из консоли."
---

# Задачи (`gitflic issue ...`)

Полный CRUD + комментарии + связи (relations) + работа с файлами + загрузка вложений.

## Подкоманды

```bash
gitflic issue list --project FerdBur/wave                          # все
gitflic issue list --project FerdBur/wave --status OPEN             # фильтр по статусу
gitflic issue list --project FerdBur/wave --all --format json      # с автопагинацией
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
  --assign-to <userUuid> \
  --label <labelUuid>
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

### Комментарии

```bash
gitflic issue comments list <localId> --project FerdBur/wave
gitflic issue comments add <localId> "Comment text" --project FerdBur/wave
gitflic issue comments edit <localId> <noteUuid> "New text" --project FerdBur/wave
gitflic issue comments delete <localId> <noteUuid> --project FerdBur/wave
```

### Связи (relations)

Связи между задачами (зависимости, блокировки, «связано с» и т.п.). Поддерживается полный CRUD.

```bash
gitflic issue relations list <localId> --project FerdBur/wave

# Создать связь с другой задачей (по её UUID)
gitflic issue relations create <localId> <targetIssueUuid> RELATED --project FerdBur/wave
# Типы: RELATED, AFFECTS_FORWARD, DEPENDENCY_FORWARD, ... (см. документацию GitFlic)

# Удалить связь
gitflic issue relations delete <localId> <targetIssueUuid> --project FerdBur/wave
```

### Файлы

Просмотр и управление файлами, прикреплёнными к задаче. `link`/`unlink` оперируют уже загруженными в проект файлами по их UUID.

```bash
gitflic issue files list <localId> --project FerdBur/wave --format json

# Привязать уже загруженный файл проекта к задаче
gitflic issue files link <localId> <uploadFileUuid> --project FerdBur/wave

# Отвязать (и удалить) файл от задачи
gitflic issue files unlink <localId> <uploadFileUuid> --project FerdBur/wave
```

### Загрузка вложений

`issue attach` — основной способ: загружает файл в проект и сразу привязывает его к задаче (upload + link одним вызовом).

```bash
gitflic issue attach <localId> ./screenshot.png --project FerdBur/wave
gitflic issue attach <localId> ./logs.txt --name debug-logs.txt --project FerdBur/wave
```

Команда `issue attachment upload` оставлена как legacy-вариант (одиночный best-guess endpoint); для новых сценариев используйте `issue attach`.

```bash
gitflic issue attachment upload <localId> ./screenshot.png --project FerdBur/wave
```

## Пайплайн: triage

```bash
# Все открытые без assignee
gitflic issue list --project FerdBur/wave --status OPEN --all --format json \
  | jq -r '.[] | select(.assignee == null) | "#\(.localId) \(.title)"'
```

## См. также

- [Merge Requests](mr.md)
- [Пользователи и команды](user-team.md)
- [Все команды](/commands/)
