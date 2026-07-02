---
description: "Команда gitflic alias — persistent user-конфиг CLI: default-project, api-base и другие ключи (всё, что не токен). Хранится с chmod 0600."
---

# `alias`

Persistent key-value конфиг. Управляет тем, что **не является токеном** — `default-project`, `api-base`, и т.п.

> Для токенов и привязок используй [`auth`](/auth/) — отдельная подсистема с keychain-бэкендом и маскированием.

## Подкоманды

```bash
gitflic alias set default-project tikhon/wave       # сохранить
gitflic alias get default-project                  # прочитать
gitflic alias unset default-project                # удалить
gitflic alias list                                  # все ключи
gitflic alias path                                  # путь к config-файлу
gitflic alias clear                                 # удалить весь config
```

## Известные ключи

| Ключ | Что делает |
|---|---|
| `default-project` | Авто-подставляется в `--project` если не указан и git-remote не дал авто-детект |
| `api-base` | API endpoint (если не задан `GITFLIC_API_BASE` и не передан `--api-base`) |
| `token` | **DEPRECATED для прямого использования** — ставь через `gitflic auth login` |

## Где лежит

`$XDG_CONFIG_HOME/gitflic-cli/config.json` или `~/.config/gitflic-cli/config.json`.

Режим файла — `chmod 0600`, директория — `chmod 0700` (защита от случайной утечки при permissive umask).

## Отключить

`GITFLIC_NO_CONFIG=1` — игнорировать config-файл (полезно для CI, чтобы не подхватить токен из девелоперской машины).

## Маскирование

`alias list` маскирует sensitive ключи (`token`, `*password*`, `*secret*`, `*api-key*`, `*private-key*`):

```
default-project = tikhon/wave
token = def***xxx          (token backend: keychain)
```

`alias get token` тоже маскирует по умолчанию + выводит hint про `--reveal`.
