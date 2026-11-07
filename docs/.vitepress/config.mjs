import { defineConfig } from "vitepress";
import { writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// gitflic-cli documentation site (VitePress).
// Build:  npm run docs:build  ->  docs/.vitepress/dist  (static, upload to Timeweb)
// Dev:    npm run docs:dev
// Deploy: npm run docs:publish (build + push the built site to the GitHub mirror)

const HOSTNAME = "https://cli-gitflic.ru";
const SITE_TITLE = "gitflic-cli";
// Site-wide fallback description. Kept short (~150 chars) so search snippets are
// not truncated. Per-page descriptions live in each page's frontmatter.
const SITE_DESC =
  "gitflic-cli — консольный клиент (CLI) для GitFlic: 100% покрытие REST API (~199 эндпоинтов, 20 модулей), ноль зависимостей и MCP-сервер для AI-агентов.";
const OG_IMAGE = `${HOSTNAME}/og.png`;

// Yandex.Metrika counter id. Set to your numeric counter to enable analytics;
// while it is 0 the tag is not injected (no broken counter with a fake id).
// SPA route-change hits are fired from the theme (theme/index.js) via window.__ymId.
const YANDEX_METRIKA_ID = 110346937;

// Canonical URL for a page (cleanUrls is OFF, so output is *.html; dir indexes → /dir/).
function canonicalFor(relativePath) {
  const path = relativePath
    .replace(/(^|\/)index\.md$/, "$1") // index.md → "" ; commands/index.md → commands/
    .replace(/\.md$/, ".html");
  return `${HOSTNAME}/${path}`;
}

// Human labels for top-level sections — used to build breadcrumb trails.
const SECTION_LABELS = {
  commands: "Команды",
  auth: "Аутентификация",
  releases: "Релизы и артефакты",
};

// Page titles may carry code spans (backticks) — strip them for schema/breadcrumbs.
const cleanTitle = (t) => (t || "").replace(/`/g, "").replace(/\s+/g, " ").trim();

// BreadcrumbList JSON-LD for a page. Returns null for the home page (a one-item
// breadcrumb is meaningless). Trail: Главная → [Раздел] → Страница.
function breadcrumbFor(relativePath, title) {
  if (relativePath === "index.md") return null;
  const dir = relativePath.includes("/") ? relativePath.split("/")[0] : null;
  const isSectionIndex = dir && relativePath === `${dir}/index.md`;
  const crumbs = [{ name: "Главная", item: `${HOSTNAME}/` }];
  if (dir && SECTION_LABELS[dir] && !isSectionIndex) {
    crumbs.push({ name: SECTION_LABELS[dir], item: `${HOSTNAME}/${dir}/` });
  }
  crumbs.push({
    name: isSectionIndex ? SECTION_LABELS[dir] : cleanTitle(title),
    item: canonicalFor(relativePath),
  });
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };
}

// TechArticle JSON-LD for a documentation page (everything except the home page).
function techArticleFor(relativePath, title, desc, lastUpdated) {
  const canonical = canonicalFor(relativePath);
  const article = {
    "@type": "TechArticle",
    headline: cleanTitle(title),
    description: desc,
    inLanguage: "ru-RU",
    url: canonical,
    mainEntityOfPage: canonical,
    isPartOf: { "@id": `${HOSTNAME}/#website` },
    author: { "@type": "Person", name: "Тихон Устинов (tikhon)" },
    publisher: { "@type": "Organization", name: "gitflic-cli", url: `${HOSTNAME}/` },
  };
  if (lastUpdated) article.dateModified = new Date(lastUpdated).toISOString();
  return article;
}

// Curated FAQ (plain text) for Q&A-shaped pages → FAQPage JSON-LD.
// Yandex surfaces FAQ structured data as quick answers; keep answers self-contained.
const PAGE_FAQ = {
  "known-issues.md": [
    {
      q: "Почему gitflic tag get возвращает HTTP 400 для любого тега?",
      a: "GitFlic REST отдаёт 400 на GET /tag/{name} для любого имени — это поведение API, а не баг CLI. Используйте gitflic tag list с фильтрацией по имени (grep или jq по полю .name).",
    },
    {
      q: "Как удалить тег GitFlic через gitflic-cli?",
      a: "Публичный REST GitFlic не предоставляет эндпоинт удаления тегов. Удаляйте тег средствами git: git push origin :имя-тега.",
    },
    {
      q: "Почему gitflic mr merge падает с MergeCheckException (HTTP 422)?",
      a: "Branch protection GitFlic по умолчанию требует approve от пользователя, который не является автором MR. Получите approve с другой учётной записи или ослабьте защиту ветки через Web UI либо gitflic branch protection edit.",
    },
    {
      q: "Почему gitflic project archive возвращает HTTP 404?",
      a: "Эндпоинт /file/getArchive отключён на публичном api.gitflic.ru — скачивание архива доступно только через Web UI. Вместо архива используйте git clone.",
    },
    {
      q: "Почему загрузка ассета релиза возвращает HTTP 415 (Unsupported Media Type)?",
      a: "GitFlic проверяет тип файла по allowlist на стороне сервера: архивы (.zip) проходят, а .txt, .png и часть типов могут отдавать 415. Упакуйте файл в архив перед gitflic release upload.",
    },
    {
      q: "Почему нельзя отредактировать или удалить команду или компанию (HTTP 405)?",
      a: "У GitFlic нет REST-эндпоинтов для редактирования и удаления команд и компаний — PUT и DELETE возвращают 405. Правьте их через Web UI; для передачи владения командой используйте gitflic team transfer.",
    },
    {
      q: "Почему статусы приходят на русском (Открыт, Слит, Закрыт)?",
      a: "GitFlic локализует часть полей. CLI передаёт Accept-Language: en, но не все эндпоинты это уважают. Для машинной обработки используйте status.id — там всегда английские константы OPENED, MERGED, CLOSED, CANCELED, FAILED.",
    },
    {
      q: "Нужен ли npm install для работы gitflic-cli?",
      a: "Нет. Сам CLI (gitflic) — zero-deps и работает на стандартной библиотеке Node (>=18). npm install нужен только в подпапке mcp-server/, если вы используете MCP-сервер для AI-агентов.",
    },
  ],
};

function faqFor(relativePath) {
  const faq = PAGE_FAQ[relativePath];
  if (!faq) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export default defineConfig({
  lang: "ru-RU",
  title: SITE_TITLE,
  titleTemplate: ":title | gitflic-cli — CLI для GitFlic",
  description: SITE_DESC,
  base: "/",
  // IMPORTANT: keep .html URLs. Timeweb static hosting has no extensionless
  // rewrite and falls back to index.html (the home page) for /clean URLs, which
  // would serve the wrong prerendered HTML to crawlers. .html URLs are served
  // directly with the correct per-page content.
  cleanUrls: false,
  lastUpdated: true,
  ignoreDeadLinks: true,

  // Build-time sitemap.xml (real file at /sitemap.xml, referenced by robots.txt).
  sitemap: {
    hostname: HOSTNAME,
    transformItems(items) {
      // /downloads/ is a standalone static page (docs/public/downloads/), not a
      // VitePress route, so the auto-generated sitemap misses it. Add it so the
      // download landing page is discoverable by crawlers.
      const item = { url: "downloads/" };
      try {
        item.lastmod = statSync("docs/public/downloads/index.html").mtime;
      } catch {}
      items.push(item);
      return items;
    },
  },

  // Site-wide <head>: SEO, Open Graph, Twitter, icons, JSON-LD.
  head: [
    // Favicons. .ico fallback first — Yandex, legacy browsers and many crawlers
    // probe /favicon.ico and don't read SVG favicons; SVG is preferred where supported.
    // .ico packs 16–128; the 192px PNG covers Yandex's ≥120px raster recommendation.
    ["link", { rel: "icon", href: "/favicon.ico", sizes: "any" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/_media/icon.svg" }],
    ["link", { rel: "icon", type: "image/png", sizes: "192x192", href: "/_media/favicon-192x192.png" }],
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/_media/favicon-32x32.png" }],
    ["link", { rel: "icon", type: "image/png", sizes: "16x16", href: "/_media/favicon-16x16.png" }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: "/_media/apple-touch-icon.png" }],
    ["meta", { name: "theme-color", content: "#e8423a" }],
    ["meta", { name: "author", content: "Тихон Устинов (tikhon)" }],
    [
      "meta",
      {
        name: "keywords",
        content:
          "gitflic cli, gitflic-cli, cli gitflic, gitflic, gitflic api, gitflic rest api, gitflic cli tool, gitflic command line, гитфлик cli, gitflic merge request cli, gitflic реестр пакетов cli",
      },
    ],
    ["meta", { name: "robots", content: "index, follow, max-image-preview:large" }],
    // Search engine ownership verification (meta-tag method).
    ["meta", { name: "yandex-verification", content: "2ef893d6e880d22e" }],
    ["meta", { name: "google-site-verification", content: "0a1Mr81i_lcUATVgjpCxn87-DSZ528jLM3PKdXEnJ4s" }],
    // Open Graph
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "gitflic-cli" }],
    ["meta", { property: "og:locale", content: "ru_RU" }],
    ["meta", { property: "og:image", content: OG_IMAGE }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { property: "og:image:alt", content: "gitflic-cli — CLI для GitFlic" }],
    // Twitter
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:image", content: OG_IMAGE }],
    // JSON-LD: WebSite + SoftwareApplication for rich results / AI grounding.
    [
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": `${HOSTNAME}/#website`,
            url: `${HOSTNAME}/`,
            name: "gitflic-cli",
            inLanguage: "ru-RU",
            description: SITE_DESC,
            potentialAction: {
              "@type": "SearchAction",
              target: `${HOSTNAME}/?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@type": "SoftwareApplication",
            name: "gitflic-cli",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Linux, macOS, Windows",
            url: `${HOSTNAME}/`,
            downloadUrl: `${HOSTNAME}/downloads/`,
            softwareVersion: "0.4.0",
            description:
              "Консольный клиент (CLI) для REST API GitFlic — 100% покрытие, ноль зависимостей, MCP-сервер для AI-агентов.",
            featureList: [
              "100% покрытие REST API GitFlic (~199 эндпоинтов, 20 модулей)",
              "Ноль внешних зависимостей (чистый Node ESM ≥18)",
              "MCP-сервер для AI-агентов (Claude Code, Cursor)",
              "Безопасное хранение токенов (Keychain / libsecret)",
              "Merge-реквесты, релизы, задачи, реестр пакетов, CI/CD",
            ],
            author: {
              "@type": "Person",
              name: "Тихон Устинов (tikhon)",
              url: "https://gitflic.ru/user/tikhon",
            },
            sameAs: [
              "https://gitflic.ru/project/tikhon/gitflic-cli",
              "https://www.npmjs.com/package/gitflic-cli",
            ],
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            license: "https://opensource.org/licenses/MIT",
          },
        ],
      }),
    ],
    // Yandex.Metrika (behavioural data + faster crawl). Injected only when a real
    // counter id is set above — see YANDEX_METRIKA_ID.
    ...(YANDEX_METRIKA_ID
      ? [
          ["link", { rel: "preconnect", href: "https://mc.yandex.ru" }],
          [
            "script",
            {},
            `window.__ymId=${YANDEX_METRIKA_ID};(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}","ym");ym(${YANDEX_METRIKA_ID},"init",{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true,referrer:document.referrer,url:location.href});`,
          ],
          [
            "noscript",
            {},
            `<div><img src="https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}" style="position:absolute;left:-9999px" alt="" /></div>`,
          ],
        ]
      : []),
  ],

  // Per-page canonical + OG/Twitter title & description + structured data
  // (BreadcrumbList, TechArticle, and FAQPage where applicable).
  transformPageData(pageData) {
    const canonical = canonicalFor(pageData.relativePath);
    const title = pageData.title
      ? `${pageData.title} | gitflic-cli`
      : "gitflic-cli — CLI для GitFlic";
    const desc =
      pageData.description ||
      pageData.frontmatter.description ||
      SITE_DESC;
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ["link", { rel: "canonical", href: canonical }],
      ["meta", { name: "description", content: desc }],
      ["meta", { property: "og:url", content: canonical }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: desc }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: desc }],
    );

    // Per-page JSON-LD graph: breadcrumb trail, TechArticle, optional FAQ.
    const graph = [];
    const breadcrumb = breadcrumbFor(pageData.relativePath, pageData.title);
    if (breadcrumb) graph.push(breadcrumb);
    if (pageData.relativePath !== "index.md") {
      graph.push(
        techArticleFor(pageData.relativePath, pageData.title, desc, pageData.lastUpdated),
      );
    }
    const faq = faqFor(pageData.relativePath);
    if (faq) graph.push(faq);
    if (graph.length) {
      pageData.frontmatter.head.push([
        "script",
        { type: "application/ld+json" },
        JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      ]);
    }
  },

  // Generate llms.txt-style full corpus for AI assistants alongside the build.
  // (llms.txt index is a curated static file in docs/public/.)
  buildEnd(siteConfig) {
    try {
      const { srcDir, outDir } = siteConfig;
      const files = [];
      const walk = (dir) => {
        for (const e of readdirSync(dir)) {
          if (e.startsWith(".") || e === "public") continue;
          const full = join(dir, e);
          if (statSync(full).isDirectory()) walk(full);
          else if (e.endsWith(".md")) files.push(full);
        }
      };
      walk(srcDir);
      files.sort();
      let full = `# gitflic-cli — полная документация (для LLM)\n\n> ${SITE_DESC}\n> Источник: ${HOSTNAME}/  •  Сгенерировано из docs/.\n\n`;
      for (const f of files) {
        const rel = relative(srcDir, f);
        const url = canonicalFor(rel);
        const body = readFileSync(f, "utf8").replace(/^---\n[\s\S]*?\n---\n/, ""); // strip frontmatter
        full += `\n\n${"=".repeat(80)}\n# ${url}\n${"=".repeat(80)}\n\n${body.trim()}\n`;
      }
      writeFileSync(join(outDir, "llms-full.txt"), full);
    } catch (e) {
      console.warn("llms-full.txt generation skipped:", e.message);
    }
  },

  themeConfig: {
    // Object form gives the nav-bar logo an alt attribute (string form renders alt="").
    logo: { src: "/_media/icon.svg", alt: "gitflic-cli — логотип" },
    siteTitle: "gitflic-cli",

    nav: [
      { text: "Быстрый старт", link: "/quickstart" },
      { text: "Команды", link: "/commands/" },
      { text: "Покрытие API", link: "/api-coverage" },
      { text: "Changelog", link: "/changelog" },
      { text: "Скачать", link: "/downloads/", target: "_self" },
      { text: "GitFlic", link: "https://gitflic.ru/project/tikhon/gitflic-cli" },
    ],

    sidebar: [
      {
        text: "Главное",
        items: [
          { text: "Обзор", link: "/" },
          { text: "Быстрый старт", link: "/quickstart" },
          { text: "Установка", link: "/install" },
        ],
      },
      {
        text: "Аутентификация",
        collapsed: false,
        items: [
          { text: "Обзор", link: "/auth/" },
          { text: "auth login", link: "/auth/login" },
          { text: "Multi-account", link: "/auth/multi-account" },
          { text: "Per-project bindings", link: "/auth/per-project" },
          { text: "Безопасность", link: "/auth/security" },
        ],
      },
      {
        text: "Команды",
        collapsed: false,
        items: [
          { text: "Все команды", link: "/commands/" },
          { text: "Merge Requests", link: "/commands/mr" },
          { text: "Релизы", link: "/commands/release" },
          { text: "Задачи", link: "/commands/issue" },
          { text: "Ветки и теги", link: "/commands/branch-tag" },
          { text: "Коммиты и файлы", link: "/commands/commit-blob" },
          { text: "Проекты", link: "/commands/project" },
          { text: "Пользователи и команды", link: "/commands/user-team" },
          { text: "CI/CD, вебхуки, агенты", link: "/commands/cicd-webhook" },
          { text: "Реестр пакетов", link: "/commands/registry" },
          { text: "Настройки", link: "/commands/settings" },
          { text: "Админ", link: "/commands/admin" },
          { text: "SAML SSO", link: "/commands/saml" },
        ],
      },
      {
        text: "Интеграции",
        collapsed: true,
        items: [
          { text: "MCP-сервер для AI-агентов", link: "/mcp-server" },
          { text: "Git credential helper", link: "/credential-helper" },
        ],
      },
      {
        text: "Разработка",
        collapsed: true,
        items: [
          { text: "Локальная разработка", link: "/development" },
          { text: "Покрытие API", link: "/api-coverage" },
          { text: "Известные проблемы", link: "/known-issues" },
          { text: "Релизы и артефакты", link: "/releases/" },
        ],
      },
      {
        text: "Справка",
        collapsed: true,
        items: [
          { text: "ENV переменные", link: "/env" },
          { text: "Флаги", link: "/flags" },
          { text: "Changelog", link: "/changelog" },
        ],
      },
    ],

    socialLinks: [
      { icon: "git", link: "https://gitflic.ru/project/tikhon/gitflic-cli" },
    ],

    search: { provider: "local" },
    outline: { level: [2, 3], label: "На странице" },
    docFooter: { prev: "Назад", next: "Далее" },
    footer: {
      message: "MIT License",
      copyright: "gitflic-cli — неофициальный пользовательский CLI для GitFlic",
    },
    lastUpdatedText: "Обновлено",
    darkModeSwitchLabel: "Оформление",
    lightModeSwitchTitle: "Светлая тема",
    darkModeSwitchTitle: "Тёмная тема",
    sidebarMenuLabel: "Меню",
    returnToTopLabel: "Наверх",
  },
});
