# Проекты

```bash
gitflic project list                                      # все доступные
gitflic project list --scope my                           # только мои
gitflic project list --scope public --q "wave"            # поиск
gitflic project get tikhon/gitflic-cli                    # детали
```

## CRUD

```bash
# create
gitflic project create \
  --alias my-project \
  --title "My Project" \
  --private \
  --language "JavaScript" \
  --description "..."

# edit
gitflic project edit tikhon/my-project \
  --title "New title" \
  --default-branch develop

# delete
gitflic project delete tikhon/my-project
```

## Members

```bash
gitflic project member list --project tikhon/wave
gitflic project member invite user-alias --project tikhon/wave --role DEVELOPER
gitflic project member role user-alias --project tikhon/wave --role MAINTAINER
gitflic project member delete user-alias --project tikhon/wave
# Роли: GUEST | REPORTER | DEVELOPER | MAINTAINER | OWNER
```

## Teams

```bash
gitflic project team invite team-alias --project tikhon/wave --role DEVELOPER
gitflic project team delete team-alias --project tikhon/wave
```

## Archive / files / social

```bash
# Скачать архив
gitflic project archive master --project tikhon/wave > /tmp/wave.tar.gz

# Список файлов
gitflic project files --project tikhon/wave --path src

# Followers / stars
gitflic project followers --project tikhon/wave
gitflic project stars --project tikhon/wave
```

## Fork / mirror / import

```bash
# Fork
gitflic project fork --project FerdBur/wave --new-alias my-fork
# Создаёт форк под текущим юзером.

# Mirror (зеркало из другого git)
gitflic project mirror --url https://github.com/foo/bar.git --type PULL --new-alias my-mirror
# type: PULL | PUSH

# Import (импорт из external repo)
gitflic project import \
  --url https://github.com/foo/bar.git \
  --new-alias imported \
  --private
```

## Deploy tokens

```bash
gitflic project deploy-token create --project tikhon/wave \
  --name "CI deploy" \
  --scope READ_REPO
# Для HTTPS push без пароля (вместо SSH).
```

## Авто-детект проекта

`gitflic` без `--project` пытается определить проект из `git remote get-url origin`:

```bash
cd ~/code/FerdBur/wave      # клонированный репо
git remote -v                # origin = git@gitflic.ru:FerdBur/wave.git
gitflic mr list              # → flags.project = "FerdBur/wave" (автоматически)
```

Если авто-детект не сработал — `default-project` config:

```bash
gitflic alias set default-project tikhon/gitflic-cli
cd ~/anywhere
gitflic mr list              # → использует tikhon/gitflic-cli как fallback
```
