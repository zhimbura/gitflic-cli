# Релизы (`gitflic release ...`)

CRUD релизов + **multipart-загрузка файлов** (download / delete-file).

## Подкоманды

```bash
gitflic release list --project FerdBur/wave                # список релизов
gitflic release list --project FerdBur/wave --all --format json   # авто-пагинация
gitflic release get <uuid> --project FerdBur/wave          # детали релиза
gitflic release latest --project FerdBur/wave              # последний релиз
```

### create

```bash
gitflic release create --project FerdBur/wave \
  --title "v1.0.0" \
  --description "Release notes here" \
  --tag v1.0.0 \
  --pre-release                                    # пометить как pre-release
```

Можно также прикрепить архив прямо при создании:

```bash
gitflic release create --project FerdBur/wave \
  --title "v1.0.0" \
  --tag v1.0.0 \
  --attach-archive \
  --archive-format tar.gz
```

### edit

Редактирует только метаданные релиза (файлы через этот API не редактируются — см. `upload` / `delete-file`).

```bash
gitflic release edit <uuid> --project FerdBur/wave \
  --title "v1.0.1" \
  --description "Updated notes" \
  --pre-release false
```

### delete

```bash
gitflic release delete <uuid> --project FerdBur/wave
```

### upload — **multipart**

Загружает файл в релиз. CLI использует `multipart/form-data` (поле `files`) через встроенный `FormData` Node (Node 18+).

```bash
gitflic release upload <releaseUuid> ./bin/myapp \
  --project FerdBur/wave \
  --name myapp-linux-x64                 # опционально, default = basename файла

gitflic release upload <releaseUuid> ./dist/myapp-1.0.0.tar.gz \
  --project FerdBur/wave
```

> GitFlic проверяет тип файла по allowlist. Архивы (`.zip`, `.tar.gz` и т.п.) проходят, а `.txt` / `.png` могут вернуть **HTTP 415** — это серверное ограничение GitFlic, а не баг CLI.

### download

Скачивает прикреплённый файл по его UUID. Без `--out` файл сохраняется под именем `<fileUuid>`.

```bash
gitflic release download <releaseUuid> <fileUuid> --project FerdBur/wave --out ./myapp.tar.gz
```

### delete-file

Удаляет прикреплённый файл из релиза.

```bash
gitflic release delete-file <releaseUuid> <fileUuid> --project FerdBur/wave
```

## Пример: полный release flow

```bash
# Сборка
npm run build
tar czf myapp-1.0.0.tar.gz dist/

# Релиз с прикреплённым архивом
gitflic release create --project FerdBur/wave \
  --title "v1.0.0" \
  --tag v1.0.0 \
  --description "$(cat CHANGELOG.md)" \
  --attach-archive \
  --archive-format tar.gz

# Или отдельно: создать релиз, потом залить файл
UUID=$(gitflic release create --project FerdBur/wave --title "v1.0.0" --tag v1.0.0 --format json | jq -r '.id')
gitflic release upload $UUID ./myapp-1.0.0.tar.gz --project FerdBur/wave

# Список файлов релиза и скачивание
gitflic release get $UUID --project FerdBur/wave --format json | jq '.attachmentFiles'
gitflic release download $UUID <fileUuid> --project FerdBur/wave --out ./myapp-1.0.0.tar.gz
```
