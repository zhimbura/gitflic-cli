import { defineConfig } from "vitepress";

// gitflic-cli documentation site (VitePress).
// Build:  npm run docs:build  ->  docs/.vitepress/dist  (static, upload to Timeweb)
// Dev:    npm run docs:dev
export default defineConfig({
  lang: "ru-RU",
  title: "gitflic-cli",
  description:
    "Лёгкий CLI без внешних зависимостей для REST API GitFlic — 100% покрытие: MR, релизы, задачи, ветки/теги, коммиты, реестр пакетов, CI/CD, админ. MCP-сервер для AI-агентов.",
  // Timeweb serves the built static site at the domain root.
  base: "/",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/_media/icon.svg" }],
    ["meta", { name: "theme-color", content: "#e8423a" }],
  ],

  themeConfig: {
    logo: "/_media/icon.svg",

    nav: [
      { text: "Быстрый старт", link: "/quickstart" },
      { text: "Команды", link: "/commands/" },
      { text: "Покрытие API", link: "/api-coverage" },
      { text: "Changelog", link: "/changelog" },
      {
        text: "GitFlic",
        link: "https://gitflic.ru/project/tikhon/gitflic-cli",
      },
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
