import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { compile } from "@kmk/compiler";
import { recipes } from "../../scripts/docs-projects.ts";

test("documentation navigation, local diagrams, screenshots, and downloadable recipes", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      externalRequests.push(request.url());
  });
  await page.goto("/");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("My saved keyboard");
  const docs = page.getByRole("link", { name: "Docs", exact: true });
  await expect(docs).toHaveAttribute("href", "/docs");
  const order = await page
    .locator(".sidebar-bottom")
    .evaluate((el) =>
      Array.from(el.children).map((child) => child.textContent?.trim()),
    );
  expect(order.findIndex((text) => text?.includes("Docs"))).toBe(
    order.findIndex((text) => text?.includes("Save project")) + 1,
  );
  await docs.click();
  await expect(page).toHaveURL(/\/docs\/?$/);
  await expect(page).toHaveTitle(/KMK Docs/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "More possibilities.",
  );
  await expect(page.locator(".docs-diagram-canvas svg")).toHaveCount(5);
  await expect(page.getByRole("alert")).toHaveCount(0);
  // Every embedded screenshot must resolve, including those below lazy-loading's viewport.
  for (const image of await page.locator(".docs-shot img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  const nav = page.getByRole("navigation", { name: "Documentation topics" });
  const search = page.getByRole("searchbox", { name: "Find a topic" });
  await search.fill("leader");
  await expect(nav.getByRole("link")).toHaveCount(1);
  await nav
    .getByRole("link", { name: "One-shot layers & leader keys" })
    .click();
  await expect(page).toHaveURL(/#oneshot$/);
  await expect(page.locator("#oneshot-title")).toBeInViewport();
  await search.fill("no-such-topic");
  await expect(nav.getByRole("status")).toContainText("No topics found");
  await search.fill("");
  await expect(nav.getByRole("link")).toHaveCount(13);
  for (const [name, project] of Object.entries(recipes)) {
    const response = await request.get(`/help/docs/recipes/${name}.kmk.json`);
    expect(response.ok()).toBe(true);
    const downloaded = await response.json();
    expect(downloaded).toEqual(project);
    for (const optimize of [true, false]) {
      const result = compile(downloaded, { optimize });
      expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual(
        [],
      );
      expect(result.asset?.rules).toHaveLength(1);
    }
  }
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#oneshot a[download]").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("leader.kmk.json");
  expect(JSON.parse(await readFile((await download.path())!, "utf8"))).toEqual(
    recipes.leader,
  );
  await page.locator("#oneshot-title").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".cache/docs-leader.png" });
  await page
    .getByRole("link", { name: "← Back to studio", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "My saved keyboard",
  );
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("direct documentation visits, fragment reloads, rendered diagrams, and mobile layout", async ({
  page,
}) => {
  await page.goto("/docs/#oneshot");
  await expect(page.locator(".docs-diagram-canvas svg")).toHaveCount(5);
  await expect(page.locator("#oneshot-title")).toBeInViewport();
  await page.reload();
  await expect(page.locator(".docs-diagram-canvas svg")).toHaveCount(5);
  await expect(page.locator("#oneshot-title")).toBeInViewport();
  await expect(page.locator(".docs-diagram details")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Documentation topics" })
    .getByRole("link", { name: "Overlay layers & priority" })
    .click();
  await expect(page.locator("#layers-title")).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".cache/docs-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/docs");
  await page.screenshot({ path: ".cache/docs-desktop.png", fullPage: false });
});
