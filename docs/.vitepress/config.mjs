import { defineConfig } from "vitepress";
import { writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// gitflic-cli documentation site (VitePress).
// Build:  npm run docs:build  ->  docs/.vitepress/dist  (static, upload to Timeweb)
// Dev:    npm run docs:dev
// Deploy: npm run docs:publish (build + push the built site to the GitHub mirror)

const HOSTNAME = "https://cli-gitflic.ru";
const SITE_TITLE = "gitflic-cli";
const SITE_DESC =
  "gitflic-cli — консольный клиент (CLI) для GitFlic (gitflic.ru): 100% покрытие REST API (~199 эндпоинтов, 20 модулей) — merge-реквесты, релизы, задачи, ветки, теги, реестр пакетов, CI/CD. Без зависимостей, с MCP-сервером для AI-агентов.";
const OG_IMAGE = `${HOSTNAME}/og.png`;

// Canonical URL for a page (cleanUrls is OFF, so output is *.html; dir indexes → /dir/).
function canonicalFor(relativePath) {
  const path = relativePath
    .replace(/(^|\/)index\.md$/, "$1") // index.md → "" ; commands/index.md → commands/
    .replace(/\.md$/, ".html");
  return `${HOSTNAME}/${path}`;
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
  sitemap: { hostname: HOSTNAME },

  // Site-wide <head>: SEO, Open Graph, Twitter, icons, JSON-LD.
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/_media/icon.svg" }],
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
            softwareVersion: "0.3.0",
            description:
              "Консольный клиент (CLI) для REST API GitFlic — 100% покрытие, ноль зависимостей, MCP-сервер для AI-агентов.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            license: "https://opensource.org/licenses/MIT",
          },
        ],
      }),
    ],
  ],

  // Per-page canonical + OG/Twitter title & description.
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
    logo: "/_media/icon.svg",
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
