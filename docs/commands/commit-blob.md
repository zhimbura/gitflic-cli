# Коммиты и файлы

## commit

Команды коммитов требуют `--project owner/alias`.

### list / commits (список коммитов)

```bash
gitflic commit list --project FerdBur/wave                          # коммиты default branch
gitflic commit list --project FerdBur/wave --branch feature/x        # другой ветки
gitflic commit list --project FerdBur/wave --page 0 --size 100
```

`commits` — тот же список, но через эндпоинт `/commits` (альтернативная пагинация):

```bash
gitflic commit commits --project FerdBur/wave --branch master --format json
```

### get (один коммит)

```bash
gitflic commit get abc1234 --project FerdBur/wave
```

### files (файлы в коммите)

```bash
gitflic commit files abc1234 --project FerdBur/wave
# Список файлов, которых коснулся коммит.
```

### diff (один файл)

```bash
gitflic commit diff abc1234 src/auth/login.ts --project FerdBur/wave
# Diff для конкретного файла в коммите.
```

### for-file (последний коммит файла)

```bash
gitflic commit for-file abc1234 src/auth/login.ts --project FerdBur/wave
# Последний коммит, затронувший указанный файл.
```

### compare (два коммита)

```bash
gitflic commit compare abc1234 def5678 --project FerdBur/wave
gitflic commit compare abc1234 def5678 --project FerdBur/wave --ignore-collapsed
# Сравнение двух коммитов (commit/diff).
```

### tag-diff (два тега)

```bash
gitflic commit tag-diff v1.0.0 v1.1.0 --project FerdBur/wave
gitflic commit tag-diff v1.0.0 v1.1.0 --project FerdBur/wave --ignore-collapsed
# Diff между двумя тегами (tag/diff).
```

### cherry-pick

```bash
gitflic commit cherry-pick abc1234 feature/y --project FerdBur/wave
gitflic commit cherry-pick abc1234 feature/y --project FerdBur/wave --new-branch hotfix/z
# Применить коммит abc1234 на ветку feature/y (PUT branch/cherry-pick).
# --new-branch создаёт новую ветку для cherry-pick.
```

## blob

Файлы репозитория. Принимают `--project owner/alias` либо автоопределение из git-репозитория.

### get (текст файла, raw)

```bash
# Текстовый файл (вывод в stdout)
gitflic blob get README.md --commit master --project FerdBur/wave
gitflic blob get src/index.ts --commit abc1234 --project FerdBur/wave
```

### download (бинарь на диск)

```bash
# Бинарно-безопасное скачивание файла на диск
gitflic blob download logo.png --commit master --out /tmp/logo.png --project FerdBur/wave
```

### recursive (рекурсивный список)

```bash
# Список файлов (json) от каталога вглубь до depth (макс. 10)
gitflic blob recursive --commit master --project FerdBur/wave
gitflic blob recursive --commit master --directory src --depth 3 --project FerdBur/wave
```

### file-size (размер файла)

```bash
# Размер файла в байтах (резолвит UUID проекта)
gitflic blob file-size README.md --branch master --project FerdBur/wave
```

> 💡 Для бинарных файлов используй `blob download` — он сохраняет байты на диск без искажений. `blob get` отдаёт сырой текст в stdout.
