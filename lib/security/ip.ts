/**
 * IP address classification.
 *
 * WHAT IT IS: pure functions that decide whether an IP address is a public
 * internet address or something we must never connect to.
 *
 * WHY WE NEED IT: our server fetches URLs that strangers type into a form.
 * Without this, someone could ask us to fetch `http://169.254.169.254/` (the
 * cloud metadata service) or `http://10.0.0.5/admin` and we would happily
 * relay the response back to them. That attack is called SSRF (Server-Side
 * Request Forgery). Blocking by IP — not by hostname — is the only reliable
 * defence, because any hostname can be pointed at any IP.
 *
 * These functions have no I/O and no dependencies, which makes them easy to
 * unit-test exhaustively (see tests/unit/ip.test.ts).
 */

import net from "node:net";

/* ------------------------------------------------------------------ */
/* IPv4                                                                */
/* ------------------------------------------------------------------ */

/** Convert "192.168.0.1" to its 32-bit integer form. Returns null if invalid. */
export function ipv4ToInt(address: string): number | null {
  if (net.isIPv4(address) === false) return null;
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    // Reject "01" style octets: some parsers read them as octal, which is a
    // classic way to smuggle a blocked address past a naive filter.
    if (part.length > 1 && part.startsWith("0")) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

interface Cidr {
  base: number;
  bits: number;
  reason: string;
}

function cidr(notation: string, reason: string): Cidr {
  const [addr, bitsRaw] = notation.split("/");
  const base = ipv4ToInt(addr ?? "");
  const bits = Number(bitsRaw);
  if (base === null || !Number.isInteger(bits)) {
    throw new Error(`Invalid CIDR in blocklist: ${notation}`);
  }
  return { base, bits, reason };
}

/**
 * Every IPv4 range that must never be fetched.
 * Sources: RFC 1918 (private), RFC 6598 (CGNAT), RFC 3927 (link-local),
 * RFC 5737 (documentation), RFC 2544 (benchmarking), RFC 5771 (multicast).
 */
const BLOCKED_IPV4: Cidr[] = [
  cidr("0.0.0.0/8", "unspecified / this-network"),
  cidr("10.0.0.0/8", "private network"),
  cidr("100.64.0.0/10", "carrier-grade NAT (also Alibaba metadata)"),
  cidr("127.0.0.0/8", "loopback"),
  cidr("169.254.0.0/16", "link-local (cloud metadata service)"),
  cidr("172.16.0.0/12", "private network"),
  cidr("192.0.0.0/24", "IETF protocol assignments"),
  cidr("192.0.2.0/24", "documentation (TEST-NET-1)"),
  cidr("192.88.99.0/24", "6to4 relay anycast"),
  cidr("192.168.0.0/16", "private network"),
  cidr("198.18.0.0/15", "network benchmarking"),
  cidr("198.51.100.0/24", "documentation (TEST-NET-2)"),
  cidr("203.0.113.0/24", "documentation (TEST-NET-3)"),
  cidr("224.0.0.0/4", "multicast"),
  cidr("240.0.0.0/4", "reserved / broadcast"),
];

function matchIpv4(value: number): string | null {
  for (const range of BLOCKED_IPV4) {
    // A /0 mask would shift by 32, which is undefined in JS; handle it directly.
    const mask = range.bits === 0 ? 0 : (0xffffffff << (32 - range.bits)) >>> 0;
    if ((value & mask) >>> 0 === (range.base & mask) >>> 0) return range.reason;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* IPv6                                                                */
/* ------------------------------------------------------------------ */

/**
 * Expand an IPv6 address into its 8 numeric groups.
 * Handles "::" compression and trailing IPv4 notation (::ffff:1.2.3.4).
 */
export function expandIpv6(address: string): number[] | null {
  if (net.isIPv6(address) === false) return null;

  // Drop a zone index such as "%eth0" — it has no bearing on the address.
  const withoutZone = address.split("%")[0] ?? address;

  let work = withoutZone;
  let trailingIpv4Groups: number[] = [];

  // "::ffff:192.168.0.1" — convert the dotted tail into two 16-bit groups.
  const lastColon = work.lastIndexOf(":");
  const tail = work.slice(lastColon + 1);
  if (tail.includes(".")) {
    const asInt = ipv4ToInt(tail);
    if (asInt === null) return null;
    trailingIpv4Groups = [(asInt >>> 16) & 0xffff, asInt & 0xffff];
    work = work.slice(0, lastColon + 1);
    // Leave a trailing marker so the split below produces an empty final slot
    // that we then replace with the two IPv4-derived groups.
    work = work.endsWith("::") ? work : work.slice(0, -1);
  }

  const doubleColonCount = (work.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) return null;

  let head: string[];
  let rear: string[];

  if (doubleColonCount === 1) {
    const [left = "", right = ""] = work.split("::");
    head = left === "" ? [] : left.split(":");
    rear = right === "" ? [] : right.split(":");
  } else {
    head = work === "" ? [] : work.split(":");
    rear = [];
  }

  const explicit = [...head, ...rear].filter((group) => group !== "");
  const total = explicit.length + trailingIpv4Groups.length;
  if (total > 8) return null;
  if (doubleColonCount === 0 && total !== 8) return null;

  const parseGroup = (group: string): number | null => {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    return Number.parseInt(group, 16);
  };

  const headGroups: number[] = [];
  for (const group of head) {
    if (group === "") continue;
    const parsed = parseGroup(group);
    if (parsed === null) return null;
    headGroups.push(parsed);
  }

  const rearGroups: number[] = [];
  for (const group of rear) {
    if (group === "") continue;
    const parsed = parseGroup(group);
    if (parsed === null) return null;
    rearGroups.push(parsed);
  }

  const knownTail = [...rearGroups, ...trailingIpv4Groups];
  const zerosNeeded = 8 - headGroups.length - knownTail.length;
  if (zerosNeeded < 0) return null;

  return [...headGroups, ...new Array<number>(zerosNeeded).fill(0), ...knownTail];
}

function groupsToIpv4(groups: number[], startIndex: number): string | null {
  const high = groups[startIndex];
  const low = groups[startIndex + 1];
  if (high === undefined || low === undefined) return null;
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join(".");
}

function matchIpv6(address: string): string | null {
  const groups = expandIpv6(address);
  if (groups === null) return "unparseable IPv6 address";

  const [g0, g1, g2, g3, g4, g5] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  const allZeroUpTo = (count: number) => groups.slice(0, count).every((g) => g === 0);

  // ::  (unspecified)
  if (groups.every((g) => g === 0)) return "unspecified address";

  // ::1 (loopback)
  if (allZeroUpTo(7) && groups[7] === 1) return "IPv6 loopback";

  // ::ffff:a.b.c.d — IPv4-mapped. Unwrap and apply the IPv4 rules.
  if (allZeroUpTo(5) && g5 === 0xffff) {
    const embedded = groupsToIpv4(groups, 6);
    if (embedded === null) return "malformed IPv4-mapped address";
    const reason = matchIpv4(ipv4ToInt(embedded) ?? 0);
    return reason ? `IPv4-mapped address (${reason})` : null;
  }

  // ::a.b.c.d — deprecated IPv4-compatible. Treat the same way, and block the
  // low addresses outright since they alias loopback-ish space.
  if (allZeroUpTo(6)) {
    const embedded = groupsToIpv4(groups, 6);
    if (embedded === null) return "malformed IPv4-compatible address";
    const reason = matchIpv4(ipv4ToInt(embedded) ?? 0);
    return reason ? `IPv4-compatible address (${reason})` : "deprecated IPv4-compatible address";
  }

  // 64:ff9b::/96 and 64:ff9b:1::/48 — NAT64 translation prefixes.
  if (g0 === 0x64 && g1 === 0xff9b) {
    if (g2 === 0x0001) return "local-use NAT64 prefix";
    if (g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
      const embedded = groupsToIpv4(groups, 6);
      if (embedded === null) return "malformed NAT64 address";
      const reason = matchIpv4(ipv4ToInt(embedded) ?? 0);
      return reason ? `NAT64 address (${reason})` : null;
    }
  }

  // 2002::/16 — 6to4. The embedded IPv4 lives in groups 1 and 2.
  if (g0 === 0x2002) {
    const embedded = groupsToIpv4(groups, 1);
    if (embedded === null) return "malformed 6to4 address";
    const reason = matchIpv4(ipv4ToInt(embedded) ?? 0);
    return reason ? `6to4 address (${reason})` : null;
  }

  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return "discard-only address block";
  if (g0 === 0x2001 && g1 === 0x0db8) return "documentation address";
  if (g0 === 0x2001 && g1 === 0x0000) return "Teredo tunnelling address";
  if ((g0 & 0xfe00) === 0xfc00) return "unique local address (includes cloud metadata)";
  if ((g0 & 0xffc0) === 0xfe80) return "link-local address";
  if ((g0 & 0xff00) === 0xff00) return "multicast address";

  return null;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface AddressVerdict {
  /** Safe to connect to? */
  allowed: boolean;
  /** Why it was blocked. Kept generic so we never leak network topology. */
  reason: string | null;
}

/**
 * Decide whether we may open a socket to this IP address.
 *
 * Anything that is not a well-formed, publicly routable unicast address is
 * refused. When in doubt, we block.
 */
export function classifyAddress(address: string): AddressVerdict {
  const family = net.isIP(address);

  if (family === 4) {
    const value = ipv4ToInt(address);
    if (value === null) return { allowed: false, reason: "malformed IPv4 address" };
    const reason = matchIpv4(value);
    return reason ? { allowed: false, reason } : { allowed: true, reason: null };
  }

  if (family === 6) {
    const reason = matchIpv6(address);
    return reason ? { allowed: false, reason } : { allowed: true, reason: null };
  }

  return { allowed: false, reason: "not a valid IP address" };
}

/** Convenience wrapper used throughout the crawler. */
export function isPublicAddress(address: string): boolean {
  return classifyAddress(address).allowed;
}
