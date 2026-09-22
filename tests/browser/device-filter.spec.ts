import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Asset } from "@kmk/compiler";

test("global device filter persists, validates, previews, and exports both device_if modes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Import project file")
    .setInputFiles(resolve("examples/command-leader.kmk.json"));
  const settings = page.getByRole("button", {
    name: "⚙ Global Settings",
    exact: true,
  });
  await settings.click();
  const filter = page.getByLabel("Device filter", { exact: true });
  await expect(filter).toHaveValue("all");
  await filter.selectOption("vendor_product");
  const vendor = page.getByLabel("Vendor ID (VID)", { exact: true });
  const product = page.getByLabel("Product ID (PID)", { exact: true });
  await vendor.fill("1452");
  await product.fill("832");
  const exportButton = page.getByRole("button", {
    name: /Export to Karabiner/,
  });
  const exportedRule = async () => {
    await exportButton.click();
    const dialog = page.getByRole("dialog", { name: "Export to Karabiner" });
    const rule = JSON.parse(
      await dialog.getByLabel("Rule JSON", { exact: true }).inputValue(),
    ) as Asset["rules"][number];
    await dialog.getByRole("button", { name: "Close export dialog" }).click();
    return rule;
  };
  for (const m of (await exportedRule()).manipulators)
    expect(m.conditions?.filter((c) => c.type === "device_if")).toEqual([
      {
        type: "device_if",
        identifiers: [{ vendor_id: 1452, product_id: 832 }],
      },
    ]);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Save project/ }).click();
  const file = (await (await downloading).path())!;
  expect(JSON.parse(await readFile(file, "utf8")).deviceFilter).toEqual({
    type: "vendor_product",
    vendorId: 1452,
    productId: 832,
  });
  await page.reload();
  await settings.click();
  await expect(filter).toHaveValue("vendor_product");
  await expect(vendor).toHaveValue("1452");
  await expect(product).toHaveValue("832");
  for (const bad of ["-1", "1.5", ""]) {
    await product.fill(bad);
    await expect(exportButton).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText(
      "Vendor ID and Product ID",
    );
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("kmk.project.v1")!).deviceFilter
            .productId,
      ),
    ).toBe(832);
  }
  await product.fill("832");
  await filter.selectOption("built_in_keyboard");
  await expect(vendor).toHaveCount(0);
  await expect(exportButton).toBeEnabled();
  for (const m of (await exportedRule()).manipulators)
    expect(m.conditions?.filter((c) => c.type === "device_if")).toEqual([
      { type: "device_if", identifiers: [{ is_built_in_keyboard: true }] },
    ]);
  await expect(
    page.getByText("Preview assumes the selected device.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit trace ↗", exact: true }).click();
  await page.getByLabel("Event trace", { exact: true }).fill(
    JSON.stringify([
      { at: 0, type: "down", key: "left_command" },
      { at: 40, type: "up", key: "left_command" },
      { at: 100, type: "down", key: "left_command" },
      { at: 140, type: "up", key: "left_command" },
      { at: 200, type: "down", key: "h" },
      { at: 240, type: "up", key: "h" },
    ]),
  );
  await page.getByRole("button", { name: "Apply trace", exact: true }).click();
  await expect(page.locator(".trace-summary strong")).toHaveText("←");
  await page.setViewportSize({ width: 390, height: 844 });
  await filter.selectOption("vendor_product");
  await vendor.fill("1452");
  await product.fill("832");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .locator(".device-settings")
    .screenshot({ path: ".cache/device-settings-mobile.png" });
  await filter.selectOption("all");
  expect(
    (await exportedRule()).manipulators.every(
      (m) => !m.conditions?.some((c) => c.type === "device_if"),
    ),
  ).toBe(true);
  await page.getByLabel("Import project file").setInputFiles(file);
  await expect(filter).toHaveValue("vendor_product");
  await expect(vendor).toHaveValue("1452");
  await expect(product).toHaveValue("832");
});
