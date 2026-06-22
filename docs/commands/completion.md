# `completion`

Shell completion для bash/zsh/fish.

## bash

```bash
# Временно (текущая сессия)
eval "$(gitflic completion bash)"

# Постоянно — добавь в ~/.bashrc
echo 'eval "$(gitflic completion bash)"' >> ~/.bashrc
```

## zsh

```zsh
# В fpath (рекомендуется)
gitflic completion zsh > "${fpath[1]}/_gitflic"

# Или source напрямую
gitflic completion zsh > _gitflic.zsh
echo 'source /path/to/_gitflic.zsh' >> ~/.zshrc
```

## fish

```fish
gitflic completion fish > ~/.config/fish/completions/gitflic.fish
```

## Что комплитится

- Все 21 top-level команд
- Все sub-команды внутри каждого модуля
- Флаги: `--project`, `--api-base`, `--token`, `--format`, `--page`, `--size`, `--all`, `--stream`, `--tui`
- Для `auth` дополнительно: `--as`, `--stdin`, `--reveal`, `--all`
- Для `alias` дополнительно: известные ключи (`default-project`, `api-base`, `token`)

## Проверить

После установки:

```bash
gitflic <TAB>            # покажет: auth mr branch tag release issue commit blob ...
gitflic mr <TAB>         # покажет: list view diff create edit approve merge ...
gitflic mr list --<TAB>  # покажет: --project --api-base --token --format --all ...
```
