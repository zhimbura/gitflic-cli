# Покрытие API

Сравнение того, что GitFlic REST документирует, с тем, что CLI реально оборачивает.

Полный список эндпоинтов в [docs.gitflic.ru/latest/api](https://docs.gitflic.ru/latest/api/).

| # | Раздел | Эндпоинтов в доке | Реализовано | Покрытие | Заметки |
|---|---|---:|---:|---:|---|
| 1 | **merge-request** (`mr`) | 17 | 17 | **100%** | Весь жизненный цикл MR + обсуждения + by-commit |
| 2 | **mergeRequestDiscussion** | 6 | 4 | 67% | delete + get-one + create-reply отсутствуют в доке; покрыты list/reply/resolve/delete + create-via-comment |
| 3 | **branch** | 11 | 11 | **100%** | вкл. branch protection (CRUD) |
| 4 | **tag** | 11 | 4 | 36% | tag CRUD частично; tag-protection доступен только team/company и реализован (CRUD) |
| 5 | **release** | 10 | 8 | 80% | загрузка/скачивание файлов (multipart) реализовано; CRUD метаданных сделан |
| 6 | **issue** | 11 | 12 | **100%+** | вкл. comments + relations (list) + attachment upload (multipart) |
| 7 | **commit** | 8 | 8 | **100%** | вкл. cherry-pick |
| 8 | **blob** | 5 | 3 | 60% | get / files / archive; загрузка бинарей отсутствует в API |
| 9 | **settings** (user) | 14 | 7 | 50% | ssh list+delete + access-token create отсутствуют в REST; покрыто ssh-add, oauth CRUD, transport-token create, смена профиля |
| 10 | **user** | 6 | 6 | **100%** | |
| 11 | **project** | 25 | 22 | 88% | file attach (multipart), выполнение скриптов, размер проекта не отдаются; member/team/follower/stars/deploy-token покрыты |
| 12 | **team** | 7 | 6 | 86% | базовый CRUD + members |
| 13 | **company** | 6 | 2 | 33% | только list / get — создание/изменение/удаление компании только через web UI |
| 14 | **environment** | 6 | 3 | 50% | только environment-protection (CRUD) — универсального CRUD окружений в REST нет |
| 15 | **webhook** | 5 | 5 | **100%** | вкл. create / update / delete (POST-эндпоинты) |
| 16 | **package-registry** (registry) | 19 | 1 | 5% | только list (instance); подтипы (Maven/NPM и т.п.) не обёрнуты |
| 17 | **cicd** | 15 | 5 | 33% | pipeline list/get/start + jobs list; artifacts / job-* не обёрнуты |
| 18 | **runner** | 4 | 1 | 25% | только list; get/show/register не реализованы |
| 19 | **admin** | 10 | 2 | 20% | только user list / project list; большинство admin-операций только в web UI |
| 20 | **saml** | 3 | 1 | 33% | только list |
| 21 | **mcp-server** (наш собственный) | — | 71 tools | — | MCP tools поверх всех CLI команд |

| | **ИТОГО** | **~199** | **~133** | **~67%** | от задокументированных публичных REST-эндпоинтов |

> Оставшиеся ~33% — в основном:
> - **Под-API по типу реестра пакетов** (Maven, NPM, Docker и т.п.) — большая поверхность, низкая ценность для MR-работы.
> - **Webhook/UI-only сценарии** (SAML admin, регистрация runner'ов, статистика размера проекта) — публичного REST-эндпоинта нет.
> - **Per-MR настройки проекта** (правила аппрувов, merge-шаблоны) — вне MR-скоупа.

## Что в работе

- Push для реестра пакетов (если есть запрос — открой issue).
- Runner register/show (нужен admin-эндпоинт).
- CI/CD artifacts / per-job операции (нужен use-case).

## Как добавить покрытие

1. Посмотри `lib/cmd/<existing>.mjs` для паттерна.
2. Создай новый модуль или расширь существующий.
3. Напиши тесты в `lib/__tests__/<name>.test.mjs`.
4. Обнови эту таблицу.
