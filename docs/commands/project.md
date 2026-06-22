# Проекты

```bash
gitflic project list                                      # все доступные
gitflic project list --scope my                           # только мои
gitflic project list --scope shared                       # расшаренные мне
gitflic project list --scope public --q "wave"            # поиск по публичным
gitflic project get tikhon/gitflic-cli                    # детали (alias или UUID)
```

`project list` поддерживает фильтры и пагинацию: `--q <query>`, `--q-name <N>`, `--q-owner <O>`, `--page N`, `--size N`, `--all` (выгрузить все страницы).

```bash
# Поиск по имени и владельцу, JSON для агентов
gitflic project list --scope public --q-name wave --q-owner FerdBur --format json
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

# Создание под командой/компанией:
gitflic project create --alias team-proj --title "Team Project" \
  --owner-alias my-team --owner-alias-type TEAM

# edit (PUT /project)
gitflic project edit tikhon/my-project \
  --title "New title" \
  --default-branch develop \
  --public

# delete
gitflic project delete tikhon/my-project
```

### Настройки проекта

`change-setting` обновляет настройки проекта (заголовок, описание, язык, темы) через `PUT .../setting/change-setting`:

```bash
gitflic project change-setting --project tikhon/wave \
  --title "Wave" \
  --description "Новое описание" \
  --language Go \
  --topics cli,api,gitflic
```

### Где можно создавать проекты

```bash
# Список владельцев (вы + ваши команды/компании), под которыми можно создать проект
gitflic project allowed-owners --format json
```

### Размер хранилища

```bash
# Разбивка по размеру (по умолчанию — текущий --project)
gitflic project project-size tikhon/wave
gitflic project project-size --format json
```

## Members

```bash
gitflic project member list --project tikhon/wave
gitflic project member invite user-alias --project tikhon/wave --role DEVELOPER
gitflic project member role user-alias --project tikhon/wave --role ADMIN
gitflic project member delete user-alias --project tikhon/wave
# Роли: GUEST | REPORTER | DEVELOPER | ADMIN | OWNER
```

## Teams

```bash
gitflic project team invite team-alias --project tikhon/wave --role DEVELOPER
gitflic project team role team-alias --project tikhon/wave --role ADMIN
gitflic project team delete team-alias --project tikhon/wave
# Роли для команд: GUEST | REPORTER | DEVELOPER | ADMIN
```

## Archive / files / attachments / social

```bash
# Список файлов в дереве репозитория
gitflic project files --project tikhon/wave --path src --branch master

# Followers / stars / forks
gitflic project followers --project tikhon/wave
gitflic project stars --project tikhon/wave
gitflic project forked --project tikhon/wave
```

### Вложения (attachments)

```bash
# Список прикреплённых файлов
gitflic project upload-files --project tikhon/wave

# Загрузить файл (multipart, до 10 МБ)
gitflic project upload ./screenshot.zip --project tikhon/wave

# Удалить вложение по UUID
gitflic project delete-file <uploadFileUuid> --project tikhon/wave
```

> **Архив проекта.** `gitflic project archive [branch] [--out FILE]` реализован
> (`GET .../file/getArchive`), но на публичном `api.gitflic.ru` эндпоинт возвращает
> **404** — скачивание архива отключено (доступно только через веб-интерфейс).
> Используйте `git clone`.

## Fork / mirror / import

```bash
# Fork (POST .../create-fork) — форк под текущим юзером или другим владельцем
gitflic project fork --project FerdBur/wave --new-alias my-fork
gitflic project fork --project FerdBur/wave --new-alias team-fork \
  --owner-alias my-team --private

# Создать новый mirror-проект (без --project)
gitflic project create-mirror \
  --url https://github.com/foo/bar.git \
  --alias my-mirror \
  --type PULL \
  --login my-login --token-secret <secret> \
  --ref-spec "+refs/heads/*:refs/heads/*"
# type: PULL | PUSH

# Превратить существующий проект в PUSH-зеркало
gitflic project to-push-mirror --project tikhon/wave \
  --source https://github.com/foo/bar.git \
  --login my-login --token-secret <secret>

# Принудительно синхронизировать зеркало
gitflic project manual-update --project tikhon/my-mirror

# Import (импорт из external repo, без --project)
gitflic project import \
  --url https://github.com/foo/bar.git \
  --new-alias imported \
  --private
```

## Scripts

```bash
# Запустить скрипт проекта по UUID
gitflic project run-script <scriptUuid> --project tikhon/wave
```

## Deploy tokens

```bash
gitflic project deploy-token create --project tikhon/wave \
  --name "CI deploy" \
  --scope REPOSITORY_READ \
  --expires 2026-12-31T00:00:00Z
# Скоупы: REPOSITORY_READ | REPOSITORY_WRITE
# Для HTTPS push без пароля (вместо SSH).
```

> **HTTPS push с токеном** работает напрямую:
> `git push https://oauth2:<TOKEN>@gitflic.ru/project/<owner>/<alias>.git <branch>`

## Команды/компании как владельцы

Многие операции принимают владельца через `--owner-alias` (+ `--owner-alias-type USER|TEAM|COMPANY` для `create`):

```bash
gitflic project create --alias x --title "X" --owner-alias acme --owner-alias-type COMPANY
gitflic project fork --project FerdBur/wave --new-alias x --owner-alias acme
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
