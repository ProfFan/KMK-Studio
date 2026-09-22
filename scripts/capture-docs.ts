import { chromium } from "@playwright/test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compile } from "@kmk/compiler";
import { recipes } from "./docs-projects.ts";

// Run with the local editor already running. All edits happen in a new,
// isolated browser context; this never touches the user's saved project.
const output = resolve("apps/editor/public/help/docs");
await mkdir(`${output}/recipes`, { recursive: true });
for (const [name, project] of Object.entries(recipes)) {
  const result = compile(project);
  if (!result.ok)
    throw new Error(`${name}: ${JSON.stringify(result.diagnostics)}`);
  await writeFile(
    `${output}/recipes/${name}.kmk.json`,
    JSON.stringify(project, null, 2) + "\n",
  );
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  await page.goto("http://127.0.0.1:5173/");
  const select = async (key: string) =>
    page.getByLabel(`Key ${key}`, { exact: true }).click();
  const load = async (name: keyof typeof recipes) => {
    await page
      .getByLabel("Import project file")
      .setInputFiles(`${output}/recipes/${name}.kmk.json`);
    await page.getByText("Project imported.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Dismiss notification" }).click();
    await page.evaluate(() => document.fonts.ready);
  };
  for (const [name, key] of [
    ["shortcuts", "f"],
    ["taps", "spacebar"],
    ["holds", "caps_lock"],
    ["stages", "caps_lock"],
    ["leader", "left_command"],
  ] as const) {
    await load(name);
    await select(key);
    await page
      .locator(".inspector")
      .screenshot({ path: `${output}/${name}.png` });
  }
  await load("layers");
  await select("caps_lock");
  await page
    .locator(".inspector")
    .screenshot({ path: `${output}/momentary.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/workspace.png` });
  await page.getByRole("button", { name: /Navigation .* assignments/ }).click();
  await select("h");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/layers.png` });
  await page
    .getByRole("button", { name: "⚙ Global Settings", exact: true })
    .click();
  await page
    .locator(".settings-panel")
    .screenshot({ path: `${output}/settings.png` });
  await page
    .getByLabel("Device filter", { exact: true })
    .selectOption("vendor_product");
  await page.getByLabel("Vendor ID (VID)", { exact: true }).fill("1452");
  await page.getByLabel("Product ID (PID)", { exact: true }).fill("832");
  await page
    .locator(".settings-panel")
    .screenshot({ path: `${output}/device-filter.png` });
  await page.getByLabel("Device filter", { exact: true }).selectOption("all");
  await page
    .getByRole("button", { name: "⚙ Global Settings", exact: true })
    .click();
  await load("taps");
  await select("spacebar");
  await page.getByRole("button", { name: "Double tap", exact: true }).click();
  await page
    .getByText("Inspect layer and pending-state transitions", { exact: true })
    .click();
  await page
    .locator(".timeline")
    .screenshot({ path: `${output}/timeline.png` });
  const dimensions: Record<string, { width: number; height: number }> = {};
  for (const name of await readdir(output)) {
    if (!name.endsWith(".png")) continue;
    const png = await readFile(`${output}/${name}`);
    dimensions[name.slice(0, -4)] = {
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
    };
  }
  await writeFile(
    resolve("apps/editor/src/docs/screenshots.json"),
    JSON.stringify(dimensions, null, 2) + "\n",
  );
  process.stdout.write(
    `Captured documentation screenshots and ${Object.keys(recipes).length} validated recipes in ${output}\n`,
  );
} finally {
  await browser.close();
}
