# Релизы и артефакты

Каждый релиз `gitflic-cli` — это портативный `tar.gz`, собранный скриптом `scripts/build.mjs` и опубликованный прямо в этой папке. Никакого CI, никакого S3 — Timeweb Apps раздаёт всё из одного `docs/` под одним доменом.

## Как скачать

Открой <https://docs.gitflic-cli.example/releases/> (или локально `docs/releases/index.html`) — там список tar.gz, по одному на каждый релиз. Прямые ссылки без редиректов.

После скачивания:

```bash
tar -xzf gitflic-cli-0.2.0.tar.gz
cd gitflic-cli-0.2.0
bash install.sh              # симлинк в ~/.local/bin/gitflic
gitflic --help
```

## Как устроена сборка

Подробно — в [Локальной разработке](development.md), секция «Сборка и релиз». Коротко:

```bash
npm run build                          # lint + test + tar.gz → dist/
npm run release -- --version 0.2.0     # bump + пересборка + копия в docs/releases/
git add . && git commit -m "release: v0.2.0"
git push origin main                   # Timeweb Apps задеплоит docs/ автоматически
```

## Список релизов

См. [index.html](index.html) — там всегда актуальный список, рендерится из содержимого папки.

## Почему не GitFlic Releases / S3

- Публичный `gitflic.ru` не даёт shared CI runners — нужен self-hosted `runner.jar`, а это платный VPS.
- S3 для одного бинаря — overkill.
- Время загрузки: 0. Пуш в main → Timeweb App подхватил → дока + артефакт уже онлайн.
