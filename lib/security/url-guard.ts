/**
 * URL validation and SSRF protection.
 *
 * WHAT IT IS: the gatekeeper every user-supplied URL passes through before the
 * server is allowed to open a connection to it.
 *
 * WHY WE NEED IT: SSRF (Server-Side Request Forgery) is the attack where
 * someone gives our server a URL that points at something only our server can
 * reach — a cloud metadata endpoint, a database admin panel on a private IP,
 * another service inside the same network — and we fetch it and hand the
 * response back. Because we return page contents to the user, an unprotected
 * fetcher is effectively a proxy into our own infrastructure.
 *
 * HOW IT WORKS — four layers, in order:
 *   1. Shape:    only http/https, no credentials, sane ports, real hostname.
 *   2. Name:     reject hostnames reserved for local/internal use.
 *   3. Address:  resolve DNS and reject any answer that is not public.
 *   4. Connect:  re-validate at socket-connect time (see `safeLookup`), which
 *                closes the DNS-rebinding window between steps 3 and 4.
 *
 * Layer 4 is the one people usually forget. Without it, a hostname can return
 * a public IP when we check it and a private IP a millisecond later when we
 * actually connect.
 */

import dns from "node:dns";
import net from "node:net";
import { classifyAddress } from "./ip";
import { env } from "@/lib/config/env";

/** Protocols we will ever fetch. Everything else is refused outright. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Ports we will connect to. Restricting ports is defence-in-depth: even if a
 * hostname somehow slipped through the IP checks, it could not be used to
 * probe arbitrary internal services.
 */
const ALLOWED_PORTS = new Set([80, 443]);

/**
 * Top-level labels reserved for local, internal or special use.
 * Note this matches the LAST label only, so `example.com` is unaffected by the
 * reserved `.example` TLD.
 */
const BLOCKED_TLDS = new Set([
  "localhost",
  "local",
  "internal",
  "intranet",
  "lan",
  "home",
  "corp",
  "private",
  "arpa",
  "onion",
  "test",
  "invalid",
  "example",
  "alt",
]);

/** Hostnames that are always refused regardless of what DNS says. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "metadata",
]);

export type UrlRejectionCode = "INVALID_URL" | "BLOCKED_URL";

export interface UrlRejection {
  ok: false;
  code: UrlRejectionCode;
  /** Safe to show a user. Never reveals internal network details. */
  message: string;
  /** Developer-facing detail, for server logs only. */
  detail: string;
}

export interface UrlAcceptance {
  ok: true;
  url: URL;
  /** The normalised absolute URL string. */
  href: string;
}

export type UrlValidation = UrlAcceptance | UrlRejection;

function reject(code: UrlRejectionCode, message: string, detail: string): UrlRejection {
  return { ok: false, code, message, detail };
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Does this string already carry an explicit scheme?
 *
 * We must not confuse `example.com:8080/path` (a host and port) with
 * `javascript:alert(1)` (a scheme). The rule: a scheme is followed by `//`,
 * or it is a single word with no dots before the colon.
 */
function hasExplicitScheme(input: string): boolean {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return true;
  const match = input.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!match) return false;
  const scheme = match[1] ?? "";
  // "example.com:8080" -> not a scheme. "mailto:" / "javascript:" -> scheme.
  return !scheme.includes(".");
}

/**
 * Turn what a human typed into a URL object.
 *
 * Deliberately conservative: we add `https://` when no scheme is present
 * (`example.com` -> `https://example.com`) because that is what people mean,
 * but we never rewrite anything else about the URL. Query strings are
 * preserved exactly — they often identify the page.
 */
export function normalizeUrl(rawInput: string): UrlValidation {
  const input = rawInput.trim();

  if (input === "") {
    return reject("INVALID_URL", "Please enter a webpage URL.", "empty input");
  }

  if (input.length > 2048) {
    return reject("INVALID_URL", "That URL is too long to analyze.", "url exceeds 2048 chars");
  }

  // Control characters and whitespace inside a URL are almost always an attempt
  // to confuse a parser.
  if (/[\u0000-\u0020\u007f]/.test(input)) {
    return reject(
      "INVALID_URL",
      "That URL contains characters we cannot process. Please check it and try again.",
      "control characters or whitespace in url",
    );
  }

  const candidate = hasExplicitScheme(input) ? input : `https://${input}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return reject(
      "INVALID_URL",
      "Please enter a valid public HTTP or HTTPS URL.",
      "URL constructor threw",
    );
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return reject(
      "BLOCKED_URL",
      "Only http:// and https:// addresses can be analyzed.",
      `blocked protocol: ${url.protocol}`,
    );
  }

  if (url.username !== "" || url.password !== "") {
    return reject(
      "BLOCKED_URL",
      "URLs containing a username or password cannot be analyzed.",
      "credentials present in url",
    );
  }

  // The fragment never reaches the server, so drop it before we compare URLs.
  url.hash = "";

  return { ok: true, url, href: url.href };
}

/* ------------------------------------------------------------------ */
/* Hostname rules (applied before any DNS lookup)                      */
/* ------------------------------------------------------------------ */

/** Strip the brackets the URL parser puts around IPv6 literals. */
export function extractHostname(url: URL): string {
  const host = url.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return host;
}

export function validateUrlShape(url: URL): UrlValidation {
  const hostname = extractHostname(url);

  if (hostname === "") {
    return reject("INVALID_URL", "That URL does not include a website address.", "empty hostname");
  }

  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port);

  if (!ALLOWED_PORTS.has(port)) {
    return reject(
      "BLOCKED_URL",
      "Only standard web ports (80 and 443) can be analyzed.",
      `blocked port: ${port}`,
    );
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return reject(
      "BLOCKED_URL",
      "This URL cannot be analyzed for security reasons.",
      `blocked hostname: ${hostname}`,
    );
  }

  const isIpLiteral = net.isIP(hostname) !== 0;

  if (isIpLiteral) {
    const verdict = classifyAddress(hostname);
    if (!verdict.allowed && !env.ALLOW_PRIVATE_NETWORK_TARGETS) {
      return reject(
        "BLOCKED_URL",
        "This URL cannot be analyzed for security reasons.",
        `blocked ip literal: ${hostname} (${verdict.reason})`,
      );
    }
    return { ok: true, url, href: url.href };
  }

  // A hostname with no dot resolves through local search domains — it is an
  // intranet name, not a public website.
  if (!hostname.includes(".")) {
    if (env.ALLOW_PRIVATE_NETWORK_TARGETS) return { ok: true, url, href: url.href };
    return reject(
      "BLOCKED_URL",
      "Please enter a full public website address, for example https://example.com/page.",
      `single-label hostname: ${hostname}`,
    );
  }

  const labels = hostname.split(".").filter(Boolean);
  const tld = labels[labels.length - 1] ?? "";

  if (BLOCKED_TLDS.has(tld) && !env.ALLOW_PRIVATE_NETWORK_TARGETS) {
    return reject(
      "BLOCKED_URL",
      "This URL cannot be analyzed for security reasons.",
      `reserved tld: .${tld}`,
    );
  }

  // ".home.arpa" is caught by the .arpa rule above; this catches the rest of
  // the multi-label internal conventions.
  if (hostname.endsWith(".localhost") && !env.ALLOW_PRIVATE_NETWORK_TARGETS) {
    return reject(
      "BLOCKED_URL",
      "This URL cannot be analyzed for security reasons.",
      `localhost subdomain: ${hostname}`,
    );
  }

  return { ok: true, url, href: url.href };
}

/** Shape + hostname validation in one call. Does no network I/O. */
export function validateUrl(rawInput: string): UrlValidation {
  const normalized = normalizeUrl(rawInput);
  if (!normalized.ok) return normalized;
  return validateUrlShape(normalized.url);
}

/* ------------------------------------------------------------------ */
/* DNS resolution                                                      */
/* ------------------------------------------------------------------ */

export interface DnsVerdict {
  ok: boolean;
  addresses: string[];
  code?: "DNS_FAILURE" | "BLOCKED_URL";
  message?: string;
  detail?: string;
}

/**
 * Resolve a hostname and require that EVERY answer is a public address.
 *
 * We check every address, not just the first one. A hostname that returns one
 * public and one private address must be refused: which one gets used is an
 * implementation detail of the resolver, not something we control.
 */
export async function resolveHostSafely(hostname: string): Promise<DnsVerdict> {
  if (env.ALLOW_PRIVATE_NETWORK_TARGETS) {
    return { ok: true, addresses: [] };
  }

  if (net.isIP(hostname) !== 0) {
    const verdict = classifyAddress(hostname);
    return verdict.allowed
      ? { ok: true, addresses: [hostname] }
      : {
          ok: false,
          addresses: [],
          code: "BLOCKED_URL",
          message: "This URL cannot be analyzed for security reasons.",
          detail: `blocked ip literal: ${hostname} (${verdict.reason})`,
        };
  }

  let records: dns.LookupAddress[];
  try {
    records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code ?? "UNKNOWN";
    return {
      ok: false,
      addresses: [],
      code: "DNS_FAILURE",
      message:
        "We could not find that website. Please check the address is spelled correctly and is publicly reachable.",
      detail: `dns lookup failed: ${code}`,
    };
  }

  if (records.length === 0) {
    return {
      ok: false,
      addresses: [],
      code: "DNS_FAILURE",
      message: "We could not find that website. Please check the address and try again.",
      detail: "dns returned no records",
    };
  }

  for (const record of records) {
    const verdict = classifyAddress(record.address);
    if (!verdict.allowed) {
      return {
        ok: false,
        addresses: [],
        code: "BLOCKED_URL",
        message: "This URL cannot be analyzed for security reasons.",
        detail: `hostname ${hostname} resolves to a non-public address (${verdict.reason})`,
      };
    }
  }

  return { ok: true, addresses: records.map((record) => record.address) };
}

/* ------------------------------------------------------------------ */
/* Connect-time validation (DNS rebinding defence)                     */
/* ------------------------------------------------------------------ */

export class BlockedAddressError extends Error {
  readonly code = "ERR_BLOCKED_ADDRESS";
  constructor(message: string) {
    super(message);
    this.name = "BlockedAddressError";
  }
}

/**
 * Matches Node's own `net.LookupFunction` so this can be handed straight to a
 * socket's `connect` options. On the error path the address argument is
 * ignored by Node, so we pass an empty list.
 */
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

/**
 * A drop-in replacement for `dns.lookup` that refuses non-public answers.
 *
 * We hand this to the HTTP agent, so it runs at the moment the socket is about
 * to be opened, on the exact address that will be connected to. That is what
 * makes DNS rebinding ineffective: an attacker can flip their DNS record
 * between our pre-flight check and the connection, but this lookup validates
 * whatever the resolver returns at connect time.
 */
export function safeLookup(
  hostname: string,
  options: dns.LookupOneOptions | dns.LookupAllOptions | number,
  callback: LookupCallback,
): void {
  if (env.ALLOW_PRIVATE_NETWORK_TARGETS) {
    dns.lookup(hostname, options as dns.LookupAllOptions, callback as never);
    return;
  }

  const normalizedOptions: dns.LookupAllOptions =
    typeof options === "number"
      ? { family: options, all: true }
      : { ...(options as dns.LookupAllOptions), all: true };

  const wantsAll = typeof options === "object" && options !== null && options.all === true;

  dns.lookup(hostname, normalizedOptions, (err, addresses) => {
    if (err) {
      callback(err, []);
      return;
    }

    const list = Array.isArray(addresses) ? addresses : [];
    const safe = list.filter((record) => classifyAddress(record.address).allowed);

    if (safe.length === 0) {
      callback(
        new BlockedAddressError(
          `Refusing to connect to ${hostname}: it does not resolve to a public address.`,
        ),
        [],
      );
      return;
    }

    if (wantsAll) {
      callback(null, safe);
      return;
    }

    const first = safe[0] as dns.LookupAddress;
    callback(null, first.address, first.family);
  });
}
