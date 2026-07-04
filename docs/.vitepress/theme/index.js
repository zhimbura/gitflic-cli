import DefaultTheme from "vitepress/theme";
import "./custom.css";

// --- Soft-404 handling -------------------------------------------------------
// Timeweb App Platform serves the home page HTML (HTTP 200) for any unmatched
// URL (SPA fallback). VitePress then client-renders its 404 view, but the
// site-wide `robots` meta (index) stays, so junk URLs still read as indexable.
// We can't change the HTTP status from static files, but we can flag unknown
// routes `noindex` so crawlers don't treat them as real pages — this complements
// the canonical tag, which already points these URLs at the home page.
//
// A route is "known" iff its VitePress page-file key is in window.__VP_HASH_MAP__
// (the built route table). Verified against home, /index.html, /dir/, *.html and
// junk URLs. The standalone /downloads/ page has no VitePress bundle, so this
// code never runs there; and if __VP_HASH_MAP__ is ever absent we no-op, so a
// real page can never be wrongly de-indexed.
let validKeys = null;
let normalRobots = null;

function isKnownRoute() {
  const map = window.__VP_HASH_MAP__;
  if (!map) return null; // can't tell → leave robots untouched
  if (!validKeys) validKeys = new Set(Object.keys(map).map((k) => k.toLowerCase()));
  let p = location.pathname.replace(/^\//, "");
  if (p === "" || p.endsWith("/")) p += "index.html";
  p = p.replace(/\.html$/, "");
  if (!p.endsWith(".md")) p += ".md";
  return validKeys.has(p.replace(/\//g, "_").toLowerCase());
}

function updateRobots() {
  const known = isKnownRoute();
  if (known === null) return;
  let m = document.querySelector('meta[name="robots"]');
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", "robots");
    document.head.appendChild(m);
  }
  if (normalRobots === null) normalRobots = m.getAttribute("content") || "index, follow";
  m.setAttribute("content", known ? normalRobots : "noindex, follow");
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === "undefined") return;

    // Yandex.Metrika SPA pageviews (base counter in <head> only tracks the first
    // load) + soft-404 robots, re-evaluated on every client route change.
    const pageKey = () => location.pathname + location.search;
    let lastHit = pageKey();
    const prevHook = router.onAfterRouteChanged;
    router.onAfterRouteChanged = (to) => {
      if (window.ym && window.__ymId && pageKey() !== lastHit) {
        window.ym(window.__ymId, "hit", location.href);
        lastHit = pageKey();
      }
      updateRobots();
      return prevHook ? prevHook(to) : undefined;
    };

    // Initial load: after hydration settles (and once more later) so VitePress's
    // head render doesn't overwrite the change.
    requestAnimationFrame(() => requestAnimationFrame(updateRobots));
    setTimeout(updateRobots, 800);
  },
};
