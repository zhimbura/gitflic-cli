// gitflic registry — package registry + registry repositories
// (Maven, NPM, PyPI, NuGet, Composer, Docker/OPM, Cargo, Conda, CRAN,
//  RubyGems, Generic, …).
//
// `registry` is in the dispatcher GLOBAL set, so ctx has { api, token, flags }
// but NO pre-resolved owner/alias. Every scope is resolved here from flags.
//
// Two subcommand trees:
//   registry package ...   — the package registry (per-spec "package" section)
//   registry repo ...      — registry repositories (per-spec "registry-repository"
//                            section; Enterprise/Atlas-only, 404 on public SaaS,
//                            implemented faithfully code-only).
//
// SCOPES
//   --scope project   (default)   uses --project owner/alias (or git autodetect
//                                  is NOT available here since registry is GLOBAL,
//                                  so --project is required for project scope)
//   --scope company   --company <alias>
//   --scope instance              (a.k.a. global for packages)
//
// PACKAGE scope base (CONFIRMED live: base is /registry):
//   project  -> /registry/project/{owner}/{alias}/package
//   company  -> /registry/company/{companyAlias}/package
//   global   -> /registry/package
//
// PACKAGE per-format upload/download live under the SAME /registry base as the
// management API (verified live: PUT /registry/project/{o}/{a}/package/generic/
// {name}/{version}/{file} = 200). The lone exception is composer collect-from-tag
// which is POST /project/{o}/{a}/package/-/composer?tag=... (handled separately).
//
// REPOSITORY scope base:
//   project  -> /project/{owner}/{alias}/repositories
//   company  -> /company/{companyAlias}/repositories
//   instance -> /registry/instance/repositories
// REPO per-format upload/download mirror the package collectors but live under
// the repository path with a ?nodePath= query selecting the target folder/node.

import {
  die,
  printJson,
  resolveFormat,
  printEmpty,
} from "../format.mjs";
import { http, httpDownload, httpUploadFile } from "../http.mjs";
import { buildPageQs } from "../paginate.mjs";

const enc = encodeURIComponent;

// ---------------------------------------------------------------------------
// Scope resolution (registry is GLOBAL — no ctx.owner/alias)
// ---------------------------------------------------------------------------

// Normalize a scope flag for PACKAGES. Accepts:
//   --scope project|company|instance|global   (instance == global)
//   --company <alias>  (implies company scope if --scope omitted)
function resolvePackageScope(flags) {
  let scope = flags.scope;
  if (!scope) scope = flags.company ? "company" : "project";
  if (scope === "instance") scope = "global";
  if (!["project", "company", "global"].includes(scope)) {
    die(`--scope must be project|company|instance (got "${flags.scope}")`);
  }
  return scope;
}

// Normalize a scope flag for REPOSITORIES. Accepts:
//   --scope project|company|instance
//   --company <alias>  (implies company scope if --scope omitted)
function resolveRepoScope(flags) {
  let scope = flags.scope;
  if (!scope) scope = flags.company ? "company" : "project";
  if (scope === "global") scope = "instance";
  if (!["project", "company", "instance"].includes(scope)) {
    die(`--scope must be project|company|instance (got "${flags.scope}")`);
  }
  return scope;
}

// owner/alias from --project (registry is GLOBAL so it is NOT pre-resolved).
function projectOwnerAlias(flags) {
  if (!flags.project) {
    die("project scope requires --project owner/alias");
  }
  const m = String(flags.project).match(/^([^/]+)\/([^/]+)$/);
  if (!m) die(`--project must be owner/alias, got "${flags.project}"`);
  return { owner: m[1], alias: m[2] };
}

function companyAlias(flags) {
  const a = flags.company;
  if (!a || a === true) die("company scope requires --company <companyAlias>");
  return String(a);
}

// Base path for the PACKAGE management API (list/get/versions/files/delete).
function packageBase(api, flags) {
  const scope = resolvePackageScope(flags);
  if (scope === "project") {
    const { owner, alias } = projectOwnerAlias(flags);
    return `${api}/registry/project/${enc(owner)}/${enc(alias)}/package`;
  }
  if (scope === "company") {
    return `${api}/registry/company/${enc(companyAlias(flags))}/package`;
  }
  return `${api}/registry/package`; // global
}

// Base path for the REPOSITORY management API.
function repoBase(api, flags) {
  const scope = resolveRepoScope(flags);
  if (scope === "project") {
    const { owner, alias } = projectOwnerAlias(flags);
    return `${api}/project/${enc(owner)}/${enc(alias)}/repositories`;
  }
  if (scope === "company") {
    return `${api}/company/${enc(companyAlias(flags))}/repositories`;
  }
  return `${api}/registry/instance/repositories`; // instance
}

// ---------------------------------------------------------------------------
// FORMAT table — per-format upload (PUT) / download (GET) path templates.
//
// Templates use placeholders filled from positional coords:
//   {g}  groupId path  (maven: dots -> slashes)
//   {a}  artifactId / package name
//   {v}  version
//   {f}  filename / asset file name
//   {scope}  /scoped  (npm scoped variant only)
// Each entry declares the positional `coords` it needs (for usage + validation)
// and how to build the relative path under the collector prefix.
//
// All per-format endpoints are mounted under  <prefix>/package/-/<fmt>/…
// (confirmed shape from the spec's composer example).
// ---------------------------------------------------------------------------

// Per-format UPLOAD (PUT) and DOWNLOAD (GET) are NOT symmetric (e.g. maven
// uploads by groupId/artifactId/version/file but downloads by
// packageUuid/version/fileUuid). Each direction declares its own positional
// `coords` and a `rel(c)` returning the path suffix (incl. any intrinsic query)
// RELATIVE TO the package base (/registry/{scope}/package) — verified live:
// PUT /registry/project/{o}/{a}/package/generic/{name}/{version}/{file} = 200.
const FORMATS = {
  generic: {
    up:   { coords: ["name", "version", "file"], rel: (c) => `/generic/${enc(c.name)}/${enc(c.version)}/${enc(c.file)}` },
    down: { coords: ["name", "version", "file"], rel: (c) => `/generic/${enc(c.name)}/${enc(c.version)}/${enc(c.file)}` },
  },
  maven: {
    up:   { coords: ["groupId", "artifactId", "version", "file"],
            // groupId is a single dotted path segment (com.example), NOT slashed.
            rel: (c) => `/maven/${enc(c.groupId)}/${enc(c.artifactId)}/${enc(c.version)}/${enc(c.file)}` },
    down: { coords: ["packageUuid", "version", "fileUuid"],
            rel: (c) => `/maven/${enc(c.packageUuid)}/${enc(c.version)}/${enc(c.fileUuid)}/download` },
  },
  // npm: scoped variant supported via --npm-scope <scope>; unscoped by default.
  npm: {
    up:   { coords: ["name", "version", "file"], rel: (c) => npmRel(c) },
    down: { coords: ["name", "version", "file"], rel: (c) => npmRel(c) },
  },
  pypi: {
    up:   { coords: ["name", "version", "file"], rel: (c) => `/pypi/${enc(c.name)}/${enc(c.version)}/${enc(c.file)}` },
    down: { coords: ["name", "version", "file"], rel: (c) => `/pypi/${enc(c.name)}/${enc(c.version)}/${enc(c.file)}` },
  },
  nuget: {
    up:   { coords: [], rel: () => `/nuget` },
    down: { coords: ["name", "version"], rel: (c) => `/nuget/${enc(c.name)}/${enc(c.version)}` },
  },
  composer: {
    up:   { coords: ["version"], rel: (c) => `/composer/${enc(c.version)}` },
    down: { coords: ["groupId", "artifactId", "version"], rel: (c) => `/composer/${enc(c.groupId)}/${enc(c.artifactId)}/${enc(c.version)}` },
  },
  opm: {
    up:   { coords: ["file"], rel: (c) => `/opm/${enc(c.file)}` },
    down: { coords: ["name", "version", "file"], rel: (c) => `/opm/${enc(c.name)}/${enc(c.version)}/${enc(c.file)}` },
  },
  cran: {
    up:   { coords: ["languageVersion", "file"], rel: (c) => `/cran/${enc(c.languageVersion)}/${enc(c.file)}` },
    down: { coords: ["file", "languageVersion", "platform"],
            rel: (c) => `/cran/${enc(c.file)}?languageVersion=${enc(c.languageVersion)}&platform=${enc(c.platform)}` },
  },
  rubygem: {
    up:   { coords: [], rel: () => `/rubygem` },
    down: { coords: ["name", "version"], rel: (c) => `/rubygem/${enc(c.name)}/${enc(c.version)}` },
  },
  cargo: {
    up:   { coords: [], rel: () => `/cargo` },
    down: { coords: ["name", "version"], rel: (c) => `/cargo/${enc(c.name)}/${enc(c.version)}` },
  },
  conda: {
    up:   { coords: ["channel", "file"], rel: (c) => `/conda/${enc(c.file)}?channel=${enc(c.channel)}` },
    down: { coords: ["platform", "file"], rel: (c) => `/conda/${enc(c.platform)}/${enc(c.file)}` },
  },
};

// npm path builder — scoped (--npm-scope) or unscoped.
//   unscoped: /npm/{name}/{version}/{file}
//   scoped:   /npm/{name}/{scope}/{version}/{file}
function npmRel(c) {
  if (c.scope) {
    return `/npm/${enc(c.name)}/${enc(c.scope)}/${enc(c.version)}/${enc(c.file)}`;
  }
  return `/npm/${enc(c.name)}/${enc(c.version)}/${enc(c.file)}`;
}

const FORMAT_NAMES = Object.keys(FORMATS);

// Build a coords object from a coords-name array + positional args.
// Returns { coords, missing }.
function bindCoords(coordNames, positionals) {
  const coords = {};
  const missing = [];
  coordNames.forEach((key, i) => {
    const v = positionals[i];
    if (v === undefined) missing.push(key);
    else coords[key] = v;
  });
  return { coords, missing };
}

// ---------------------------------------------------------------------------
// PACKAGE — management endpoints
// ---------------------------------------------------------------------------

async function pkgList(ctx, _args, flags) {
  const { api, token } = ctx;
  const base = packageBase(api, flags);
  const qs = buildPageQs(flags, { withExtra: flags.type ? { type: flags.type } : null });
  const data = await http("GET", `${base}${qs.size ? "?" + qs : ""}`, token);
  if (resolveFormat(flags, true) === "json") return printJson(data), data;
  // pretty: try a few likely embedded keys; fall back to JSON.
  const list =
    data?._embedded?.packageModelList ||
    data?._embedded?.packageList ||
    data?._embedded?.registryPackageModelList ||
    null;
  if (!Array.isArray(list)) return printJson(data), data;
  if (!list.length) return printEmpty("packages"), data;
  for (const p of list) {
    process.stdout.write(
      `${p.id || "?"}  ${p.name || p.artifactId || "?"}  [${p.type || "?"}]  ${p.version || ""}\n`,
    );
  }
  return data;
}

async function pkgGet(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry package get <packageUuid> [--scope ...] [--company A] [--project o/a]");
  const data = await http("GET", `${packageBase(api, flags)}/${enc(uuid)}`, token);
  printJson(data);
  return data;
}

async function pkgVersions(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry package versions <packageUuid> [--scope ...]");
  const qs = buildPageQs(flags);
  const data = await http(
    "GET",
    `${packageBase(api, flags)}/${enc(uuid)}/version-list${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function pkgVersion(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const version = args[1];
  if (!uuid || !version) die("usage: gitflic registry package version <packageUuid> <version> [--scope ...]");
  const data = await http(
    "GET",
    `${packageBase(api, flags)}/${enc(uuid)}/${enc(version)}`,
    token,
  );
  printJson(data);
  return data;
}

async function pkgFiles(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry package files <packageUuid> [--version <v>] [--scope ...]");
  const qs = buildPageQs(flags, { withExtra: flags.version ? { version: flags.version } : null });
  const data = await http(
    "GET",
    `${packageBase(api, flags)}/${enc(uuid)}/package-file${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function pkgDelete(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry package delete <packageUuid> [--scope ...]");
  const data = await http("POST", `${packageBase(api, flags)}/${enc(uuid)}/delete`, token);
  if (data === null) process.stdout.write(`gitflic: package '${uuid}' deleted\n`);
  else printJson(data);
  return data;
}

async function pkgDeleteVersion(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const version = args[1];
  if (!uuid || !version) die("usage: gitflic registry package delete-version <packageUuid> <version> [--scope ...]");
  const data = await http(
    "POST",
    `${packageBase(api, flags)}/${enc(uuid)}/${enc(version)}/delete`,
    token,
  );
  if (data === null) process.stdout.write(`gitflic: version '${version}' of '${uuid}' deleted\n`);
  else printJson(data);
  return data;
}

async function pkgDeleteFile(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const version = args[1];
  const fileUuid = args[2];
  if (!uuid || !version || !fileUuid)
    die("usage: gitflic registry package delete-file <packageUuid> <version> <fileUuid> [--scope ...]");
  const data = await http(
    "POST",
    `${packageBase(api, flags)}/${enc(uuid)}/${enc(version)}/${enc(fileUuid)}/delete`,
    token,
  );
  if (data === null) process.stdout.write(`gitflic: file '${fileUuid}' deleted\n`);
  else printJson(data);
  return data;
}

// ---------------------------------------------------------------------------
// PACKAGE — per-format upload / download
// ---------------------------------------------------------------------------

function requireFormat(flags) {
  const fmt = flags.format && flags.format !== "json" && flags.format !== "pretty"
    ? flags.format
    : flags.fmt;
  if (!fmt) die(`--format is required; one of: ${FORMAT_NAMES.join(", ")}`);
  if (!FORMATS[fmt]) die(`unknown --format "${fmt}"; one of: ${FORMAT_NAMES.join(", ")}`);
  return fmt;
}

async function pkgUpload(ctx, args, flags) {
  const { api, token } = ctx;
  const fmt = requireFormat(flags);
  const spec = FORMATS[fmt].up;
  // First positional is the local file to upload; the rest are coords.
  const filePath = args[0];
  if (!filePath) {
    die(
      `usage: gitflic registry package upload --fmt ${fmt} [--scope ...] <localFile> ${spec.coords.map((c) => "<" + c + ">").join(" ")}`,
    );
  }
  const positionals = args.slice(1);
  const { coords, missing } = bindCoords(spec.coords, positionals);
  // Convenience: if the format needs a "file" coord and it wasn't supplied,
  // derive it from the local file's basename.
  if (spec.coords.includes("file") && coords.file === undefined) {
    coords.file = filePath.split("/").pop();
    const idx = missing.indexOf("file");
    if (idx >= 0) missing.splice(idx, 1);
  }
  if (flags["npm-scope"]) coords.scope = flags["npm-scope"];
  if (missing.length) {
    die(
      `format "${fmt}" upload needs coords: ${spec.coords.join(" ")} (missing: ${missing.join(", ")})`,
    );
  }
  const url = `${packageBase(api, flags)}${spec.rel(coords)}`;
  const res = await httpUploadFile("PUT", url, token, filePath, {
    contentType: flags["content-type"] || "application/octet-stream",
  });
  if (res === null) process.stdout.write(`gitflic: uploaded ${filePath} -> ${url}\n`);
  else printJson(res);
  return res;
}

async function pkgDownload(ctx, args, flags) {
  const { api, token } = ctx;
  const fmt = requireFormat(flags);
  const spec = FORMATS[fmt].down;
  const { coords, missing } = bindCoords(spec.coords, args);
  if (flags["npm-scope"]) coords.scope = flags["npm-scope"];
  if (missing.length) {
    die(
      `usage: gitflic registry package download --fmt ${fmt} [--scope ...] ${spec.coords.map((c) => "<" + c + ">").join(" ")} [--out <path>] (missing: ${missing.join(", ")})`,
    );
  }
  const url = `${packageBase(api, flags)}${spec.rel(coords)}`;
  const out = flags.out || coords.file || coords.fileUuid || "package.bin";
  const { path, bytes } = await httpDownload(url, token, out);
  process.stdout.write(`gitflic: downloaded ${bytes} bytes -> ${path}\n`);
  return { path, bytes };
}

// composer collect-from-tag (spec-documented, project-scoped only):
//   POST /project/{o}/{a}/package/-/composer?tag={tagName}
async function pkgComposerTag(ctx, args, flags) {
  const { api, token } = ctx;
  const tag = flags.tag || args[0];
  if (!tag) die("usage: gitflic registry package composer-tag --tag <tagName> --project <o/a>");
  const { owner, alias } = projectOwnerAlias(flags);
  const url = `${api}/project/${enc(owner)}/${enc(alias)}/package/-/composer?tag=${enc(tag)}`;
  const res = await http("POST", url, token);
  if (res === null) process.stdout.write(`gitflic: composer package collected from tag '${tag}'\n`);
  else printJson(res);
  return res;
}

// ---------------------------------------------------------------------------
// REPO — management endpoints (Enterprise/Atlas-only; 404 on public SaaS)
// ---------------------------------------------------------------------------

async function repoList(ctx, _args, flags) {
  const { api, token } = ctx;
  const qs = buildPageQs(flags);
  const data = await http("GET", `${repoBase(api, flags)}${qs.size ? "?" + qs : ""}`, token);
  printJson(data);
  return data;
}

async function repoGet(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry repo get <repositoryUuid> [--scope ...]");
  const data = await http("GET", `${repoBase(api, flags)}/${enc(uuid)}`, token);
  printJson(data);
  return data;
}

async function repoCreate(ctx, _args, flags) {
  const { api, token } = ctx;
  // body from registry-repository.txt: title, repositoryType, packageType, description
  const title = flags.title;
  const repositoryType = flags["repository-type"] || flags["repo-type"];
  const packageType = flags["package-type"] || flags["pkg-type"];
  if (!title) die("usage: gitflic registry repo create --title <t> --repository-type LOCAL|PROXY|LOCAL_CACHE|VIRTUAL|TRASH_CAN --package-type <pt> [--description <d>] [--scope ...]");
  const body = { title };
  if (repositoryType) body.repositoryType = repositoryType;
  if (packageType) body.packageType = packageType;
  if (flags.description !== undefined) body.description = flags.description;
  const data = await http("POST", repoBase(api, flags), token, body);
  printJson(data);
  return data;
}

async function repoEdit(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry repo edit <repositoryUuid> [--title <t>] [--repository-type <rt>] [--package-type <pt>] [--description <d>] [--scope ...]");
  // PUT replaces the whole repository — read current and merge so a partial
  // edit doesn't wipe title/repositoryType/packageType/description.
  const cur = await http("GET", `${repoBase(api, flags)}/${enc(uuid)}`, token);
  const body = {
    title: flags.title ?? cur.title,
    repositoryType: (flags["repository-type"] || flags["repo-type"]) ?? cur.repositoryType,
    packageType: (flags["package-type"] || flags["pkg-type"]) ?? cur.packageType,
    description: flags.description ?? cur.description,
  };
  const data = await http("PUT", `${repoBase(api, flags)}/${enc(uuid)}`, token, body);
  printJson(data);
  return data;
}

async function repoDelete(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry repo delete <repositoryUuid> [--scope ...]");
  const data = await http("DELETE", `${repoBase(api, flags)}/${enc(uuid)}`, token);
  if (data === null) process.stdout.write(`gitflic: repository '${uuid}' deleted\n`);
  else printJson(data);
  return data;
}

// REPO — package sub-resources (mirror package management under the repo path)
async function repoPackages(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  if (!uuid) die("usage: gitflic registry repo packages <repositoryUuid> [--type <t>] [--scope ...]");
  const qs = buildPageQs(flags, { withExtra: flags.type ? { type: flags.type } : null });
  const data = await http(
    "GET",
    `${repoBase(api, flags)}/${enc(uuid)}/packages${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function repoPackage(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const pkgUuid = args[1];
  if (!uuid || !pkgUuid) die("usage: gitflic registry repo package <repositoryUuid> <packageUuid> [--scope ...]");
  const data = await http(
    "GET",
    `${repoBase(api, flags)}/${enc(uuid)}/packages/${enc(pkgUuid)}`,
    token,
  );
  printJson(data);
  return data;
}

async function repoPackageVersions(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const pkgUuid = args[1];
  if (!uuid || !pkgUuid) die("usage: gitflic registry repo package-versions <repositoryUuid> <packageUuid> [--scope ...]");
  const qs = buildPageQs(flags);
  const data = await http(
    "GET",
    `${repoBase(api, flags)}/${enc(uuid)}/packages/${enc(pkgUuid)}/version-list${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

async function repoPackageVersion(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const pkgUuid = args[1];
  const version = args[2];
  if (!uuid || !pkgUuid || !version)
    die("usage: gitflic registry repo package-version <repositoryUuid> <packageUuid> <version> [--scope ...]");
  const data = await http(
    "GET",
    `${repoBase(api, flags)}/${enc(uuid)}/packages/${enc(pkgUuid)}/version-list/${enc(version)}`,
    token,
  );
  printJson(data);
  return data;
}

async function repoPackageFiles(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const pkgUuid = args[1];
  if (!uuid || !pkgUuid) die("usage: gitflic registry repo package-files <repositoryUuid> <packageUuid> [--version <v>] [--scope ...]");
  const qs = buildPageQs(flags, { withExtra: flags.version ? { version: flags.version } : null });
  const data = await http(
    "GET",
    `${repoBase(api, flags)}/${enc(uuid)}/packages/${enc(pkgUuid)}/package-file${qs.size ? "?" + qs : ""}`,
    token,
  );
  printJson(data);
  return data;
}

// REPO deletes are GET .../delete per spec.
async function repoDeletePackage(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const pkgUuid = args[1];
  if (!uuid || !pkgUuid) die("usage: gitflic registry repo delete-package <repositoryUuid> <packageUuid> [--scope ...]");
  const data = await http(
    "GET",
    `${repoBase(api, flags)}/${enc(uuid)}/packages/${enc(pkgUuid)}/delete`,
    token,
  );
  if (data === null) process.stdout.write(`gitflic: package '${pkgUuid}' deleted from repo '${uuid}'\n`);
  else printJson(data);
  return data;
}

async function repoDeletePackageVersion(ctx, args, flags) {
  const { api, token } = ctx;
  const uuid = args[0];
  const pkgUuid = args[1];
  const version = args[2];
  if (!uuid || !pkgUuid || !version)
    die("usage: gitflic registry repo delete-package-version <repositoryUuid> <packageUuid> <version> [--scope ...]");
  const data = await http(
    "GET",
    `${repoBase(api, flags)}/${enc(uuid)}/packages/${enc(pkgUuid)}/${enc(version)}/delete`,
    token,
  );
  if (data === null) process.stdout.write(`gitflic: version '${version}' deleted from repo '${uuid}'\n`);
  else printJson(data);
  return data;
}

// REPO per-format upload/download mirror packages, under the repo path with
// a ?nodePath= query selecting the target node/folder.
// Append nodePath as a query param, using & if the URL already has a ?.
function withNodePath(url, flags) {
  if (!flags["node-path"]) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}nodePath=${enc(flags["node-path"])}`;
}

async function repoUpload(ctx, args, flags) {
  const { api, token } = ctx;
  const fmt = requireFormat(flags);
  const spec = FORMATS[fmt].up;
  const uuid = args[0];
  const filePath = args[1];
  if (!uuid || !filePath) {
    die(
      `usage: gitflic registry repo upload --fmt ${fmt} [--scope ...] <repositoryUuid> <localFile> ${spec.coords.map((c) => "<" + c + ">").join(" ")} [--node-path <p>]`,
    );
  }
  const positionals = args.slice(2);
  const { coords, missing } = bindCoords(spec.coords, positionals);
  if (spec.coords.includes("file") && coords.file === undefined) {
    coords.file = filePath.split("/").pop();
    const idx = missing.indexOf("file");
    if (idx >= 0) missing.splice(idx, 1);
  }
  if (flags["npm-scope"]) coords.scope = flags["npm-scope"];
  if (missing.length) {
    die(`format "${fmt}" upload needs coords: ${spec.coords.join(" ")} (missing: ${missing.join(", ")})`);
  }
  const url = withNodePath(`${repoBase(api, flags)}/${enc(uuid)}${spec.rel(coords)}`, flags);
  const res = await httpUploadFile("PUT", url, token, filePath, {
    contentType: flags["content-type"] || "application/octet-stream",
  });
  if (res === null) process.stdout.write(`gitflic: uploaded ${filePath} -> ${url}\n`);
  else printJson(res);
  return res;
}

async function repoDownload(ctx, args, flags) {
  const { api, token } = ctx;
  const fmt = requireFormat(flags);
  const spec = FORMATS[fmt].down;
  const uuid = args[0];
  if (!uuid) {
    die(
      `usage: gitflic registry repo download --fmt ${fmt} [--scope ...] <repositoryUuid> ${spec.coords.map((c) => "<" + c + ">").join(" ")} [--out <path>] [--node-path <p>]`,
    );
  }
  const { coords, missing } = bindCoords(spec.coords, args.slice(1));
  if (flags["npm-scope"]) coords.scope = flags["npm-scope"];
  if (missing.length) {
    die(`format "${fmt}" download needs coords: ${spec.coords.join(" ")} (missing: ${missing.join(", ")})`);
  }
  const url = withNodePath(`${repoBase(api, flags)}/${enc(uuid)}${spec.rel(coords)}`, flags);
  const out = flags.out || coords.file || coords.fileUuid || "package.bin";
  const { path, bytes } = await httpDownload(url, token, out);
  process.stdout.write(`gitflic: downloaded ${bytes} bytes -> ${path}\n`);
  return { path, bytes };
}

// ---------------------------------------------------------------------------
// usage + dispatch
// ---------------------------------------------------------------------------

export const usage = `Registry commands (registry is GLOBAL — pass --scope + --project/--company):

SCOPES
  --scope project --project <owner>/<alias>   (default scope; --project required)
  --scope company --company <companyAlias>
  --scope instance                            (packages: "global"; repos: "instance")

PACKAGE (per-spec "package" section):
  registry package list [--type <t>] [--page N --size N]          List packages (scope-aware)
  registry package get <packageUuid>                              Get one package
  registry package versions <packageUuid> [--page N]              List package versions
  registry package version <packageUuid> <version>               Get one version
  registry package files <packageUuid> [--version <v>]            List package files
  registry package delete <packageUuid>                           Delete package        (POST .../delete)
  registry package delete-version <packageUuid> <version>         Delete a version      (POST .../delete)
  registry package delete-file <packageUuid> <version> <fileUuid> Delete a file         (POST .../delete)
  registry package upload --fmt <fmt> <localFile> <coords...>     Upload artifact (raw PUT) [--content-type] [--npm-scope S]
       coords by fmt: generic/npm/pypi=name version [file]; maven=groupId artifactId version [file];
       composer=version; cran=languageVersion [file]; conda=channel [file]; opm=[file]; nuget/rubygem/cargo=(file only)
  registry package download --fmt <fmt> <coords...> [--out P]     Download artifact (GET)
       coords by fmt: generic/npm/pypi/opm=name version file; maven=packageUuid version fileUuid;
       nuget/rubygem/cargo/composer=name version (composer=groupId artifactId version); cran=file languageVersion platform; conda=platform file
  (NOTE: --fmt, not --format — --format is reserved for json|pretty output)
  registry package composer-tag --tag <tagName>                   Collect Composer pkg from a git tag (POST)

REPO (per-spec "registry-repository" section; Enterprise/Atlas-only — 404 on public SaaS):
  registry repo list [--page N --size N]                          List registry repositories
  registry repo get <uuid>                                        Get one repository
  registry repo create --title <t> --repository-type <rt> --package-type <pt> [--description <d>]
                                                                  Create repository (POST)
                                                                  rt: LOCAL|PROXY|LOCAL_CACHE|VIRTUAL|TRASH_CAN
  registry repo edit <uuid> [--title|--repository-type|--package-type|--description ...]   Edit (PUT)
  registry repo delete <uuid>                                     Delete repository (DELETE)
  registry repo packages <uuid> [--type <t>]                      List packages in a repository
  registry repo package <uuid> <packageUuid>                      Get one package
  registry repo package-versions <uuid> <packageUuid>            List package versions
  registry repo package-version <uuid> <packageUuid> <version>   Get one version
  registry repo package-files <uuid> <packageUuid> [--version V] List package files
  registry repo delete-package <uuid> <packageUuid>              Delete package        (GET .../delete)
  registry repo delete-package-version <uuid> <packageUuid> <version>   Delete version (GET .../delete)
  registry repo upload --format <fmt> <uuid> <localFile> <coords...> [--node-path P]   Upload (raw PUT)
  registry repo download --format <fmt> <uuid> <coords...> [--out P] [--node-path P]   Download (GET)

FORMATS (for upload/download): ${FORMAT_NAMES.join(", ")}
  coords per format:
    generic  <name> <version> [<file>]
    maven    <groupId(dotted)> <artifactId> <version> [<file>]
    npm      <name|@scope/name> [<file>]
    pypi     [<file>]      nuget [<file>]      cran [<file>]      rubygem [<file>]
    composer <name> <version> [<file>]
    opm      <name> <version> [<file>]
    cargo    <name> <version> [<file>]
    conda    <channel/subdir> [<file>]
  (<file> defaults to the basename of the local file on upload)

DEPRECATED (kept for back-compat):
  registry list [--scope ...] [--type ...]   -> alias of 'registry package list'
  registry repos                              -> alias of 'registry repo list --scope instance'

EXAMPLES
  gitflic registry package list --project tikhon/wave
  gitflic registry package list --scope company --company acme --type maven
  gitflic registry package upload --format maven --project tikhon/wave ./app-1.0.jar com.acme app 1.0
  gitflic registry package download --format npm --project tikhon/wave my-pkg my-pkg-1.0.tgz --out ./out.tgz
  gitflic registry repo list --scope instance
`;

export async function handle(ctx, sub, args, flags) {
  switch (sub) {
    case "package":
    case "pkg": {
      const pSub = args[0];
      const pArgs = args.slice(1);
      switch (pSub) {
        case undefined:
        case "list":
          return pkgList(ctx, pArgs, flags);
        case "get":
          return pkgGet(ctx, pArgs, flags);
        case "versions":
          return pkgVersions(ctx, pArgs, flags);
        case "version":
          return pkgVersion(ctx, pArgs, flags);
        case "files":
          return pkgFiles(ctx, pArgs, flags);
        case "delete":
          return pkgDelete(ctx, pArgs, flags);
        case "delete-version":
          return pkgDeleteVersion(ctx, pArgs, flags);
        case "delete-file":
          return pkgDeleteFile(ctx, pArgs, flags);
        case "upload":
          return pkgUpload(ctx, pArgs, flags);
        case "download":
          return pkgDownload(ctx, pArgs, flags);
        case "composer-tag":
          return pkgComposerTag(ctx, pArgs, flags);
        default:
          die(`unknown registry package subcommand: ${pSub}`);
      }
      break;
    }
    case "repo":
    case "repository": {
      const rSub = args[0];
      const rArgs = args.slice(1);
      switch (rSub) {
        case undefined:
        case "list":
          return repoList(ctx, rArgs, flags);
        case "get":
          return repoGet(ctx, rArgs, flags);
        case "create":
          return repoCreate(ctx, rArgs, flags);
        case "edit":
          return repoEdit(ctx, rArgs, flags);
        case "delete":
          return repoDelete(ctx, rArgs, flags);
        case "packages":
          return repoPackages(ctx, rArgs, flags);
        case "package":
          return repoPackage(ctx, rArgs, flags);
        case "package-versions":
          return repoPackageVersions(ctx, rArgs, flags);
        case "package-version":
          return repoPackageVersion(ctx, rArgs, flags);
        case "package-files":
          return repoPackageFiles(ctx, rArgs, flags);
        case "delete-package":
          return repoDeletePackage(ctx, rArgs, flags);
        case "delete-package-version":
          return repoDeletePackageVersion(ctx, rArgs, flags);
        case "upload":
          return repoUpload(ctx, rArgs, flags);
        case "download":
          return repoDownload(ctx, rArgs, flags);
        default:
          die(`unknown registry repo subcommand: ${rSub}`);
      }
      break;
    }
    // ---- back-compat aliases (preserve prior behavior) -------------------
    case undefined:
    case "list":
      // old: `registry list [--scope instance|company|project] [owner/alias]`
      // Map the old positional owner/alias (project scope) into --project.
      if ((flags.scope === "project" || flags.scope === undefined) && args[0] && !flags.project) {
        if (String(args[0]).includes("/")) flags.project = args[0];
      }
      if (flags.scope === "company" && args[0] && !flags.company) {
        flags.company = args[0];
      }
      return pkgList(ctx, args, flags);
    case "repos":
      // old: instance-level repository list
      if (!flags.scope) flags.scope = "instance";
      return repoList(ctx, args, flags);
    default:
      die(`unknown registry subcommand: ${sub}. Use 'package' or 'repo' (see 'gitflic registry help').`);
  }
}
