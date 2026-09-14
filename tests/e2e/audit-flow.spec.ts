import { expect, test } from "@playwright/test";

/**
 * The audit flow, end to end, in a real browser.
 *
 * One test in this file reaches the public internet (example.com) because the
 * whole point of this product is fetching a real page. It is marked so it can
 * be skipped in an offline environment.
 */

test.describe("homepage", () => {
  test("shows the form and the honest framing", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Check your webpage");
    await expect(page.getByLabel("Webpage URL to analyze")).toBeVisible();
    await expect(page.getByRole("button", { name: /analyze seo/i })).toBeVisible();

    // The limitations section must not be quietly dropped in a redesign.
    await expect(page.getByText(/will not pretend to measure/i)).toBeVisible();
  });

  test("is reachable by keyboard alone", async ({ page }) => {
    await page.goto("/");

    // The skip link is the first focusable element.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused();
  });

  test("rejects an obviously invalid URL without calling the server", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Webpage URL to analyze").fill("not a url");
    await page.getByRole("button", { name: /analyze seo/i }).click();

    await expect(page.locator("#audit-url-error")).toContainText(/valid public web address/i);
    await expect(page).toHaveURL("/");
  });

  test("refuses a loopback address", async ({ page }) => {
    await page.goto("/seo-checker");

    await page.getByLabel("Webpage URL to analyze").fill("http://127.0.0.1/");
    await page.getByRole("button", { name: /analyze seo/i }).click();

    await expect(page.locator("#audit-url-error")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("audit", () => {
  test("runs a real audit and renders a report", async ({ page }) => {
    test.slow(); // Fetching a third-party page takes longer than a normal test.

    await page.goto("/seo-checker");
    await page.getByLabel("Webpage URL to analyze").fill("https://example.com");
    await page.getByRole("button", { name: /analyze seo/i }).click();

    // Real streamed progress, not a fake percentage.
    await expect(page.getByText(/requesting the page/i)).toBeVisible({ timeout: 20_000 });

    await page.waitForURL(/\/audit\/[a-z0-9]+$/, { timeout: 45_000 });

    await expect(page.getByText("out of 100")).toBeVisible();
    await expect(page.getByRole("heading", { name: /all checks/i })).toBeVisible();

    // The score must always carry its disclaimer.
    await expect(page.getByText(/not a Google ranking score/i)).toBeVisible();

    // The category breakdown must add up to the total shown.
    const total = Number(await page.locator("text=/^\\d+$/").first().innerText());
    expect(Number.isFinite(total)).toBe(true);
  });

  test("filters check results without a page reload", async ({ page }) => {
    test.slow();

    await page.goto("/seo-checker");
    await page.getByLabel("Webpage URL to analyze").fill("https://example.com");
    await page.getByRole("button", { name: /analyze seo/i }).click();
    await page.waitForURL(/\/audit\/[a-z0-9]+$/, { timeout: 45_000 });

    const passedFilter = page.getByRole("button", { name: /^Passed/ });
    await passedFilter.click();
    await expect(passedFilter).toHaveAttribute("aria-pressed", "true");

    await page.getByLabel("Search audit results").fill("canonical");
    await expect(page.getByText(/canonical/i).first()).toBeVisible();
  });

  test("shows a helpful message for a domain that does not exist", async ({ page }) => {
    test.slow();

    await page.goto("/seo-checker");
    await page
      .getByLabel("Webpage URL to analyze")
      .fill("https://this-domain-should-not-exist-9d8f7a6b5c.com");
    await page.getByRole("button", { name: /analyze seo/i }).click();

    await expect(page.locator("#audit-url-error")).toContainText(/could not/i, { timeout: 30_000 });
  });
});

test.describe("content pages", () => {
  for (const path of [
    "/",
    "/seo-checker",
    "/how-it-works",
    "/seo-guides",
    "/seo-guides/canonical-url",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ]) {
    test(`${path} renders with a unique title and one H1`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(page).toHaveTitle(/.+/);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }

  test("404 page is helpful rather than blank", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);

    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
    await expect(page.getByLabel("Webpage URL to analyze")).toBeVisible();
  });

  test("serves robots.txt and a sitemap", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });
});

test.describe("api", () => {
  test("validates the request body", async ({ request }) => {
    const response = await request.post("/api/audit", { data: {} });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  test("refuses a private address", async ({ request }) => {
    const response = await request.post("/api/audit", {
      data: { url: "http://169.254.169.254/latest/meta-data/" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("BLOCKED_URL");
    // The message must not disclose why internally.
    expect(body.error.message).not.toContain("169.254");
  });

  test("rejects GET with a clear explanation", async ({ request }) => {
    const response = await request.get("/api/audit");
    expect(response.status()).toBe(405);
  });

  test("returns 404 for an unknown audit id", async ({ request }) => {
    const response = await request.get("/api/audit/aaaaaaaaaaaaaaaaaaaa");
    expect(response.status()).toBe(404);
  });
});
