---
description: "Команды gitflic user, team и company: профиль и поиск пользователей GitFlic, управление командами и просмотр компаний. Пагинация и --format json."
---

# Пользователи, команды, компании

Все list-команды поддерживают `--page N`, `--size N`, `--all`, `--stream` и `--format json`.

## user

Команды для работы с пользователями (проект не требуется).

```bash
gitflic user me                                           # текущий юзер (с email)
gitflic user me --format json
gitflic user search --q "tikhon"                          # поиск (с пагинацией)
gitflic user search --q "tikhon" --page 2 --size 50
gitflic user get tikhon                                   # по alias
gitflic user projects tikhon                              # публичные проекты юзера
gitflic user projects tikhon --page 1 --size 50 --format json
gitflic user followers tikhon                             # кто на него подписан
gitflic user following tikhon                             # на кого он подписан
```

## team

Команды для работы с командами. Владелец создаваемой команды по умолчанию — вы; при желании можно указать другого владельца через `--owner`/`--owner-type`.

```bash
gitflic team list                                         # публичные команды
gitflic team list --q "core" --page 1 --size 50
gitflic team my                                           # команды, в которых вы состоите
gitflic team shared                                       # команды, расшаренные вам
gitflic team get backend-team                             # одна команда по alias

# создание (owner по умолчанию — вы)
gitflic team create --alias core --title "Core Team" --private
gitflic team create --alias core --title "Core Team" \
  --description "Ядро" --owner acme --owner-type COMPANY

# передача владения (замена отсутствующего edit/delete)
gitflic team transfer --team core --owner newowner
```

### team member

```bash
gitflic team member list core                                          # участники
gitflic team member list core --q "tikhon" --format json
gitflic team member invite core tikhon --role DEVELOPER                # пригласить
gitflic team member role core tikhon --role ADMIN                      # сменить роль
gitflic team member remove core tikhon                                 # удалить участника
```

Роли: `GUEST`, `REPORTER`, `DEVELOPER`, `ADMIN`.

### team import

Управление тем, какие настройки-шаблоны (защита веток, окружения, теги и т.п.) импортируются в дочерние проекты команды.

```bash
gitflic team import get core                              # текущее состояние импорта
gitflic team import set core --branch --environment --tag --mr-approval --pipeline-lifetime
```

> ⚠️ В GitFlic REST нет эндпоинтов `team edit` и `team delete` (PUT/DELETE → 405) — переименование/удаление только через Web UI. Для смены владельца используйте `team transfer`.

## company

Команды для работы с компаниями.

```bash
gitflic company list                                     # публичные компании
gitflic company list --q "acme"
gitflic company my                                       # компании активного пользователя
gitflic company shared                                   # компании, где вы участвуете
gitflic company get acme                                 # одна компания по alias
gitflic company create --title "Acme" --alias acme --private --description "Acme Inc."
```

### company member

```bash
gitflic company member list acme                                       # участники
gitflic company member list acme --q "tikhon" --format json
gitflic company member invite acme tikhon DEVELOPER                    # добавить
gitflic company member role acme tikhon ADMIN                         # сменить роль
gitflic company member remove acme tikhon                             # удалить участника
```

Роли: `GUEST`, `REPORTER`, `DEVELOPER`, `ADMIN`.

### company import

```bash
gitflic company import get acme                           # состояние настроек-импорта
gitflic company import run acme --branch --environment --tag --mr-approval --pipeline-lifetime
```

> ⚠️ В GitFlic REST нет эндпоинтов `company edit` и `company delete` (PUT/DELETE → 405) — изменение/удаление компаний только через Web UI.

## См. также

- [Проекты](project.md)
- [Настройки пользователя](settings.md)
- [Все команды](/commands/)
