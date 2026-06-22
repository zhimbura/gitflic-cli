// Pagination helper for project-scoped list endpoints.
//
// Two modes:
//   - single-page (default): buildPageQs() injects ?page=&size= and returns
//     the response unchanged — backward compatible with existing handlers.
//   - auto-page (--all): fetchAllPages() walks the list endpoint, accumulates
//     items, and returns a response in the same shape so existing printers
//     keep working without changes.
//
// All endpoints are assumed to follow GitFlic's HAL-ish list shape:
//   { _embedded: { <key>: [...] }, page: { number, size, totalElements, totalPages } }
// If a particular endpoint deviates, fall back to single-page mode
// (just don't pass --all).

import { http } from "./http.mjs";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGES_HARD_CAP = 200; // safety so a buggy server can't pin us in a loop

export function buildPageQs(flags, { withExtra = null } = {}) {
  const qs = new URLSearchParams();
  if (flags.page !== undefined) qs.set("page", String(flags.page));
  if (flags.size !== undefined) qs.set("size", String(flags.size));
  if (withExtra) {
    for (const [k, v] of Object.entries(withExtra)) {
      if (v === undefined || v === null) continue;
      qs.set(k, String(v));
    }
  }
  return qs;
}

function buildUrl({ api, owner, alias, path }) {
  // Project-scoped: /project/<owner>/<alias><path>
  if (owner && alias) {
    return `${api}/project/${encodeURIComponent(owner)}/${encodeURIComponent(alias)}${path}`;
  }
  // Flat: <api><path> (caller is responsible for path being absolute, e.g. "/company")
  return `${api}${path}`;
}

function extractEmbedded(data, key) {
  return data?._embedded?.[key] || [];
}

/**
 * fetchAllPages — call fetchPage(page) until it returns less than pageSize
 * items or until the server says we've reached totalPages. Returns the
 * accumulated items plus a small meta object.
 *
 *   fetchPage: async (pageNum) => responseBody
 *   embeddedKey: string, where to look inside responseBody._embedded
 *   pageSize: number
 *   maxPages: optional safety cap
 */
export async function fetchAllPages({
  fetchPage,
  embeddedKey,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = MAX_PAGES_HARD_CAP,
}) {
  const all = [];
  let page = 1;
  let pagesFetched = 0;
  let lastData = null;
  let totalCount = null;

  for (let i = 0; i < maxPages; i++) {
    const data = await fetchPage(page);
    pagesFetched++;
    lastData = data;
    const list = extractEmbedded(data, embeddedKey);
    all.push(...list);

    const p = data?.page || data?._page || null;
    if (p && typeof p.totalElements === "number" && totalCount === null) {
      totalCount = p.totalElements;
    }

    // Stop conditions:
    //   1. last page returned fewer items than requested
    //   2. server reports we've reached the final page
    //   3. server returned an empty page
    if (list.length < pageSize) break;
    if (p && typeof p.totalPages === "number" && page >= p.totalPages) break;
    if (list.length === 0) break;

    page++;
  }

  return {
    items: all,
    pages: pagesFetched,
    totalElements: totalCount,
    lastData,
  };
}

/**
 * paginatedList — high-level helper. Single source of truth for the
 * "fetch one list page OR all pages" pattern. Returns an object shaped
 * like a normal GitFlic list response, so the existing printXxxList
 * functions can render it without knowing about pagination.
 *
 * opts:
 *   api, token, owner, alias : required (from ctx)
 *   path      : project-relative path, e.g. "/merge-request/list"
 *   embeddedKey : e.g. "mergeRequestModelList"
 *   flags     : parsed CLI flags (we read flags.all, flags.page, flags.size)
 *   extraQs   : optional object of additional query params (e.g. { status: "OPEN" })
 *   maxPages  : optional safety cap (default 200)
 */
export async function paginatedList({
  api,
  token,
  owner,
  alias,
  path,
  embeddedKey,
  flags = {},
  extraQs = null,
  maxPages = MAX_PAGES_HARD_CAP,
}) {
  // Single-page mode — exactly the previous behavior.
  if (!flags.all) {
    const qs = buildPageQs(flags, { withExtra: extraQs });
    const url = `${buildUrl({ api, owner, alias, path })}${qs.size ? "?" + qs : ""}`;
    return await http("GET", url, token);
  }

  // Auto-paging mode.
  const pageSize = Number(flags.size) || DEFAULT_PAGE_SIZE;
  const { items, pages, totalElements, lastData } = await fetchAllPages({
    fetchPage: async (pageNum) => {
      const qs = new URLSearchParams();
      qs.set("page", String(pageNum));
      qs.set("size", String(pageSize));
      if (extraQs) {
        for (const [k, v] of Object.entries(extraQs)) {
          if (v === undefined || v === null) continue;
          qs.set(k, String(v));
        }
      }
      return http("GET", `${buildUrl({ api, owner, alias, path })}?${qs}`, token);
    },
    embeddedKey,
    pageSize,
    maxPages,
  });

  // Re-shape to match a normal GitFlic list response so existing printers work.
  const embedded = { ...(lastData?._embedded || {}), [embeddedKey]: items };
  const serverPage = lastData?.page || lastData?._page || {};
  return {
    ...(lastData || {}),
    _embedded: embedded,
    page: {
      ...serverPage,
      number: 1,
      size: items.length,
      totalElements: totalElements ?? items.length,
      totalPages: pages,
    },
    _pagination: { pages, pageSize, requestedAll: true },
  };
}
