# Покрытие API

Сравнение того, что GitFlic REST документирует, с тем, что CLI реально оборачивает.

Полный список эндпоинтов в [docs.gitflic.ru/latest/api](https://docs.gitflic.ru/latest/api/).

**Покрыты все 20 разделов публичного REST API** (≈199 задокументированных эндпоинтов; со scope-вариантами project / company / team / instance — заметно больше). Большинство протестировано вживую против `api.gitflic.ru`; часть — code-only там, где нужны admin-права или Enterprise/Atlas.

| # | Раздел | Покрытие | Заметки |
|---|---|---:|---|
| 1 | **merge-request** (`mr`) | **100%** | lifecycle + discussions + by-commit + approval rules/configuration + squash/method/template (team/company) + apply-settings |
| 2 | **mergeRequestDiscussion** | **100%** | list / get-one / create / reply / resolve / delete |
| 3 | **branch** | **100%** | branches + compare + compare-file + commits-between + branch-protection (project/team/company) |
| 4 | **tag** | **100%** | tag list/get/create + tag-protection (team/company CRUD + apply). Удаления тега в REST нет |
| 5 | **release** | **100%** | CRUD + file upload/download/delete |
| 6 | **issue** | **100%** | CRUD + comments + relations + files/link/unlink + `issue attach` |
| 7 | **commit** | **100%** | list (`/commits`) + get/file/diff/for-file + commit-diff + tag-diff + cherry-pick |
| 8 | **blob** | **100%** | get (raw) + download + recursive + file-size |
| 9 | **settings** (user) | **100%** | ssh add + oauth CRUD + access-token + transport-token + смена профиля |
| 10 | **user** | **100%** | me / get / projects / followers / following |
| 11 | **project** | **100%** | CRUD + search/my/shared + members/teams + fork/mirror/import + archive + files + change-setting + deploy-token + run-script |
| 12 | **team** | **100%** | list/my/shared/get/create/transfer + members + import (edit/delete — UI-only) |
| 13 | **company** | **100%** | list/my/shared/get/create + members + import |
| 14 | **environment** | **100%** | environment-protection (team/company CRUD + apply) |
| 15 | **webhook** | **100%** | list/get/create/edit/delete |
| 16 | **package-registry** (`registry package`) | **100%** | CRUD (3 scope) + upload/download для всех форматов |
| 16b | **registry-repository** (`registry repo`) | **100%** ¹ | CRUD + packages + per-format up/down (Enterprise/Atlas-only, code-only) |
| 17 | **cicd** | **100%** | pipeline/job lifecycle + artifacts + variables + pipeline-lifetime |
| 18 | **runner** | **100%** ² | project/company/instance scopes |
| 19 | **admin** | **100%** ² | user CRUD + ban + ssh-key + push-stats + 18 settings + ldap import |
| 20 | **saml** | **100%** ² | `/admin/saml` list/create/edit/change-status |
| — | **mcp-server** | — | MCP-обёртка поверх CLI |

> ¹ Enterprise/Atlas-only — на публичном инстансе 404.
> ² Требует прав администратора — обычным токеном не тестируется.

Полная машиночитаемая карта эндпоинтов: метод+путь по каждому разделу — в исходниках спеки (`docs.gitflic.ru/latest/api/<section>/`).

## Как добавить покрытие

1. Посмотри `lib/cmd/<existing>.mjs` для паттерна.
2. Создай новый модуль или расширь существующий.
3. Напиши тесты в `lib/__tests__/<name>.test.mjs`.
4. Обнови эту таблицу.
