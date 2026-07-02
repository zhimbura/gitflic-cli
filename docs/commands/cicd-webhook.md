---
description: "Команды gitflic для CI/CD GitFlic: пайплайны, джобы, артефакты, переменные, environments, вебхуки проекта и runners (агенты)."
---

# CI/CD, вебхуки, environments, runners

## cicd

Команды CI/CD: пайплайны, джобы, артефакты, переменные и время хранения пайплайнов. Project-scoped команды требуют `--project owner/alias` (или git origin).

### Пайплайны

```bash
gitflic cicd pipeline list --project FerdBur/wave              # список пайплайнов
gitflic cicd pipeline list --project FerdBur/wave --all        # все страницы
gitflic cicd pipeline <id> --project FerdBur/wave              # детали (см. known-issues)

# Запуск пайплайна по ветке или тегу
gitflic cicd pipeline start --project FerdBur/wave --ref feature/x
gitflic cicd pipeline start --project FerdBur/wave --ref v1.0.0 --tag

# С переменными (флаг --var повторяемый)
gitflic cicd pipeline start --project FerdBur/wave --ref main \
  --var DEPLOY_ENV=staging --var DEBUG=true

# Жизненный цикл
gitflic cicd pipeline restart <localId> --project FerdBur/wave
gitflic cicd pipeline cancel  <localId> --project FerdBur/wave
gitflic cicd pipeline delete  <localId> --project FerdBur/wave
```

### Артефакты пайплайна

```bash
gitflic cicd pipeline artifacts <localId> --project FerdBur/wave           # список артефактов
gitflic cicd pipeline artifacts <localId> --project FerdBur/wave --all
gitflic cicd pipeline artifacts-download <localId> --project FerdBur/wave \
  --out pipeline-artifacts.zip                                             # скачать архив
```

### Джобы

```bash
gitflic cicd jobs <pipelineId> --project FerdBur/wave          # джобы пайплайна
gitflic cicd jobs <pipelineId> --project FerdBur/wave --all
gitflic cicd job get <localId> --project FerdBur/wave          # одна джоба

gitflic cicd job restart <localId> --project FerdBur/wave
gitflic cicd job cancel  <localId> --project FerdBur/wave
```

### Артефакты джобы

```bash
gitflic cicd job artifacts <localId> --project FerdBur/wave --all          # список
gitflic cicd job artifacts-download <localId> --project FerdBur/wave \
  --out job-artifacts.zip                                                  # все артефакты архивом
gitflic cicd job artifact-download <localId> <artifactUuid> --project FerdBur/wave \
  --out artifact.bin                                                       # один артефакт

gitflic cicd job artifact-lock   <localId> <artifactUuid> --project FerdBur/wave
gitflic cicd job artifact-unlock <localId> <artifactUuid> --project FerdBur/wave
gitflic cicd job delete-artifact <localId> <artifactUuid> --project FerdBur/wave
```

### Переменные CI/CD

По умолчанию — переменные уровня проекта. Для company/team-уровня — `--scope`, для инстанса — `--scope admin` (нужны права администратора).

```bash
gitflic cicd variable --project FerdBur/wave                                    # переменные проекта
gitflic cicd variable --scope team --team tikhon --format json                  # переменные команды
gitflic cicd variable --scope company --company acme                            # переменные компании
gitflic cicd variable --scope admin                                            # инстанс (admin-only)
```

### Время хранения пайплайнов (pipeline-lifetime)

Настраивается на уровне company/team (нужен `--team/--company <alias>` или `--scope`).

```bash
gitflic cicd pipeline-lifetime get --team tikhon --format json
gitflic cicd pipeline-lifetime edit --team tikhon --lifetime 30 --enabled true
gitflic cicd pipeline-lifetime apply-settings-to-projects --team tikhon         # применить ко всем проектам scope
```

> `cicd pipeline <id>` на публичном `api.gitflic.ru` может вернуть 404 — поведение GitFlic, см. known-issues. Используйте `cicd pipeline list`.

## runner

Раннеры (CI/CD-агенты). Область задаётся флагом `--scope project|company|instance`:

- `--scope project` (по умолчанию) — раннеры проекта (резолвится по `--project owner/alias` или git origin)
- `--scope company --company <alias>` — раннеры компании
- `--scope instance` — раннеры всего сервиса через `/admin/runners` (нужны права администратора инстанса)

```bash
gitflic runner list --project FerdBur/wave --all              # раннеры в scope
gitflic runner list --scope company --company acme --format json
gitflic runner get <uuid> --project FerdBur/wave             # один раннер

# Джобы раннера (или всех раннеров scope)
gitflic runner jobs --project FerdBur/wave
gitflic runner jobs <uuid> --status RUNNING --project FerdBur/wave

# Регистрация
gitflic runner registration-info --scope company --company acme   # URL + токен регистрации
gitflic runner reset-token --scope instance                       # сброс токена (instance, admin)

# Управление
gitflic runner edit <uuid> --project FerdBur/wave \
  --name build-01 --active true --tags linux,docker \
  --run-untagged false --max-timeout 3600 --locked false --protected true
gitflic runner shutdown <uuid> --project FerdBur/wave
gitflic runner delete   <uuid> --project FerdBur/wave
```

> `--scope instance` (и `reset-token`) требуют прав администратора инстанса — обычный токен получит 403/404. Реализовано по спеке, протестировать на публичном SaaS нельзя.

## webhook

Вебхуки проекта (требуют `--project owner/alias`).

```bash
gitflic webhook list --project FerdBur/wave
gitflic webhook get <uuid> --project FerdBur/wave

# Создание (по умолчанию включены все события)
gitflic webhook create --project FerdBur/wave \
  --url https://example.com/hook \
  --secret s3cr3t \
  --event PUSH --event MERGE_REQUEST_CREATE --event MERGE

gitflic webhook update <uuid> --project FerdBur/wave \
  --url https://example.com/hook2 --event PIPELINE_FAIL   # незаданные поля сохраняются

gitflic webhook delete <uuid> --project FerdBur/wave
```

События: `COLLABORATOR_ADD`, `COLLABORATOR_DELETE`, `COLLABORATOR_UPDATE`, `ISSUE_UPDATE`, `ISSUE_CREATE`, `NEW_ISSUE_NOTE`, `TAG_DELETE`, `TAG_CREATE`, `BRANCH_UPDATE`, `BRANCH_DELETE`, `BRANCH_CREATE`, `MERGE_REQUEST_CREATE`, `MERGE_REQUEST_UPDATE`, `MERGE`, `MERGE_REQUEST_CLOSE`, `MERGE_REQUEST_CANCEL`, `MERGE_REQUEST_ACCEPT`, `DISCUSSION_CREATE`, `DISCUSSION_COMMENT_CREATE`, `PIPELINE_NEW`, `PIPELINE_SUCCESS`, `PIPELINE_FAIL`, `WEBHOOK_SEND`.

## environment

Environment protection rules — на уровне team/company, не проекта.

```bash
gitflic environment protection list --project tikhon         # project тут = team alias
gitflic environment protection create \
  --project tikhon \
  --template production \
  --allow-to-deploy ADMINS

gitflic environment protection delete <uuid> --project tikhon
```

> Универсального CRUD для environments (создание/удаление как сущности) **нет в публичном REST**. Environments живут как deploy-targets per pipeline job, управляются через Web UI.

## См. также

- [Проекты](project.md)
- [Релизы](release.md)
- [Все команды](/commands/)
