# `cache`

Локальный file-based кеш для project UUID resolution (alias → UUID маппинг стабильно между запросами).

```bash
gitflic cache path                    # путь к файлу кеша
gitflic cache info                    # размер, количество записей, TTL
gitflic cache clear                   # удалить весь кеш
```

## Где лежит

`$XDG_CACHE_HOME/gitflic-cli/cache.json` или `~/.cache/gitflic-cli/cache.json`.

## Когда полезно

По умолчанию CLI кеширует резолв `owner/alias → UUID` на 1 час. Это экономит ~50-200ms на каждый вызов `gitflic mr list` etc.

```bash
# Если проект переименовали / перенесли — сбрось кеш
gitflic cache clear

# Или для одного вызова — отключи кеш
GITFLIC_NO_CACHE=1 gitflic mr list --project x/y
```

## Структура

```json
{
  "project:https://api.gitflic.ru:tikhon/wave": {
    "v": {"id": "abc-123-def", "alias": "wave", ...},
    "e": 1719000000000
  }
}
```

`e` — epoch ms, после которого запись считается протухшей.
