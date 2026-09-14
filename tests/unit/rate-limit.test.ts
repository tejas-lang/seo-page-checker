import { afterEach, describe, expect, it } from "vitest";

import { clientKeyFromRequest, consume, peek, resetRateLimits } from "@/lib/rate-limit";

afterEach(() => {
  resetRateLimits();
});

describe("consume", () => {
  it("allows requests up to the limit and refuses the next one", () => {
    const key = "client-a";

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const outcome = consume(key, { limit: 3, windowMs: 60_000 });
      expect(outcome.allowed, `attempt ${attempt} should be allowed`).toBe(true);
      expect(outcome.remaining).toBe(3 - attempt);
    }

    const refused = consume(key, { limit: 3, windowMs: 60_000 });
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks each client separately", () => {
    consume("client-a", { limit: 1, windowMs: 60_000 });

    expect(consume("client-a", { limit: 1, windowMs: 60_000 }).allowed).toBe(false);
    expect(consume("client-b", { limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("starts a fresh window once the old one expires", async () => {
    const key = "client-expiry";

    expect(consume(key, { limit: 1, windowMs: 30 }).allowed).toBe(true);
    expect(consume(key, { limit: 1, windowMs: 30 }).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 45));

    expect(consume(key, { limit: 1, windowMs: 30 }).allowed).toBe(true);
  });

  it("reports a reset time in the future", () => {
    const outcome = consume("client-reset", { limit: 5, windowMs: 60_000 });
    expect(outcome.resetAt).toBeGreaterThan(Date.now());
  });
});

describe("peek", () => {
  it("reports the allowance without spending any of it", () => {
    const key = "client-peek";
    consume(key, { limit: 2, windowMs: 60_000 });

    expect(peek(key, { limit: 2 }).remaining).toBe(1);
    expect(peek(key, { limit: 2 }).remaining).toBe(1);
    expect(consume(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("reports a full allowance for an unseen client", () => {
    expect(peek("nobody", { limit: 5 })).toMatchObject({ allowed: true, remaining: 5 });
  });
});

describe("clientKeyFromRequest", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://example.com/api/audit", { headers });

  it("prefers the platform's own forwarding header", () => {
    const key = clientKeyFromRequest(
      request({
        "x-vercel-forwarded-for": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1",
      }),
    );
    expect(key).toBe("203.0.113.9");
  });

  it("takes the first address from a forwarded-for chain", () => {
    const key = clientKeyFromRequest(
      request({ "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" }),
    );
    expect(key).toBe("203.0.113.9");
  });

  it("falls back to a constant when no header is present", () => {
    // Everyone shares one bucket rather than nobody being limited at all.
    expect(clientKeyFromRequest(request({}))).toBe("unknown-client");
  });
});
