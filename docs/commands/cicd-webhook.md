# CI/CD, вебхуки, environments, runners

## cicd

```bash
gitflic cicd pipeline list --project FerdBur/wave           # список пайплайнов
gitflic cicd pipeline <id> --project FerdBur/wave           # детали пайплайна
gitflic cicd pipeline start --project FerdBur/wave --ref feature/x   # запустить
gitflic cicd pipeline start --project FerdBur/wave --tag v1.0.0
gitflic cicd jobs <pipelineId> --project FerdBur/wave       # джобы в пайплайне
```

> Артефакты и per-job операции — НЕ покрыты. Если нужны — issue/PR.

## runner

```bash
gitflic runner list                          # все CI/CD runners (агенты)
gitflic runner get <id>                      # детали конкретного
```

## webhook

```bash
gitflic webhook list --project FerdBur/wave
gitflic webhook get <uuid> --project FerdBur/wave

gitflic webhook create --project FerdBur/wave \
  --url https://example.com/hook \
  --event PUSH                              # default events: push

# Несколько событий
gitflic webhook create --project FerdBur/wave \
  --url https://example.com/hook \
  --event PUSH --event MR_CREATED --event MR_MERGED \
  --active true

gitflic webhook delete <uuid> --project FerdBur/wave
```

События: `PUSH`, `MR_CREATED`, `MR_MERGED`, `MR_CLOSED`, `TAG_CREATED`, `RELEASE_CREATED`, etc. Полный список — см. [docs.gitflic.ru](https://docs.gitflic.ru/latest/api/).

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
