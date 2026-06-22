# Релизы (`gitflic release ...`)

CRUD релизов + **multipart upload ассетов**.

## Подкоманды

```bash
gitflic release list --project FerdBur/wave                # все релизы
gitflic release list --project FerdBur/wave --all --format json
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
  --archive-format tar.gz \
  --archive-path ./dist/myapp.tar.gz
```

### edit

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

### asset upload — **multipart**

```bash
gitflic release asset upload <releaseUuid> ./bin/myapp \
  --project FerdBur/wave \
  --name myapp-linux-x64                 # опционально, default = basename файла

gitflic release asset upload <releaseUuid> ./screenshot.png \
  --project FerdBur/wave
```

Поддерживает любые бинари — images, archives, executables. CLI использует `multipart/form-data` через Node's built-in `FormData` (Node 18+).

> ⚠️ URL эндпоинта — best-guess на основе публичной API-документации. Если `404 Not Found` — поправь URL в `lib/cmd/release.mjs:140` (issue или PR приветствуется).

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
  --archive-format tar.gz \
  --archive-path myapp-1.0.0.tar.gz

# Или отдельно: создать релиз, потом залить ассет
UUID=$(gitflic release create --project FerdBur/wave --title "v1.0.0" --tag v1.0.0 --format json | jq -r '.id')
gitflic release asset upload $UUID ./myapp-1.0.0.tar.gz --project FerdBur/wave
```
