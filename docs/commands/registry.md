# Реестр пакетов

GitFlic registry поддерживает несколько типов пакетов (Maven, NPM, PyPI, Docker, ...). CLI покрывает только базовый list — глубокая работа с registry (push, install) пока через git+SSH.

## list

```bash
# Instance-scope (все пакеты на инстансе)
gitflic registry list

# Company-scope
gitflic registry list --scope company --project acme

# Project-scope (пакеты конкретного проекта)
gitflic registry list --scope project --project tikhon/wave

# Фильтр по типу
gitflic registry list --type NPM
gitflic registry list --type MAVEN --scope company --project acme

# С пагинацией
gitflic registry list --scope project --project tikhon/wave --page 2 --size 50
```

## repos (реестр репозиториев)

```bash
gitflic registry repos
# Список реестров (instance-level).
```

## Что НЕ реализовано

- ❌ Push пакетов — нет стабильного API, и push обычно делается через git remote или специализированный CLI (`npm publish` с auth в `.npmrc`).
- ❌ Детальный view пакета (versions, downloads) — нет полного API.
- ❌ Управление retention policies — Web UI.

Если нужно — issue/PR с конкретным use-case.
