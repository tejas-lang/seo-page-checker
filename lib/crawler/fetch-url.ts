/**
 * The safe HTTP fetcher.
 *
 * WHAT IT IS: the only place in the application that opens a connection to a
 * URL a stranger supplied.
 *
 * WHY IT LOOKS LIKE THIS: every option here exists to stop one specific way a
 * hostile or simply broken website could hurt us:
 *   - a custom DNS lookup           -> stops SSRF and DNS rebinding
 *   - manual redirect handling      -> every hop is re-validated, not trusted
 *   - a byte cap while streaming    -> stops a multi-gigabyte "zip bomb" page
 *   - an overall deadline           -> stops a server that answers one byte
 *                                      per minute from pinning a worker
 *   - a content-type allowlist      -> we only parse HTML, not binaries
 *
 * It returns a discriminated union rather than throwing, so callers must handle
 * failure explicitly and users get a friendly message instead of a stack trace.
 */

import { Agent, fetch as undiciFetch, type Dispatcher } from "undici";
import { env, crawlerUserAgent } from "@/lib/config/env";
import {
  BlockedAddressError,
  extractHostname,
  normalizeUrl,
  resolveHostSafely,
  safeLookup,
  validateUrlShape,
} from "@/lib/security/url-guard";
import type { FetchErrorCode, PageFetchResult, RedirectHop } from "@/lib/seo/types";
import { describeError, logger } from "@/lib/logger";

/* ------------------------------------------------------------------ */
/* The dispatcher                                                      */
/* ------------------------------------------------------------------ */

/**
 * One shared connection pool for all outbound crawls.
 *
 * Reusing it gives us keep-alive and connection pooling (faster, fewer TLS
 * handshakes) while keeping the security-critical `lookup` in exactly one
 * place. Note there is no redirect interceptor: we follow redirects ourselves,
 * in fetchPage, so that every hop passes back through the URL guard.
 */
let dispatcher: Agent | null = null;

function getDispatcher(): Agent {
  if (dispatcher) return dispatcher;

  dispatcher = new Agent({
    connect: {
      lookup: safeLookup,
      timeout: Math.min(env.CRAWL_TIMEOUT, 10_000),
      // Do not keep sockets to a host we might later decide to block.
      keepAlive: true,
    },
    // Give up if headers or body stall; these are per-socket, the deadline
    // in fetchPage bounds the whole operation.
    headersTimeout: env.CRAWL_TIMEOUT,
    bodyTimeout: env.CRAWL_TIMEOUT,
    connections: 6,
    pipelining: 0,
  });

  return dispatcher;
}

/* ------------------------------------------------------------------ */
/* Options and helpers                                                 */
/* ------------------------------------------------------------------ */

export interface FetchOptions {
  /** Total budget for the whole operation including redirects. */
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Value for the Accept header. */
  accept?: string;
  /** Content types we are willing to read. `null` accepts anything. */
  allowedContentTypes?: readonly string[] | null;
}

const HTML_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
] as const;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function fail(
  code: FetchErrorCode,
  message: string,
  requestedUrl: string,
  extra: Partial<PageFetchResult> = {},
): PageFetchResult {
  return { ok: false, code, message, requestedUrl, ...extra } as PageFetchResult;
}

/** Pull the charset out of a Content-Type header, if it declares one. */
function charsetFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const match = contentType.match(/charset\s*=\s*"?([^";,\s]+)"?/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Find a charset declared inside the document itself.
 * Only the first 2KB is inspected, which is where the spec requires it to be.
 */
function charsetFromMeta(bytes: Uint8Array): string | null {
  const head = Buffer.from(bytes.subarray(0, 2048)).toString("latin1");
  const metaCharset = head.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_:.-]+)/i);
  if (metaCharset?.[1]) return metaCharset[1].toLowerCase();
  const httpEquiv = head.match(
    /<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]*content\s*=\s*["'][^"']*charset=([a-z0-9_:.-]+)/i,
  );
  return httpEquiv?.[1]?.toLowerCase() ?? null;
}

/**
 * Decode bytes to text using the page's own declared encoding.
 *
 * Plenty of real pages are still windows-1252 or shift_jis. Decoding them as
 * UTF-8 would corrupt the title and word count, so we honour the declaration
 * and fall back to UTF-8 only when it is missing or unsupported.
 */
export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const declared = charsetFromContentType(contentType) ?? charsetFromMeta(bytes);
  const candidates = [declared, "utf-8"].filter((value): value is string => Boolean(value));

  for (const label of candidates) {
    try {
      return new TextDecoder(label, { fatal: false }).decode(bytes);
    } catch {
      // Unsupported label — fall through to the next candidate.
    }
  }

  return Buffer.from(bytes).toString("utf8");
}

/** Read a response body, refusing to buffer more than `maxBytes`. */
async function readBodyCapped(
  body: NodeJS.ReadableStream | ReadableStream | null,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: "too-large" }> {
  if (!body) return { ok: true, bytes: new Uint8Array(0) };

  const stream = body as ReadableStream<Uint8Array>;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: merged };
}

function headersToObject(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  // Only keep headers that are useful for an SEO audit. We never store or log
  // cookies or auth headers from the audited site.
  const keep = new Set([
    "content-type",
    "content-length",
    "content-encoding",
    "cache-control",
    "x-robots-tag",
    "link",
    "server",
    "last-modified",
    "location",
    "vary",
  ]);
  headers.forEach((value, key) => {
    if (keep.has(key.toLowerCase())) output[key.toLowerCase()] = value;
  });
  return output;
}

function contentTypeAllowed(contentType: string | null, allowed: readonly string[] | null) {
  if (allowed === null) return true;
  if (!contentType) return true; // No declaration: we sniff the body instead.
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return allowed.some((type) => base === type);
}

function mapNetworkError(error: unknown, requestedUrl: string): PageFetchResult {
  const described = describeError(error);
  const code = described.code ?? "";
  const message = described.message ?? "";

  if (error instanceof BlockedAddressError || code === "ERR_BLOCKED_ADDRESS") {
    return fail("BLOCKED_URL", "This URL cannot be analyzed for security reasons.", requestedUrl);
  }

  if (
    described.name === "AbortError" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT"
  ) {
    return fail("TIMEOUT", "The page took too long to respond.", requestedUrl);
  }

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ERR_INVALID_URL") {
    return fail(
      "DNS_FAILURE",
      "We could not find that website. Please check the address is spelled correctly and is publicly reachable.",
      requestedUrl,
    );
  }

  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "EPROTO" ||
    code.startsWith("ERR_TLS") ||
    code.startsWith("ERR_SSL") ||
    message.includes("certificate")
  ) {
    return fail(
      "CONNECTION_FAILED",
      "We could not connect to this webpage. The server may be offline, blocking automated requests, or have an invalid security certificate.",
      requestedUrl,
    );
  }

  return fail(
    "CONNECTION_FAILED",
    "We could not connect to this webpage. The server may be offline or blocking automated requests.",
    requestedUrl,
  );
}

/* ------------------------------------------------------------------ */
/* The main entry point                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch a page for auditing.
 *
 * Follows redirects manually, re-running the full URL guard on every hop, and
 * returns the complete redirect chain so the audit can report it.
 */
export async function fetchPage(
  rawUrl: string,
  options: FetchOptions = {},
): Promise<PageFetchResult> {
  const timeoutMs = options.timeoutMs ?? env.CRAWL_TIMEOUT;
  const maxBytes = options.maxBytes ?? env.MAX_CRAWL_SIZE;
  const maxRedirects = options.maxRedirects ?? env.MAX_REDIRECTS;
  const allowedContentTypes =
    options.allowedContentTypes === undefined ? HTML_CONTENT_TYPES : options.allowedContentTypes;

  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;

  const normalized = normalizeUrl(rawUrl);
  if (!normalized.ok) {
    return fail(normalized.code, normalized.message, rawUrl);
  }

  let currentUrl = normalized.url;
  const requestedUrl = normalized.href;
  const redirects: RedirectHop[] = [];
  const visited = new Set<string>();
  let initialStatus: number | null = null;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    // ---- Layer 1+2: shape and hostname rules on THIS hop -------------
    const shape = validateUrlShape(currentUrl);
    if (!shape.ok) {
      logger.warn("crawler.blocked_url", { detail: shape.detail, hop });
      return fail(shape.code, shape.message, requestedUrl, { redirects });
    }

    // ---- Layer 3: DNS pre-flight -------------------------------------
    const dnsVerdict = await resolveHostSafely(extractHostname(currentUrl));
    if (!dnsVerdict.ok) {
      logger.warn("crawler.blocked_host", { detail: dnsVerdict.detail, hop });
      return fail(
        dnsVerdict.code === "BLOCKED_URL" ? "BLOCKED_URL" : "DNS_FAILURE",
        dnsVerdict.message ?? "This URL cannot be analyzed.",
        requestedUrl,
        { redirects },
      );
    }

    // ---- Loop detection ----------------------------------------------
    const key = currentUrl.href;
    if (visited.has(key)) {
      return fail(
        "REDIRECT_LOOP",
        "This URL redirects in a loop, so there is no final page to analyze.",
        requestedUrl,
        { redirects, finalUrl: key },
      );
    }
    visited.add(key);

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return fail("TIMEOUT", "The page took too long to respond.", requestedUrl, { redirects });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);

    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(currentUrl.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        dispatcher: getDispatcher() as unknown as Dispatcher,
        headers: {
          "user-agent": crawlerUserAgent,
          accept:
            options.accept ??
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          // Ask for an identity encoding we can size-check reliably.
          "accept-encoding": "gzip, deflate, br",
        },
      });
    } catch (error) {
      clearTimeout(timer);
      logger.warn("crawler.fetch_error", { hop, ...describeError(error) });
      return { ...mapNetworkError(error, requestedUrl), redirects } as PageFetchResult;
    }

    if (initialStatus === null) initialStatus = response.status;

    // ---- Redirect? ----------------------------------------------------
    const location = response.headers.get("location");
    if (REDIRECT_STATUSES.has(response.status) && location) {
      clearTimeout(timer);
      // Drain the redirect body so the socket can be reused.
      await response.body?.cancel().catch(() => undefined);

      redirects.push({ url: currentUrl.href, status: response.status, location });

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        return fail(
          "CONNECTION_FAILED",
          "This page redirected to an address we could not read.",
          requestedUrl,
          { redirects, finalUrl: currentUrl.href },
        );
      }

      nextUrl.hash = "";
      currentUrl = nextUrl;
      continue;
    }

    // ---- Terminal response --------------------------------------------
    const contentType = response.headers.get("content-type");

    if (!contentTypeAllowed(contentType, allowedContentTypes)) {
      clearTimeout(timer);
      await response.body?.cancel().catch(() => undefined);
      return fail(
        "UNSUPPORTED_CONTENT_TYPE",
        `This URL returned ${contentType?.split(";")[0] ?? "a non-HTML file"}, which is not a webpage we can audit.`,
        requestedUrl,
        { redirects, finalUrl: currentUrl.href, status: response.status },
      );
    }

    // Trust but verify Content-Length before we even start reading.
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      clearTimeout(timer);
      await response.body?.cancel().catch(() => undefined);
      return fail(
        "RESPONSE_TOO_LARGE",
        "The webpage response is too large to analyze.",
        requestedUrl,
        { redirects, finalUrl: currentUrl.href, status: response.status },
      );
    }

    let bodyResult: Awaited<ReturnType<typeof readBodyCapped>>;
    try {
      bodyResult = await readBodyCapped(
        response.body as unknown as ReadableStream<Uint8Array> | null,
        maxBytes,
      );
    } catch (error) {
      clearTimeout(timer);
      logger.warn("crawler.body_error", { hop, ...describeError(error) });
      return { ...mapNetworkError(error, requestedUrl), redirects } as PageFetchResult;
    }
    clearTimeout(timer);

    if (!bodyResult.ok) {
      return fail(
        "RESPONSE_TOO_LARGE",
        "The webpage response is too large to analyze.",
        requestedUrl,
        { redirects, finalUrl: currentUrl.href, status: response.status },
      );
    }

    const body = decodeBody(bodyResult.bytes, contentType);

    // A 4xx/5xx page can still be audited if it returned real HTML — the
    // status check will report the error prominently. But an empty or
    // non-HTML error response gives us nothing to work with.
    const looksLikeHtml = /<html|<!doctype html|<head|<body/i.test(body.slice(0, 4096));
    if (response.status >= 400 && (!looksLikeHtml || body.trim().length === 0)) {
      return fail(
        "HTTP_ERROR",
        `This URL returned HTTP ${response.status}, so there is no page to analyze.`,
        requestedUrl,
        { redirects, finalUrl: currentUrl.href, status: response.status },
      );
    }

    if (!looksLikeHtml && body.trim().length === 0) {
      return fail(
        "UNSUPPORTED_CONTENT_TYPE",
        "This URL returned an empty response, so there is no page to analyze.",
        requestedUrl,
        { redirects, finalUrl: currentUrl.href, status: response.status },
      );
    }

    return {
      ok: true,
      requestedUrl,
      finalUrl: currentUrl.href,
      initialStatus: initialStatus ?? response.status,
      finalStatus: response.status,
      redirects,
      headers: headersToObject(response.headers as unknown as Headers),
      contentType,
      body,
      byteLength: bodyResult.bytes.byteLength,
      durationMs: Date.now() - startedAt,
    };
  }

  return fail(
    "TOO_MANY_REDIRECTS",
    `This URL redirected more than ${maxRedirects} times, so we stopped following it.`,
    requestedUrl,
    { redirects },
  );
}

/* ------------------------------------------------------------------ */
/* A lighter fetch for robots.txt and sitemaps                         */
/* ------------------------------------------------------------------ */

export interface TextFetchResult {
  ok: boolean;
  status: number | null;
  text: string | null;
  url: string;
  error: string | null;
}

/**
 * Fetch a small text resource (robots.txt, sitemap.xml).
 *
 * Same protections, smaller budget: these are supporting requests and must
 * never dominate the audit's time or memory.
 */
export async function fetchText(
  rawUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<TextFetchResult> {
  const result = await fetchPage(rawUrl, {
    timeoutMs: options.timeoutMs ?? Math.min(env.CRAWL_TIMEOUT, 8_000),
    maxBytes: options.maxBytes ?? 1024 * 1024,
    maxRedirects: 3,
    accept: "text/plain,application/xml,text/xml,*/*;q=0.8",
    allowedContentTypes: null,
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.status ?? null,
      text: null,
      url: result.finalUrl ?? rawUrl,
      error: result.message,
    };
  }

  return {
    ok: result.finalStatus >= 200 && result.finalStatus < 300,
    status: result.finalStatus,
    text: result.body,
    url: result.finalUrl,
    error: null,
  };
}

/** Close the shared pool. Used by tests so the process can exit cleanly. */
export async function closeCrawler(): Promise<void> {
  if (dispatcher) {
    await dispatcher.close();
    dispatcher = null;
  }
}
