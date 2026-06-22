# Merge Requests (`gitflic mr ...`)

Главный модуль. Покрывает полный жизненный цикл MR: list → view → create → review → approve/merge → close.

## Подкоманды

### list

```bash
gitflic mr list --project FerdBur/wave                 # дефолтные фильтры
gitflic mr list --project FerdBur/wave --all           # авто-пагинация
gitflic mr list --project FerdBur/wave --stream        # NDJSON
gitflic mr list --project FerdBur/wave --tui           # интерактивный браузер
gitflic mr list --project FerdBur/wave --size 50      # 50 на страницу
gitflic mr list --project FerdBur/wave --format json   # JSON для jq
```

Параметры пагинации: `--page`, `--size`. Без `--all` показывает только первую страницу (default 20 элементов).

### view

```bash
gitflic mr view 42 --project FerdBur/wave
# Полная JSON-карточка MR: title, description, source/target branches,
# author, reviewers, labels, статус, даты.
```

### diff

```bash
gitflic mr diff 42 --project FerdBur/wave
# File-level diff: список файлов с добавленными/удалёнными строками.
```

### by-commit

```bash
gitflic mr by-commit abc1234 --project FerdBur/wave
# Найти MR, содержащие данный commit hash.
```

### create

```bash
gitflic mr create --project FerdBur/wave \
  --title "Fix login bug" \
  --description "Fixes #123" \
  --to main
# source-ветка = текущая ветка (или --from <branch> если указана явно)
```

Флаги:
- `--title <text>` — заголовок (обязательный)
- `--description <text>` — описание (опционально)
- `--to <branch>` — целевая ветка (default = default branch проекта)
- `--from <branch>` — source-ветка (default = текущая)
- `--squash` — squash commits при merge
- `--no-remove-branch` — НЕ удалять source-ветку после merge

### edit

```bash
gitflic mr edit 42 --project FerdBur/wave --title "New title"
gitflic mr edit 42 --project FerdBur/wave --description "..."
gitflic mr edit 42 --project FerdBur/wave --to develop   # сменить target
# Source-ветку менять нельзя (ограничение GitFlic API).
```

### approve

```bash
gitflic mr approve 42 --project FerdBur/wave
# Toggle approve: если уже аппрувнул — снимает.
```

### merge

```bash
gitflic mr merge 42 --project FerdBur/wave
gitflic mr merge 42 --project FerdBur/wave --message "Squash: fix login"
gitflic mr merge 42 --project FerdBur/wave --squash-message "single commit msg"
```

### close / cancel

```bash
gitflic mr close 42 --project FerdBur/wave
gitflic mr cancel 42 --project FerdBur/wave
```

### comment

```bash
# Обычный комментарий (общий к MR)
gitflic mr comment 42 --project FerdBur/wave "Please rebase"

# Inline-комментарий (привязан к строке в файле)
gitflic mr comment 42 --project FerdBur/wave "Why this? " \
  --new-path src/login.ts --new-line 42

# Diff-side (старый или новый)
gitflic mr comment 42 --project FerdBur/wave "Fix this" \
  --old-path src/old.ts --old-line 10 --new-path src/new.ts --new-line 12
```

### discuss (обсуждения / threaded comments)

```bash
gitflic mr discuss list 42 --project FerdBur/wave
gitflic mr discuss reply 42 <discussionUuid> "My reply" --project FerdBur/wave
gitflic mr discuss resolve 42 <discussionUuid> --project FerdBur/wave
gitflic mr discuss delete 42 <discussionUuid> --project FerdBur/wave
```

## TUI mode

```bash
gitflic mr list --tui --project FerdBur/wave
```

Запускается только в TTY. Если stdin/stdout не TTY — fallback на plain list + warning.

Клавиши:

| Клавиша | Действие |
|---|---|
| `j` / `↓` | следующий MR |
| `k` / `↑` | предыдущий MR |
| `g` | первый |
| `G` | последний |
| `Enter` | напечатать `localId` в stdout (для пайпа: `gitflic mr list --tui \| xargs -I{} gitflic mr view {}`) |
| `q` / `Esc` | выход |

## Примеры пайплайнов

### Список открытых MR с автором

```bash
gitflic mr list --project FerdBur/wave --all --format json \
  | jq -r '.["merge-request-model-list"]? // ._embedded.mergeRequestModelList? // .[]
          | select(.status.id == "OPENED")
          | "#\(.localId) [\(.author.alias // "?")] \(.title)"'
```

### Закрыть все MR старше 30 дней

```bash
gitflic mr list --project FerdBur/wave --all --format json \
  | jq -r '.[] | select(.status.id == "OPENED") | select(.updatedAt < (now - 2592000 | todate)) | .localId' \
  | xargs -I{} gitflic mr close {} --project FerdBur/wave
```

### Approve все MR где я ревьюер

```bash
gitflic mr list --project FerdBur/wave --all --format json \
  | jq -r '.[] | select(.reviewers[]?.alias == "tikhon") | select(.approved == false) | .localId' \
  | xargs -I{} gitflic mr approve {} --project FerdBur/wave
```

## Известные ограничения

- `mr merge` на свежем проекте может упасть с `MergeCheckException`, если default branch protection требует approve от не-автора. Это поведение GitFlic, не баг CLI.
- `tag get <name>` ломается для некоторых имён (см. [known-issues.md](../known-issues.md)).
- Per-MR настройки (approval rules, merge templates) — НЕ покрыты. Используйте `gitflic project settings mr` (если добавим — отдельная фича).
