---
description: "Команды gitflic mr для merge-реквестов GitFlic: цикл list → view → diff → create → approve/merge → close, комментарии, дискуссии и TUI-браузер."
---

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
gitflic mr discuss get 42 <discussionUuid> --project FerdBur/wave        # один тред целиком
gitflic mr discuss reply 42 <discussionUuid> "My reply" --project FerdBur/wave
gitflic mr discuss resolve 42 <discussionUuid> --project FerdBur/wave
gitflic mr discuss delete 42 <discussionUuid> --project FerdBur/wave
```

## Настройки MR (company / team)

Эти подкоманды управляют политиками MR на уровне **компании или команды** (approval-правила, конфигурация аппрувов, squash, метод merge, шаблон описания). Требуется указать scope:

- напрямую: `--company <alias>` или `--team <alias>`;
- либо `--scope company|team` вместе с `--project owner/alias` (контекст проекта всё равно должен резолвиться).

### approval rule (правила аппрува)

```bash
gitflic mr approval rule list --scope team --team backend --format json
gitflic mr approval rule get <uuid> --scope team --team backend

gitflic mr approval rule create --scope team --team backend \
  --name "main protection" --target-branch main \
  --minimal-approvals 2 --approvers tikhon,alice

gitflic mr approval rule edit --uuid <uuid> --scope team --team backend \
  --minimal-approvals 1

gitflic mr approval rule delete <uuid> --scope team --team backend
```

### approval configuration (общая конфигурация аппрувов)

```bash
gitflic mr approval configuration get --company acme --format json

gitflic mr approval configuration edit --company acme \
  --minimal-approvals 2 \
  --reset-approvals-on-push true \
  --require-all-discussions-resolved true \
  --author-can-approve false

# Полный контроль над телом запроса:
gitflic mr approval configuration edit --company acme --json '{"minimalApprovals":3}'
```

### settings (squash / merge-method / template)

```bash
gitflic mr settings squash --team backend                       # текущее значение
gitflic mr settings squash-edit --team backend --enabled true

gitflic mr settings method-type --company acme                  # текущий метод merge
gitflic mr settings method-type-edit --company acme --type SQUASH

gitflic mr settings template --team backend                     # шаблон описания MR
gitflic mr settings template-edit --team backend \
  --template "## Что изменилось\n\n## Как проверить"
```

Все `*-edit` подкоманды дополнительно принимают `--json '<obj>'` для полного контроля над телом запроса.

### apply-settings

```bash
gitflic mr apply-settings --company acme
# Применить настройки MR компании/команды ко всем её проектам.
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
- Source-ветку существующего MR менять нельзя (`mr edit` принимает только `--to`, не `--from`) — ограничение GitFlic API.

## См. также

- [Задачи](issue.md)
- [Ветки и теги](branch-tag.md)
- [Все команды](/commands/)
