import DefaultTheme from "vitepress/theme";
import "./custom.css";

// --- Soft-404 handling -------------------------------------------------------
// Timeweb App Platform serves the home page HTML (HTTP 200) for any unmatched
// URL (SPA fallback). We can't change the status code from static files, but we
// can mark such fallback URLs `noindex` so crawlers don't treat junk URLs as
// real pages. This complements the canonical tag (which already points these
// URLs at the home page). Detection is safe: only the home page (relativePath
// "index.md") served at a non-home path is a fallback — every real page ships
// its own HTML, so real content pages are never touched.
function markSoftNotFound(router) {
  const data = router.route && router.route.data;
  const rel = data && data.relativePath;
  const p = location.pathname;
  const isHomeDoc = rel === "index.md";
  const isRealHome = p === "/" || p === "/index.html" || p === "";
  if (isHomeDoc && !isRealHome) {
    let m = document.querySelector('meta[name="robots"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "robots");
      document.head.appendChild(m);
    }
    m.setAttribute("content", "noindex, follow");
  }
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === "undefined") return;

    // Yandex.Metrika SPA pageviews: the base counter (in <head>) only registers
    // the initial load; fire a virtual hit on client-side navigation. Deduped on
    // path so anchor/TOC clicks don't count. No-op when Metrika is off
    // (window.__ymId unset).
    const pageKey = () => location.pathname + location.search;
    let lastHit = pageKey();
    const prevHook = router.onAfterRouteChanged;
    router.onAfterRouteChanged = (to) => {
      if (window.ym && window.__ymId && pageKey() !== lastHit) {
        window.ym(window.__ymId, "hit", location.href);
        lastHit = pageKey();
      }
      markSoftNotFound(router);
      return prevHook ? prevHook(to) : undefined;
    };

    // Initial load: run after hydration settles (and once more later) so the
    // change isn't overwritten by VitePress's head render.
    const run = () => markSoftNotFound(router);
    requestAnimationFrame(() => requestAnimationFrame(run));
    setTimeout(run, 800);
  },
};
