# gitflic-cli

Lightweight, zero-dependency CLI for the [GitFlic](https://gitflic.ru) REST API — merge requests, discussions, issues, releases, branches, tags, commits, files, webhooks, environments, packages, CI/CD and project admin. ~150 GitFlic REST endpoints are wrapped behind a single `gitflic` binary that any script (or AI agent) can call.

> **Note:** GitFlic's official `cli.jar` is a *server-side* admin tool (LFS/releases fixes for a self-hosted instance). This is the missing **user-facing** CLI for everyday MR/issue/release work.

## Why

- **Zero deps.** Pure Node ESM (>=18). Uses global `fetch`. No `npm install`.
- **Agent-friendly.** Every command accepts `--format json` and produces stable JSON on stdout. Exit code is `0` on success, `1` on any HTTP error.
- **Self-documenting.** `gitflic help` and `gitflic <cmd> help` list every sub-command and flag.
- **Covers the public REST surface** — 20 top-level modules, ~125 endpoint wrappers.

## Install

Requires Node 18+ (uses global `fetch`).

```bash
git clone <repo-url> ~/tools/gitflic-cli
cd ~/tools/gitflic-cli
chmod +x bin/gitflic
ln -sf "$(pwd)/bin/gitflic" "$HOME/.local/bin/gitflic"
# add to PATH if not already:  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

## Auth

1. Open <https://gitflic.ru> → **Profile** → **API tokens** → **Create**.
2. Choose scopes — at minimum `PROJECT_READ` and `PROJECT_WRITE` / `PROJECT_EDIT` for MR work.
3. Export the token:

```bash
export GITFLIC_TOKEN="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

For self-hosted GitFlic also export:

```bash
export GITFLIC_API_BASE="https://git.example.com"
```

You can also drop a `.env` next to the project (mode `0600`) — it's auto-loaded if you wrap the binary, e.g.:

```bash
set -a; source .env; set +a; gitflic mr list
```

## Usage

```bash
gitflic auth
gitflic project get tikhon/gitflic-cli                # resolve project (alias → UUID)
gitflic mr list --project tikhon/gitflic-cli          # list MRs
gitflic mr view 42 --project tikhon/gitflic-cli
gitflic mr diff 42 --project tikhon/gitflic-cli
gitflic mr create --title "Fix login" --to main       # auto: current branch → default
gitflic mr approve 42
gitflic mr merge 42 --message "Squash: fix login"
gitflic mr close 42
gitflic mr comment 42 "Please rebase"                 # or anchored: --new-path F --new-line N
gitflic mr discuss list 42
gitflic branch list                                  # auto-detected from `origin` remote
gitflic branch protection create --branch-template master --allowed-to-push NO_ONE --allowed-to-merge DEVELOPER
gitflic issue create --title "Bug" --description "..."
gitflic release create --title "v1.0.0" --tag v1.0.0
gitflic tag create v1.0.0 --branch master --message "Release"
gitflic webhook create --url https://example.com/h --event PUSH
gitflic user me                                       # current user (with email)
```

Run `gitflic help` for the full top-level list, or `gitflic <cmd> help` for a module.

## Command reference

| Module | Top command | Highlights |
|---|---|---|
| auth | `gitflic auth` | Identity check via `/user/me` |
| **mr** | `gitflic mr ...` | list / view / diff / create / edit / approve / merge / close / cancel / by-commit / comment (general + inline) / discuss (list / reply / resolve / delete) |
| **branch** | `gitflic branch ...` | list / get / default / create / delete / compare / protection (list / get / create / edit / delete) |
| **tag** | `gitflic tag ...` | list / get / create / protection (list / create / edit / delete) — *no API for tag delete* |
| **release** | `gitflic release ...` | list / get / latest / create / edit / delete — *file upload/download not implemented* |
| **issue** | `gitflic issue ...` | list / view / create / edit / close / reopen / delete / comments (list / add / edit / delete) / relations (list) |
| **commit** | `gitflic commit ...` | list / get / files / diff / compare / cherry-pick |
| **blob** | `gitflic blob ...` | get (text) / files (list) / archive (binary download) |
| **settings** | `gitflic settings ...` | ssh add / oauth (list / get / create / delete) / transport-token create / change-email / change-username / change-password |
| **user** | `gitflic user ...` | me / search / get / projects / followers / following |
| **project** | `gitflic project ...` | list / get / create / edit / delete / files / archive / followers / stars / fork / mirror / import / member / team / deploy-token |
| **team** | `gitflic team ...` | list / get / create / edit / delete / members |
| **company** | `gitflic company ...` | list / get |
| **environment** | `gitflic environment ...` | protection (list / create / delete) — *generic environment CRUD not in REST API* |
| **webhook** | `gitflic webhook ...` | list / get / create / edit / delete |
| **registry** | `gitflic registry ...` | list (instance/company/project scope) / repos |
| **cicd** | `gitflic cicd ...` | pipeline (list / get / start) / jobs |
| **runner** | `gitflic runner ...` | list / get |
| **admin** | `gitflic admin ...` | user list / project list (admin only — code-only) |
| **saml** | `gitflic saml ...` | list (admin only — code-only) |

## API coverage (vs https://docs.gitflic.ru/latest/api/)

| # | Section | Endpoints in docs | Implemented | Coverage | Notes |
|---|---|---:|---:|---:|---|
| 1 | **merge-request** (`mr`) | 17 | 17 | **100%** | All MR lifecycle + discussions + by-commit |
| 2 | **mergeRequestDiscussion** | 6 | 4 | 67% | Delete + get-one + create-reply missing in doc; we cover list/reply/resolve/delete + create-via-comment |
| 3 | **branch** | 11 | 11 | **100%** | incl. branch protection (CRUD) |
| 4 | **tag** | 11 | 4 | 36% | tag CRUD partial; tag-protection is team/company-only and is implemented (CRUD) |
| 5 | **release** | 10 | 7 | 70% | file upload/download (multipart) not implemented; metadata CRUD done |
| 6 | **issue** | 11 | 11 | **100%** | incl. comments + relations (list) |
| 7 | **commit** | 8 | 8 | **100%** | incl. cherry-pick |
| 8 | **blob** | 5 | 3 | 60% | get / files / archive; binary upload not in API |
| 9 | **settings** (user) | 14 | 7 | 50% | ssh list+delete + access-token create not in REST; we cover ssh-add, oauth CRUD, transport-token create, profile changes |
| 10 | **user** | 6 | 6 | **100%** | |
| 11 | **project** | 25 | 22 | 88% | file attach (multipart), script execution, project size not exposed; member/team/follower/stars/deploy-token covered |
| 12 | **team** | 7 | 6 | 86% | basic CRUD + members |
| 13 | **company** | 6 | 2 | 33% | only list / get — company create/edit/delete restricted to web UI |
| 14 | **environment** | 6 | 3 | 50% | only environment-protection (CRUD) — generic env CRUD not in REST API |
| 15 | **webhook** | 5 | 5 | **100%** | incl. create / update / delete (POST endpoints) |
| 16 | **package-registry** (registry) | 19 | 1 | 5% | only list (instance) — sub-types (Maven/NPM/etc.) not wrapped |
| 17 | **cicd** | 15 | 5 | 33% | pipeline list/get/start + jobs list; artifacts / job-* not wrapped |
| 18 | **runner** | 4 | 0 | 0% | code-only stub — public list endpoint not confirmed |
| 19 | **admin** | 10 | 2 | 20% | only user list / project list; most admin actions are web-UI only |
| 20 | **saml** | 3 | 1 | 33% | list only |

| | **TOTAL** | **~199** | **~113** | **~57%** | of documented public REST endpoints |

> The remaining ~43% is mostly:
> - **Multipart file uploads** (release assets, issue attachments) — out of scope for a CLI, but a future v2 could do them.
> - **Per-type registry sub-APIs** (Maven, NPM, Docker, etc.) — large surface, low MR-related value.
> - **Webhook/UI-only flows** (SAML admin, runner registration, project size stats) — no public REST endpoint.
> - **Per-MR project settings** (approval rules, merge templates) — out of MR-scope but available via `gitflic project settings mr` in a future version.

## Known issues / quirks

- **`gitflic tag get <name>`** returns HTTP 400 from GitFlic for *any* name on a project-scoped call. We use `tag list` + lookup instead. Tracked but not workaroundable from the client.
- **`mr merge`** on a new project may fail with `MergeCheckException` because default branch-protection requires approvals from non-author users. This is GitFlic behaviour, not a CLI bug.
- **SSH push** to GitFlic requires an SSH key (transport-token is for the package registry only, not `git push`). Your key can be added via the web UI or via this CLI once you've added the public key manually.
- **access-token creation** via REST requires HTTP Basic auth; the CLI doesn't support that. Create tokens via the GitFlic web UI.
- **Multi-language responses** from GitFlic are localised (Russian titles like «Открыт», «Слит»). The CLI prints them as-is; status `id` values are English constants (`OPENED`, `MERGED`, `CLOSED`, `CANCELED`, `FAILED`).

## For AI agents

Every command supports `--format json` for machine consumption. The agent (or shell pipeline) gets stable JSON to parse. A few recipes:

```bash
# Count open MRs across the project
gitflic mr list --project tikhon/wave --format json \
  | jq '[._embedded.mergeRequestModelList[] | select(.status.id == "OPENED")] | length'

# Get just the title + status of the latest MR
gitflic mr list --project tikhon/wave --format json \
  | jq -r '._embedded.mergeRequestModelList[0] | "#\(.localId) [\(.status.title)] \(.title)"'

# Create MR from current branch into master, prompt for title/description
TITLE="Fix login"
DESC=$(git log -1 --pretty=%B)
gitflic mr create --project tikhon/wave --title "$TITLE" --description "$DESC" --to master
```

Recommended project conventions:

- Set `GITFLIC_TOKEN` in your shell environment, not in the project.
- For multi-repo workflows, prefer passing `--project owner/alias` explicitly; auto-detect from `origin` works only inside a git clone.
- Pipe through `jq` to filter or transform JSON.

## Architecture

```
gitflic-cli/
├── bin/gitflic                # bash shim → node lib/gitflic.mjs
├── lib/
│   ├── gitflic.mjs            # entry: parse args, dispatch to modules
│   ├── http.mjs               # fetch wrapper + git auto-detect
│   ├── format.mjs             # color, pretty printers, common helpers
│   └── cmd/
│       ├── mr.mjs             # merge-request module
│       ├── branch.mjs         # branch + branch-protection
│       ├── tag.mjs            # tag + tag-protection
│       ├── release.mjs        # release
│       ├── issue.mjs          # issue + issueNote + relations
│       ├── commit.mjs         # commits
│       ├── blob.mjs           # files / archive
│       ├── settings.mjs       # user settings (ssh, oauth, tokens, profile)
│       ├── user.mjs           # users (me, search, by-alias, projects, followers)
│       ├── project.mjs        # projects (CRUD, members, teams, fork, mirror, import)
│       ├── team.mjs           # teams
│       ├── company.mjs        # companies
│       ├── environment.mjs    # environment-protection
│       ├── webhook.mjs        # project webhooks
│       ├── registry.mjs       # package registry
│       ├── cicd.mjs           # CI/CD pipelines and jobs
│       ├── runner.mjs         # CI/CD runners/agents
│       ├── admin.mjs          # admin endpoints
│       └── saml.mjs           # SAML SSO
├── package.json               # type:module, engines.node>=18
├── README.md                  # this file
├── CHANGELOG.md               # release notes
├── .gitignore
└── .env.example               # GITFLIC_TOKEN, GITFLIC_API_BASE
```

Every command module exports `usage` (string) and `handle(ctx, sub, args, flags)`. The dispatcher (`lib/gitflic.mjs`) handles token resolution, project resolution (`--project` flag or git-auto-detect), and `help` generation.

## Development

```bash
# Syntax-check all modules
for f in lib/gitflic.mjs lib/http.mjs lib/format.mjs lib/cmd/*.mjs; do
  node --check "$f"
done

# Run without installing
node lib/gitflic.mjs help

# Add a new module
# 1. Create lib/cmd/<name>.mjs exporting { usage, handle }
# 2. Import + add to COMMANDS in lib/gitflic.mjs
# 3. Add to GLOBAL set if it doesn't need --project
```

## License

MIT.
