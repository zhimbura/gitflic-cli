# Установка

## Требования

- **Node.js 18+** (используется глобальный `fetch`, нет npm-зависимостей).
- SSH-ключ, добавленный в https://gitflic.ru (для SSH-варианта установки).
- Для HTTPS-варианта — личный API-токен, переданный через `GITFLIC_TOKEN`.

## Быстрая установка (SSH, рекомендуется)

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
cd ~/tools/gitflic-cli
bash install.sh
```

`install.sh` сделает:

1. Скопирует CLI в `~/.local/share/gitflic-cli/`.
2. Создаст symlink `~/.local/bin/gitflic` → `bin/gitflic`.
3. Подскажет добавить `~/.local/bin` в `PATH`, если его там ещё нет.

## Альтернативные способы

### Windows / PowerShell

```powershell
git clone git@gitflic.ru:tikhon/gitflic-cli.git
cd gitflic-cli
powershell -ExecutionPolicy Bypass -File install.ps1
```

### Кастомный префикс установки

```bash
bash install.sh --prefix ~/my-tools
# CLI ляжет в ~/my-tools/share/gitflic-cli, symlink в ~/my-tools/bin/gitflic
```

### Только файлы, без symlink

```bash
bash install.sh --no-symlink
# Полезно если PATH под контролем (XDG_BIN_HOME, mise, asdf, ...)
```

### Dry-run (без записи на диск)

```bash
bash install.sh --dry-run
# Покажет что будет сделано, ничего не записывая.
```

### HTTPS вместо SSH

```bash
GITFLIC_TOKEN=xxxxxxxx bash install.sh
# Использует https://gitflic.ru/tikhon/gitflic-cli.git с basic auth.
```

### Удаление

```bash
bash uninstall.sh           # Linux/macOS/WSL
powershell -File uninstall.ps1   # Windows
```

## Ручная установка (без install.sh)

```bash
git clone git@gitflic.ru:tikhon/gitflic-cli.git ~/tools/gitflic-cli
chmod +x ~/tools/gitflic-cli/bin/gitflic
ln -sf ~/tools/gitflic-cli/bin/gitflic ~/.local/bin/gitflic
export PATH="$HOME/.local/bin:$PATH"   # добавь в ~/.bashrc / ~/.zshrc
```

## Что ставится на диск

```
~/.local/share/gitflic-cli/    # сам CLI (копия репо)
~/.local/bin/gitflic           # symlink на bin/gitflic
```

`install.sh` НЕ модифицирует `~/.bashrc` / `~/.zshrc` сам — он только подсказывает. Решение о добавлении в PATH — за тобой.

## Запуск из исходников (dev-режим)

Если ты форкнул/клонировал и хочешь запустить без установки:

```bash
cd ~/tools/gitflic-cli
node lib/gitflic.mjs --help
```

Все подкоманды работают идентично, путь просто короче.

## Обновление

```bash
cd ~/tools/gitflic-cli
git pull
bash install.sh
```

Старая копия в `~/.local/share/gitflic-cli/` будет перезаписана, symlink останется.
