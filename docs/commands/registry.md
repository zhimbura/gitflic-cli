# Реестр пакетов

GitFlic registry поддерживает несколько форматов пакетов (Maven, NPM, PyPI, NuGet, Composer, OPM, CRAN, RubyGem, Cargo, Conda, generic). CLI покрывает полностью: список/просмотр/версии/файлы/удаление пакетов, а также upload/download артефактов для всех форматов.

Команда `registry` — **глобальная**: scope задаётся явно.

## Scope

```bash
# Project-scope (по умолчанию; --project обязателен)
--scope project --project <owner>/<alias>

# Company-scope
--scope company --company <companyAlias>

# Instance-scope (пакеты: "global")
--scope instance
```

## registry package

### list

Список пакетов в выбранном scope.

```bash
gitflic registry package list --project tikhon/wave
gitflic registry package list --scope company --company acme --type maven
gitflic registry package list --scope instance --format json

# Пагинация
gitflic registry package list --project tikhon/wave --page 2 --size 50
```

### get

Один пакет по UUID.

```bash
gitflic registry package get <packageUuid> --project tikhon/wave --format json
```

### versions

Список версий пакета.

```bash
gitflic registry package versions <packageUuid> --project tikhon/wave
gitflic registry package versions <packageUuid> --project tikhon/wave --page 2
```

### version

Одна версия пакета.

```bash
gitflic registry package version <packageUuid> 1.0.0 --project tikhon/wave --format json
```

### files

Файлы пакета (опционально по версии).

```bash
gitflic registry package files <packageUuid> --project tikhon/wave
gitflic registry package files <packageUuid> --version 1.0.0 --project tikhon/wave
```

### delete / delete-version / delete-file

Удаление пакета, версии или файла (через `POST .../delete`).

```bash
gitflic registry package delete <packageUuid> --project tikhon/wave
gitflic registry package delete-version <packageUuid> 1.0.0 --project tikhon/wave
gitflic registry package delete-file <packageUuid> 1.0.0 <fileUuid> --project tikhon/wave
```

### upload

Загрузка артефакта (raw PUT). Формат задаётся флагом `--fmt` (**не** `--format` — он зарезервирован под вывод `json|pretty`). Координаты зависят от формата.

```bash
# Maven: groupId artifactId version [file]
gitflic registry package upload --fmt maven --project tikhon/wave ./app-1.0.jar com.acme app 1.0

# NPM: name version [file]; scope через --npm-scope
gitflic registry package upload --fmt npm --project tikhon/wave ./my-pkg-1.0.tgz my-pkg 1.0

# PyPI / generic: name version [file]
gitflic registry package upload --fmt pypi --project tikhon/wave ./dist.whl mypkg 1.0

# NuGet / RubyGem / Cargo: только файл
gitflic registry package upload --fmt nuget --project tikhon/wave ./pkg.1.0.0.nupkg

# Свой content-type при необходимости
gitflic registry package upload --fmt generic --project tikhon/wave ./blob.bin myblob 1.0 --content-type application/octet-stream
```

Координаты по форматам: `generic/npm/pypi` = `name version [file]`; `maven` = `groupId artifactId version [file]`; `composer` = `version`; `cran` = `languageVersion [file]`; `conda` = `channel [file]`; `opm` = `[file]`; `nuget/rubygem/cargo` = только файл.

> GitFlic валидирует тип файла (allowlist). Архивы (`.zip` и т.п.) проходят, а `.txt`/`.png` могут вернуть HTTP 415 — это серверное ограничение, не баг CLI.

### download

Скачивание артефакта (GET). Формат — через `--fmt`, путь сохранения — `--out`.

```bash
gitflic registry package download --fmt npm --project tikhon/wave my-pkg my-pkg-1.0.tgz --out ./out.tgz
gitflic registry package download --fmt maven --project tikhon/wave <packageUuid> 1.0 <fileUuid> --out ./app.jar
```

Координаты по форматам: `generic/npm/pypi/opm` = `name version file`; `maven` = `packageUuid version fileUuid`; `nuget/rubygem/cargo/composer` = `name version` (`composer` = `groupId artifactId version`); `cran` = `file languageVersion platform`; `conda` = `platform file`.

### composer-tag

Собрать Composer-пакет из git-тега.

```bash
gitflic registry package composer-tag --tag v1.2.0 --project tikhon/wave
```

## registry repo (Enterprise)

> Раздел реестров репозиториев (registry-repository) доступен только в Enterprise/Atlas. На публичном SaaS (`api.gitflic.ru`) команды возвращают 404 — реализованы по спецификации, но работают только в self-hosted инсталляции.

```bash
# Список / получение
gitflic registry repo list --scope instance
gitflic registry repo get <uuid>

# Создание (rt: LOCAL|PROXY|LOCAL_CACHE|VIRTUAL|TRASH_CAN)
gitflic registry repo create --title "npm-local" --repository-type LOCAL --package-type npm --description "internal npm"

# Редактирование / удаление
gitflic registry repo edit <uuid> --title "npm-local-2"
gitflic registry repo delete <uuid>

# Пакеты внутри репозитория
gitflic registry repo packages <uuid> --type npm
gitflic registry repo package <uuid> <packageUuid>
gitflic registry repo package-versions <uuid> <packageUuid>
gitflic registry repo package-version <uuid> <packageUuid> 1.0.0
gitflic registry repo package-files <uuid> <packageUuid> --version 1.0.0
gitflic registry repo delete-package <uuid> <packageUuid>
gitflic registry repo delete-package-version <uuid> <packageUuid> 1.0.0

# Upload/download (формат — через --format, путь узла — --node-path)
gitflic registry repo upload --format maven <uuid> ./app-1.0.jar com.acme app 1.0
gitflic registry repo download --format npm <uuid> my-pkg my-pkg-1.0.tgz --out ./out.tgz
```

## Устаревшие алиасы

Сохранены для обратной совместимости:

```bash
gitflic registry list   # -> alias of 'registry package list'
gitflic registry repos  # -> alias of 'registry repo list --scope instance'
```
