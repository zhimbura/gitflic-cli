import DefaultTheme from "vitepress/theme";
import "./custom.css";

// Yandex.Metrika SPA pageviews. The base counter (injected in <head> from
// config.mjs) only registers the initial load; VitePress navigates client-side,
// so fire a virtual hit on each route change. Gated on window.__ymId, which is
// set only when a real counter id is configured — so this is a no-op when
// Metrika is disabled. Deduped on path (not hash) so in-page anchor/TOC clicks
// are not counted as separate pageviews.
export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === "undefined") return;
    const pageKey = () => location.pathname + location.search;
    let lastHit = pageKey(); // initial URL is already counted by the base snippet
    const prev = router.onAfterRouteChanged;
    router.onAfterRouteChanged = (to) => {
      if (window.ym && window.__ymId && pageKey() !== lastHit) {
        window.ym(window.__ymId, "hit", location.href);
        lastHit = pageKey();
      }
      return prev ? prev(to) : undefined;
    };
  },
};
