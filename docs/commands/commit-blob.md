# Коммиты и файлы

## commit

```bash
gitflic commit list --project FerdBur/wave                       # коммиты default branch
gitflic commit list --project FerdBur/wave --branch feature/x     # другой ветки
gitflic commit list --project FerdBur/wave --all --size 100
gitflic commit get abc1234 --project FerdBur/wave                # один коммит
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

### compare (два коммита)

```bash
gitflic commit compare abc1234 def5678 --project FerdBur/wave
# Сравнение двух коммитов.
```

### cherry-pick

```bash
gitflic commit cherry-pick abc1234 feature/y --project FerdBur/wave
# Применить коммит abc1234 на ветку feature/y.
```

## blob

Файлы и архивы репозитория.

```bash
# Текстовый файл (вывод в stdout)
gitflic blob get README.md --project FerdBur/wave
gitflic blob get src/index.ts --project FerdBur/wave --branch master
gitflic blob get src/index.ts --project FerdBur/wave --commit abc1234
```

```bash
# Список файлов
gitflic blob files --project FerdBur/wave
gitflic blob files --project FerdBur/wave --path src/auth
```

```bash
# Архив репозитория (бинарь — pipe в файл)
gitflic blob archive master --project FerdBur/wave > /tmp/repo.tar.gz
gitflic blob archive --project FerdBur/wave --format zip > /tmp/repo.zip
```

> ⚠️ `blob get` для **бинарных файлов** — base64 (если поддерживается API) или ошибка. Для скачивания бинарей используй `blob archive`.
