import { test, expect, type Page } from "@playwright/test";

const BREAKPOINTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1100 },
  { name: "laptop-1024", width: 1024, height: 1300 },
  { name: "desktop-1440", width: 1440, height: 1600 },
] as const;

const PUBLIC_ROUTES = ["/", "/login", "/register"];
const AUTH_ROUTES = [
  "/dashboard",
  "/orders",
  "/restaurants",
  "/reports",
  "/integrations",
  "/automations",
  "/admin",
  "/settings",
];

// Mock auth so the _app guard does not redirect to /login.
async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("auth_token", "e2e-test-token");
    window.localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: "e2e", name: "E2E", email: "e2e@test.local" }),
    );
  });
}

async function expectNoHorizontalOverflow(page: Page, route: string, width: number) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${route} @ ${width}px should not scroll horizontally (scrollW=${metrics.scrollWidth}, clientW=${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

for (const bp of BREAKPOINTS) {
  test.describe(`Responsive layout @ ${bp.width}px (${bp.name})`, () => {
    test.use({ viewport: { width: bp.width, height: bp.height } });

    for (const route of PUBLIC_ROUTES) {
      test(`public ${route} has no horizontal overflow`, async ({ page }) => {
        await page.goto(route, { waitUntil: "networkidle" });
        await expectNoHorizontalOverflow(page, route, bp.width);
      });
    }

    for (const route of AUTH_ROUTES) {
      test(`auth ${route} has no horizontal overflow`, async ({ page, context }) => {
        await seedAuth(page);
        const resp = await page.goto(route, { waitUntil: "networkidle" });
        // If the route guard still redirected (e.g. SSR), skip rather than fail layout.
        if (page.url().includes("/login")) test.skip(true, "redirected to login");
        expect(resp?.status() ?? 200).toBeLessThan(500);
        await expectNoHorizontalOverflow(page, route, bp.width);
        await context.clearCookies();
      });
    }
  });
}