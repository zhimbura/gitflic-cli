# Пользователи, команды, компании

## user

```bash
gitflic user me                                           # текущий юзер (с email)
gitflic user search --q "tikhon"                          # поиск
gitflic user search --q "tikhon" --page 2 --size 50
gitflic user get tikhon                                   # по alias
gitflic user projects tikhon                              # публичные проекты юзера
gitflic user followers tikhon                             # кто на него подписан
gitflic user following tikhon                             # на кого он подписан
```

## team

```bash
gitflic team list                                          # все доступные команды
gitflic team list --q "core"
gitflic team get backend-team                              # по alias
gitflic team create --alias core --name "Core Team" --private
gitflic team edit core --name "Core Engineering"
gitflic team delete core
gitflic team members core                                  # участники команды
```

## company

```bash
gitflic company list --q "acme"
gitflic company get acme                                   # по alias
```

> ⚠️ Создание/изменение/удаление компаний — только через Web UI. Нет публичного REST-эндпоинта.
