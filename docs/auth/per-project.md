# Per-project account bindings

Привязка `<project> → <account>` говорит CLI: "когда пользователь работает с этим проектом, всегда используй токен этого аккаунта". Полезно, если:

- В разных репозиториях у тебя разные личности (работа vs личное).
- У одного проекта — два владельца (maintainer в work-аккаунте, contributor в personal).
- Ты хочешь автоматический роутинг без `auth switch` перед каждой командой.

## Команды

```bash
gitflic auth bind <project> <account>      # создать привязку
gitflic auth unbind <project>              # удалить
gitflic auth bindings                      # список всех привязок
```

`<project>` — это `owner/alias` (то же, что передаёшь в `--project`).

## Пример

```bash
# Настраиваем 2 аккаунта
gitflic auth login --as work --token work-xxx
gitflic auth login --as personal --token pers-yyy

# Привязываем проекты
gitflic auth bind FerdBur/wave work
gitflic auth bind tikhon/personal personal

gitflic auth bindings
# FerdBur/wave      →  work
# tikhon/personal   →  personal

# Теперь команды автоматически подставляют правильный токен
gitflic mr list --project FerdBur/wave     # → token:work
gitflic mr list --project tikhon/personal # → token:personal

# Команды без --project используют active-account (как раньше)
gitflic auth switch personal
gitflic user me                             # → token:personal (от active)
```

## Как это работает внутри

Привязка хранится в config-файле как `account-bind:FerdBur/wave = work`.

`resolveToken` (в `lib/http.mjs`) делает:

```js
1. --token flag → вернуть
2. GITFLIC_TOKEN env → вернуть
3. Если flags.project задан:
     account-bind:<project> → secretGet(token:<account>) → вернуть
4. token:<active-account> → вернуть
5. token (legacy default) → вернуть
6. die
```

Шаг 3 — это новая проверка, она **перебивает** active-account, когда проект задан.

## Валидация

`auth bind <project> <account>` отказывается, если у `<account>` нет токена:

```
gitflic: auth bind: no token stored for account 'ghost'.
gitflic: run: gitflic auth login --as ghost  first.
```

Это чтобы не плодить мёртвые привязки. Если привязка указывает на аккаунт, токен которого потом удалили, при следующей команде будет warning + fallthrough:

```
gitflic: WARNING — project 'FerdBur/wave' is bound to account 'ghost' but no token is stored for it.
gitflic: run: gitflic auth login --as ghost  (or: gitflic auth unbind FerdBur/wave)
```

(Используется `token:<active-account>` или legacy `token` как fallback.)

## Где живёт привязка

```
~/.config/gitflic-cli/config.json:
{
  "token": "def-xxx",                    // default аккаунт
  "token:work": "work-yyy",
  "token:personal": "pers-zzz",
  "active-account": "default",
  "account-bind:FerdBur/wave": "work",
  "account-bind:tikhon/personal": "personal"
}
```

На macOS все эти `token*` ключи лежат в Keychain, `account-bind:*` и `active-account` — в файле.

## Авто-детект проекта

CLI умеет авто-определять проект из `git remote get-url origin` (если ты внутри git-клона). Это работает и с привязками:

```bash
cd ~/code/FerdBur/wave   # клон с origin = git@gitflic.ru:FerdBur/wave.git
gitflic mr list           # → flags.project = "FerdBur/wave" → binding → token:work
```

Не нужно каждый раз писать `--project`.
