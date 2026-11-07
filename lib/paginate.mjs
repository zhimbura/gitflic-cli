// Shared pagination for HAL lists and top-level collections such as commitBlobs.
import { createHash } from "node:crypto";
import { http } from "./http.mjs";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGES_HARD_CAP = 200;

export function buildPageQs(flags, { withExtra = null } = {}) {
  const qs = new URLSearchParams();
  for (const key of ["page", "size"]) {
    if (flags[key] === undefined) continue;
    const value = Number(flags[key]);
    if (!Number.isInteger(value) || value < (key === "page" ? 0 : 1)) {
      throw new Error(`--${key} must be an integer >= ${key === "page" ? 0 : 1}`);
    }
    qs.set(key, String(value));
  }
  for (const [key, value] of Object.entries(withExtra || {})) {
    if (value !== undefined && value !== null) qs.set(key, String(value));
  }
  return qs;
}

function buildUrl({ api, owner, alias, path }) {
  if (owner && alias) {
    return `${api}/project/${encodeURIComponent(owner)}/${encodeURIComponent(alias)}${path}`;
  }
  return `${api}${path}`;
}

function extractItems(data, embeddedKey, itemsKey) {
  const items = itemsKey ? data?.[itemsKey] : data?._embedded?.[embeddedKey];
  if (items === undefined && data?.page?.totalElements === 0) return [];
  if (!Array.isArray(items)) throw new Error("Pagination response has no expected collection");
  return items;
}

function pageInfo(data, count, page, requestedSize) {
  const metadata = data?.page || data?._page || {};
  if (metadata.number !== undefined && metadata.number !== page) {
    throw new Error(`Requested page ${page}, received page ${metadata.number}`);
  }
  let hasMore;
  if (Number.isInteger(metadata.totalPages)) {
    hasMore = page + 1 < metadata.totalPages;
  } else {
    const actualSize = metadata.size > 0 ? metadata.size : requestedSize;
    hasMore = count >= actualSize && count > 0;
  }
  return { hasMore, totalElements: metadata.totalElements ?? null };
}

export async function fetchAllPages({
  fetchPage,
  embeddedKey,
  itemsKey = null,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = MAX_PAGES_HARD_CAP,
  onPage = null,
}) {
  const items = [];
  let lastData = null;
  let totalElements = null;
  let returnedCount = 0;
  let complete = false;
  let nextPage = 0;
  const seenPages = new Set();
  let pages = 0;
  for (let page = 0; page < maxPages; page++) {
    const data = await fetchPage(page);
    const list = extractItems(data, embeddedKey, itemsKey);
    const info = pageInfo(data, list.length, page, pageSize);
    if (totalElements !== null && info.totalElements !== null && info.totalElements !== totalElements) {
      throw new Error("Collection changed during pagination; retry the request");
    }
    totalElements = info.totalElements ?? totalElements;
    const signature = createHash("sha256").update(JSON.stringify(list)).digest("hex");
    if (list.length && seenPages.has(signature)) {
      throw new Error("Server repeated a page during pagination");
    }
    seenPages.add(signature);
    returnedCount += list.length;
    if (onPage) await onPage(list);
    else items.push(...list);
    lastData = data;
    pages++;
    nextPage = info.hasMore ? page + 1 : null;
    if (!info.hasMore || list.length === 0) {
      complete = !info.hasMore && (totalElements === null || returnedCount === totalElements);
      break;
    }
  }
  return { items, pages, totalElements, lastData, complete, nextPage };
}

export async function paginatedList({
  api, token, owner, alias, path, embeddedKey, itemsKey = null,
  flags = {}, extraQs = null, maxPages = MAX_PAGES_HARD_CAP, stream,
}) {
  buildPageQs(flags);
  const base = buildUrl({ api, owner, alias, path });
  const wantStream = stream ?? (flags.stream === true || process.env.GITFLIC_STREAM === "1");
  if (!flags.all && !wantStream) {
    const qs = buildPageQs(flags, { withExtra: extraQs });
    const data = await http("GET", `${base}${qs.size ? "?" + qs : ""}`, token);
    const list = extractItems(data, embeddedKey, itemsKey);
    const page = Number(flags.page ?? 0);
    const info = pageInfo(data, list.length, page, Number(flags.size) || DEFAULT_PAGE_SIZE);
    return {
      ...data,
      _pagination: {
        pages: 1, pageSize: data.page?.size ?? Number(flags.size ?? DEFAULT_PAGE_SIZE),
        requestedAll: false,
        complete: page === 0 && !info.hasMore &&
          (info.totalElements === null || list.length === info.totalElements),
        nextPage: info.hasMore ? page + 1 : null,
      },
    };
  }

  const pageSize = Number(flags.size) || DEFAULT_PAGE_SIZE;
  const result = await fetchAllPages({
    embeddedKey, itemsKey, pageSize, maxPages,
    fetchPage: page => {
      const qs = buildPageQs({ page, size: pageSize }, { withExtra: extraQs });
      return http("GET", `${base}?${qs}`, token);
    },
    onPage: wantStream ? list => {
      for (const item of list) process.stdout.write(JSON.stringify(item) + "\n");
    } : null,
  });
  if (wantStream) {
    if (!result.complete) throw new Error("Stream ended before the complete collection was retrieved");
    return null;
  }
  const collection = itemsKey
    ? { [itemsKey]: result.items }
    : { _embedded: { ...(result.lastData?._embedded || {}), [embeddedKey]: result.items } };
  return {
    ...(result.lastData || {}),
    ...collection,
    page: {
      number: 0, size: result.items.length,
      totalElements: result.totalElements ?? result.items.length,
      totalPages: result.pages,
    },
    _pagination: {
      pages: result.pages, pageSize, requestedAll: true,
      complete: result.complete, nextPage: result.nextPage,
    },
  };
}
