# Security

This application does something inherently dangerous: it takes a URL from an
anonymous stranger and makes its own server fetch it. This document explains
the risk, every defence against it, and the limits of those defences.

---

## 1. The threat: SSRF

**SSRF** stands for Server-Side Request Forgery. The attack is simple to
describe and easy to get wrong.

Our server sits somewhere with network access — a cloud VM, a container, a
serverless function. From there it can usually reach things nobody on the
internet can:

- The **cloud metadata service** at `169.254.169.254`, which on a misconfigured
  instance hands out temporary credentials for the whole cloud account.
- **Private network addresses** like `10.0.0.5` or `192.168.1.1`, where
  internal dashboards, databases and admin panels live.
- **Localhost**, where a debug endpoint or an unauthenticated admin interface
  might be listening.

Because this tool **returns page content to the user**, an unprotected fetcher
is not merely a vulnerability. It is a fully functional proxy into our own
network, with a nice web interface.

### Why blocking by hostname is not enough

The naive fix is a blocklist of hostnames: reject `localhost`, reject
`metadata.google.internal`. That fails immediately, because **an attacker
controls DNS for their own domain**. `evil.example.com` can resolve to
`169.254.169.254`. No hostname blocklist catches that.

The only reliable defence is to check the **IP address** the hostname actually
resolves to, and to check it **at the moment the connection is made**.

---

## 2. The four layers

Every URL, and every redirect hop, passes through all four.

### Layer 1 — Shape

`lib/security/url-guard.ts` → `normalizeUrl`, `validateUrlShape`

| Rule | Rejected examples |
| --- | --- |
| Only `http:` and `https:` | `file:///etc/passwd`, `javascript:alert(1)`, `data:text/html,…`, `ftp://`, `gopher://` |
| No credentials in the URL | `https://admin:secret@example.com/` |
| Only ports 80 and 443 | `http://example.com:22/`, `http://example.com:3306/` |
| No control characters or whitespace | `https://example.com/ evil` |
| Maximum 2048 characters | Overlong URLs designed to confuse parsers |

The port restriction is defence in depth. Even if a hostname somehow reached
the socket, it could not be used to probe arbitrary internal services.

### Layer 2 — Name

Hostnames reserved for local or internal use are refused before any DNS lookup:

- `localhost`, `localhost.localdomain`, `metadata.google.internal`,
  `metadata.goog`, `instance-data`, `metadata`
- Anything whose **last** label is `localhost`, `local`, `internal`, `intranet`,
  `lan`, `home`, `corp`, `private`, `arpa`, `onion`, `test`, `invalid`,
  `example` or `alt`
- **Single-label hostnames** with no dot at all, such as `http://router/`.
  These resolve through the machine's local search domains, which means they
  are intranet names by definition.

Note this matches the last label only, so `example.com` is unaffected by the
reserved `.example` TLD. There is a test for exactly that.

### Layer 3 — Address

`lib/security/ip.ts` → `classifyAddress`

The hostname is resolved, and **every address it returns** is checked. Not just
the first one: a hostname that returns one public and one private address is
refused, because which one gets used is the resolver's decision, not ours.

**IPv4 ranges blocked:**

| Range | What it is |
| --- | --- |
| `0.0.0.0/8` | This network / unspecified |
| `10.0.0.0/8` | Private (RFC 1918) |
| `100.64.0.0/10` | Carrier-grade NAT — also Alibaba Cloud metadata at `100.100.100.200` |
| `127.0.0.0/8` | Loopback |
| `169.254.0.0/16` | Link-local — **includes the AWS, GCP and Azure metadata endpoint** |
| `172.16.0.0/12` | Private (RFC 1918) |
| `192.0.0.0/24` | IETF protocol assignments |
| `192.0.2.0/24` | Documentation (TEST-NET-1) |
| `192.88.99.0/24` | 6to4 relay anycast |
| `192.168.0.0/16` | Private (RFC 1918) |
| `198.18.0.0/15` | Network benchmarking |
| `198.51.100.0/24` | Documentation (TEST-NET-2) |
| `203.0.113.0/24` | Documentation (TEST-NET-3) |
| `224.0.0.0/4` | Multicast |
| `240.0.0.0/4` | Reserved, including the broadcast address |

**IPv6 ranges blocked:**

| Range | What it is |
| --- | --- |
| `::/128` | Unspecified |
| `::1/128` | Loopback |
| `::ffff:0:0/96` | IPv4-mapped — **unwrapped and re-checked against the IPv4 rules** |
| `::/96` | Deprecated IPv4-compatible |
| `64:ff9b::/96`, `64:ff9b:1::/48` | NAT64 — **unwrapped and re-checked** |
| `100::/64` | Discard-only |
| `2001::/32` | Teredo tunnelling |
| `2001:db8::/32` | Documentation |
| `2002::/16` | 6to4 — **embedded IPv4 unwrapped and re-checked** |
| `fc00::/7` | Unique local — **includes the EC2 IMDSv6 endpoint `fd00:ec2::254`** |
| `fe80::/10` | Link-local |
| `ff00::/8` | Multicast |

**The wrapper cases matter.** `::ffff:127.0.0.1` and `2002:7f00:1::` are both
loopback wearing an IPv6 costume. A checker that only compares IPv6 prefixes
misses them entirely. This one unwraps the embedded IPv4 address and applies
the full IPv4 rules to it.

**Encoded IPv4 addresses** are handled by the WHATWG URL parser before we ever
see them: `http://2130706433/` and `http://0x7f000001/` both normalise to
`127.0.0.1`, which Layer 3 then blocks. There are tests proving that pipeline
still holds. Separately, `ipv4ToInt` rejects octets with leading zeros, because
`010.0.0.1` is ambiguous between octal and decimal and ambiguity is how filters
get bypassed.

### Layer 4 — Connect

`lib/security/url-guard.ts` → `safeLookup`

**This is the layer people forget, and it is the one that matters most.**

Layers 1–3 happen before the connection. Between the DNS check and the actual
socket, an attacker who controls their own DNS can change the record — a low
TTL, two answers, one public and one private. This is called **DNS rebinding**,
and it defeats any amount of pre-flight validation.

The defence is to validate the address **the socket is actually about to use**.
We pass a custom `lookup` function into the HTTP agent:

```ts
const agent = new Agent({
  connect: { lookup: safeLookup },
});
```

`safeLookup` resolves the hostname, filters out every non-public address, and
fails the connection if nothing safe remains. Because it runs at connect time
on the exact address being connected to, the rebinding window closes.

---

## 3. Redirects

Redirects are followed **manually**, one hop at a time:

```ts
const agent = new Agent({ /* no redirect interceptor */ });
await fetch(url, { redirect: "manual", dispatcher: agent });
```

Automatic redirect following would be a hole straight through everything above:
validate `https://evil.example.com/`, get a `302` to `http://169.254.169.254/`,
and the HTTP library follows it without asking. Handling it ourselves means
**every hop re-enters all four layers**.

Also enforced:

- A maximum of 10 hops (`MAX_REDIRECTS`).
- Loop detection via a set of visited URLs — a cycle returns `REDIRECT_LOOP`
  rather than running to the hop limit.
- The time budget covers the **whole chain**, not each request, so ten slow
  hops cannot multiply the timeout.

---

## 4. Resource exhaustion

| Attack | Defence |
| --- | --- |
| A multi-gigabyte page | `Content-Length` checked first, then the body streamed with a running byte count that aborts past `MAX_CRAWL_SIZE` (5 MB) |
| A server that trickles bytes forever | A single deadline across the whole audit (`CRAWL_TIMEOUT`, 10s), plus per-socket header and body timeouts |
| A page that is not HTML at all | Content-type allowlist; binaries are refused before reading |
| An XML bomb in a sitemap | `<loc>` values are extracted with a streaming regex, never an XML parser. Entities are not expanded, external DTDs are never fetched, and parsing stops at 5000 URLs |
| A huge JSON-LD block | Blocks over 2 MB are rejected without being handed to `JSON.parse` |
| Many audits at once | Server-side rate limiting, 5 per client per hour by default |
| Connection pool exhaustion | The shared agent caps connections per origin |

**On truncation:** when a response exceeds the size cap the audit **fails** with
`RESPONSE_TOO_LARGE` rather than analysing half a document. A truncated page
produces wrong link counts, wrong word counts and missing elements — which
would be invented data, and this tool does not produce that.

---

## 5. Never executing page content

The audited page's JavaScript **never runs**. Cheerio is an HTML parser: it
reads markup and builds a tree. There is no JavaScript engine anywhere in the
request path.

This rules out an entire category of attack. It also has an honest cost: pages
that render in the browser look nearly empty to us. Rather than hide that, the
`content-rendering` check detects the pattern and tells the user their report
describes the initial HTML only.

If browser rendering is ever added, it must run in a hardened, isolated worker
with no network access to anything internal and no credentials — not in this
process.

---

## 6. What we do not log or store

**Never logged:** cookies, authorisation headers, tokens, passwords, page
content, or the visitor's IP address.

**Never stored:** the audited page's HTML, images, or any content beyond the
specific values named in the report. No IP addresses. No cookies — the site
sets none at all.

The visitor's IP is used **in memory only**, as a rate-limiting key, and is
never written anywhere.

Error messages returned to users are deliberately generic: *"This URL cannot be
analyzed for security reasons."* The specific reason — which range matched,
what the hostname resolved to — goes to the server log only. Telling an
attacker exactly which rule caught them is free reconnaissance.

---

## 7. Report privacy

Audit IDs are 15 random bytes: **120 bits of entropy**, generated with
`crypto.randomBytes`. They cannot be guessed, incremented or enumerated.

Anyone holding the link can read the report — that is what makes sharing work,
and the privacy policy says so plainly rather than implying reports are
private. Reports carry a `noindex` directive and `/audit/` is disallowed in
`robots.txt`, so search engines are instructed not to list them.

Reports are deleted after `AUDIT_RETENTION_DAYS` (7 by default). A row past its
expiry is treated as gone on read, even before the purge removes it.

---

## 8. Other hardening

- **Security headers** on every response (`next.config.ts`):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy`
  disabling camera, microphone, geolocation and browsing topics.
- **`poweredByHeader: false`** — no free version disclosure.
- **Input validation with Zod** on every API route.
- **A honeypot field** on the contact form, plus a stricter rate limit of 3 per
  hour.
- **No secrets in code.** Everything sensitive comes from the environment, and
  `.env` is gitignored.
- **`npm audit` is clean.** Two transitive dev-only advisories are resolved with
  pinned `overrides` in `package.json`.

---

## 9. Testing

`tests/unit/security.test.ts` and `tests/unit/crawler.test.ts` contain 145 tests
covering every vector in this document:

```
localhost · 127.0.0.1 · 0.0.0.0 · 169.254.169.254 · [::1] · [fd00:ec2::254]
10.x · 172.16-31.x · 192.168.x · 100.64.x (CGNAT) · 100.100.100.200 (Alibaba)
::ffff:127.0.0.1 · ::ffff:169.254.169.254 · 2002:7f00:1:: · 64:ff9b::7f00:1
2130706433 (decimal) · 0x7f000001 (hex) · 010.0.0.1 (octal-ambiguous)
metadata.google.internal · *.local · *.internal · *.test · single-label hosts
file:// · javascript: · data: · ftp:// · gopher:// · credentials in URL
non-standard ports · control characters · overlong URLs
redirect chains · redirect loops · oversized responses · slow responses
malformed HTML · malformed JSON-LD · XML entity bombs
```

Each is asserted to be **refused**, and the returned message is asserted **not
to leak** the internal reason.

Run them with `npm test`.

---

## 10. Known limits

Stated honestly, because a security document that claims completeness is
lying.

1. **Rate limiting is per-process.** Counters live in memory. Several instances
   behind a load balancer each enforce the limit separately, multiplying the
   effective allowance. Use Redis or Upstash for multi-instance deployments;
   `lib/rate-limit.ts` is the only file that changes.

2. **Forwarding headers are forgeable.** `X-Forwarded-For` can be spoofed by a
   caller that reaches the app directly. Behind a proxy that overwrites it
   (Vercel, Cloudflare) this is fine. Exposed directly, it is not. Rate
   limiting is one layer, and the crawler's own timeouts and size caps bound
   what a determined abuser can achieve.

3. **The IPv6 blocklist is a list, not a proof.** It covers every range I know
   to be non-public. A future allocation could need adding. The design is
   fail-closed — anything unparseable is refused — but the list needs
   maintaining.

4. **We cannot stop a page being audited on its owner's behalf.** Anyone can
   submit any public URL. The mitigations are that we only make ordinary GET
   requests to publicly reachable pages, identify ourselves honestly, respect
   a robots.txt block, and rate-limit.

5. **No CAPTCHA.** Deliberately not added for V1. If abuse appears, the
   architecture supports adding one at the API boundary.

---

## Reporting a vulnerability

If you find a security issue, please report it privately through the contact
page rather than opening a public issue.
