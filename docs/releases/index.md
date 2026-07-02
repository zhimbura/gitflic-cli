---
description: "Релизы и артефакты gitflic-cli: портативные tar.gz-сборки, публикуемые как статические ассеты сайта документации. Скачивание без CI и внешних хранилищ."
---

# Релизы и артефакты

Каждый релиз `gitflic-cli` — это портативный `tar.gz`, собранный скриптом `scripts/build.mjs` и опубликованный как статический ассет сайта документации. Никакого CI, никакого S3 — собранный VitePress-сайт раздаётся целиком (страницы + артефакты под одним доменом).

## Как скачать

Артефакты лежат в `/downloads/` собранного сайта (исходник — `docs/public/downloads/`): по одному `tar.gz` на каждый релиз, плюс простой список в [/downloads/](/downloads/). Прямые ссылки без редиректов, например `/downloads/gitflic-cli-0.3.0.tar.gz`.

После скачивания:

```bash
tar -xzf gitflic-cli-0.3.0.tar.gz
cd gitflic-cli-0.3.0
bash install.sh              # симлинк в ~/.local/bin/gitflic
gitflic --help
```

## Как устроена сборка

Подробно — в [Локальной разработке](/development), секция «Сборка и релиз». Коротко:

```bash
npm run build                          # lint + test + tar.gz → dist/
npm run release -- --version 0.3.0     # bump + пересборка + копия в docs/public/downloads/
git add . && git commit -m "release: v0.3.0" && git push   # исходники в основной репо
npm run docs:publish                   # build + публикация сайта в GitHub-зеркало
```

## Деплой

Дока — статический VitePress-сайт (gh-pages style). `npm run docs:publish` собирает `docs/.vitepress/dist` и публикует его в GitHub-зеркало [`zhimbura/gitflic-cli-docs`](https://github.com/zhimbura/gitflic-cli-docs), корень которого Timeweb раздаёт статикой. Артефакты релизов попадают в сборку как `docs/public/` → `/downloads/`.

## Почему не GitFlic Releases / S3

- Публичный `gitflic.ru` не даёт shared CI runners — нужен self-hosted `runner.jar`, а это платный VPS.
- S3 для одного бинаря — overkill.
- Один артефакт + одна дока = один деплой статики.
