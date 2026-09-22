import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compile } from "@kmk/compiler";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("layer editing, remapping, undo/redo, and persistence", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add layer", exact: true }).click();
  await page.getByLabel("Layer name", { exact: true }).fill("Media");
  await expect(page.locator(".layers")).toContainText("Media");
  await page.getByLabel("Key e", { exact: true }).click();
  await page.getByLabel("Behavior", { exact: true }).selectOption("map");
  await page.getByLabel("Output key", { exact: true }).selectOption("q");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Output key", { exact: true })).toHaveValue("e");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Output key", { exact: true })).toHaveValue("q");
  await page.reload();
  await page.getByRole("button", { name: /Media 1 assignments/ }).click();
  await page.getByLabel("Key e", { exact: true }).click();
  await expect(page.getByLabel("Output key", { exact: true })).toHaveValue("q");
});

test("exclusive gestures, timing validation, and timeline", async ({
  page,
}) => {
  await page.getByLabel("Key spacebar", { exact: true }).click();
  await page.getByRole("button", { name: "Double tap", exact: true }).click();
  await expect(page.locator(".trace-summary strong")).toHaveText(".");
  await page.getByRole("button", { name: "Triple tap", exact: true }).click();
  await expect(page.locator(".trace-summary strong")).toHaveText("return");
  await page.getByLabel("Binding tap window").fill("0");
  await expect(page.getByRole("alert")).toContainText("Timing must be");
  await expect(
    page.getByRole("button", { name: /Export to Karabiner/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Export to Karabiner/ }),
  ).toBeEnabled();
  await page.getByLabel("Key a", { exact: true }).click();
  await page.getByLabel("Behavior", { exact: true }).selectOption("dance");
  await page
    .getByRole("button", { name: "+ Add triple tap", exact: true })
    .click();
  await expect(page.locator(".gesture-step")).toHaveCount(3);
});

test("JSON validation, project import/export, and copying the complete Karabiner rule", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "{} Project JSON", exact: true })
    .click();
  await page.getByLabel("Project JSON", { exact: true }).fill('{"version":99}');
  await page.getByRole("button", { name: "Apply JSON", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Export to Karabiner/ }),
  ).toBeDisabled();
  await page
    .getByLabel("Import project file")
    .setInputFiles(resolve("examples/studio.kmk.json"));
  await expect(
    page.getByText("Project imported.", { exact: true }),
  ).toBeVisible();
  let downloads = 0;
  page.on("download", () => downloads++);
  const exportButton = page.getByRole("button", {
    name: /Export to Karabiner/,
  });
  await exportButton.click();
  const dialog = page.getByRole("dialog", { name: "Export to Karabiner" });
  await expect(dialog).toBeVisible();
  const text = await dialog
    .getByLabel("Rule JSON", { exact: true })
    .inputValue();
  const source = JSON.parse(
    await readFile(resolve("examples/studio.kmk.json"), "utf8"),
  );
  expect(JSON.parse(text)).toEqual(compile(source).asset!.rules[0]);
  expect(Object.keys(JSON.parse(text)).sort()).toEqual([
    "description",
    "manipulators",
  ]);
  await expect(dialog.getByLabel("Rule JSON", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(
    dialog.getByText("Add your own rule", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Edit", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveCount(2);
  for (const image of await dialog.getByRole("img").all())
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
  await dialog.getByRole("button", { name: "Copy JSON", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Copied. Ready to paste into Karabiner.",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  expect(downloads).toBe(0);
  await page.screenshot({ path: ".cache/export-dialog-desktop.png" });
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(exportButton).toBeFocused();
  const save = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "↧ Save project", exact: true })
    .click();
  const project = JSON.parse(
    await readFile((await (await save).path()) as string, "utf8"),
  );
  expect(project.version).toBe(1);
  expect(project.id).toBe("studio");
});

test("all layouts render unique keys and mobile controls remain usable", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "⚙ Global Settings", exact: true })
    .click();
  for (const layout of ["mac", "ansi", "tkl", "sixty"]) {
    await page
      .getByLabel("Keyboard layout", { exact: true })
      .selectOption(layout);
    const keys = await page
      .locator(".keycap")
      .evaluateAll((keys) => keys.map((k) => k.getAttribute("aria-label")));
    expect(new Set(keys).size).toBe(keys.length);
    await expect(
      page.getByLabel("Key spacebar", { exact: true }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: /Export to Karabiner/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Export to Karabiner/ }).click();
  const dialog = page.getByRole("dialog", { name: "Export to Karabiner" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await expect(
    dialog.getByRole("button", { name: "Copy JSON", exact: true }),
  ).toBeInViewport();
  await dialog.getByText("Edit", { exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByText("Edit", { exact: true })).toBeInViewport();
  await dialog.getByRole("img").last().scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("img").last()).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: ".cache/export-dialog-mobile.png" });
  await dialog.getByRole("button", { name: "Close export dialog" }).click();
  await expect(dialog).not.toBeVisible();
});

test("one-shot expiry, persistence, timeline, and export", async ({ page }) => {
  await page
    .getByLabel("Import project file")
    .setInputFiles(resolve("examples/command-leader.kmk.json"));
  await page.getByLabel("Key left_command", { exact: true }).click();
  const secondTap = page.locator(".gesture-step").nth(1);
  await expect(secondTap.getByLabel("Layer mode", { exact: true })).toHaveValue(
    "oneshot",
  );
  await expect(
    secondTap.getByLabel("One-shot timeout", { exact: true }),
  ).toHaveValue("1000");
  await secondTap.getByLabel("One-shot expiry", { exact: true }).uncheck();
  await expect(
    secondTap.getByText("Stays armed until used.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Key left_command", { exact: true }).click();
  await expect(
    secondTap.getByLabel("One-shot expiry", { exact: true }),
  ).not.toBeChecked();
  const play = async (at: number) => {
    await page
      .getByRole("button", { name: "Edit trace ↗", exact: true })
      .click();
    await page.getByLabel("Event trace", { exact: true }).fill(
      JSON.stringify([
        { at: 10, type: "down", key: "left_command" },
        { at: 40, type: "up", key: "left_command" },
        { at: 80, type: "down", key: "left_command" },
        { at: 100, type: "up", key: "left_command" },
        { at, type: "down", key: "h" },
        { at: at + 1, type: "up", key: "h" },
        { at: at + 10, type: "down", key: "h" },
        { at: at + 11, type: "up", key: "h" },
      ]),
    );
    await page
      .getByRole("button", { name: "Apply trace", exact: true })
      .click();
  };
  await play(10000);
  await expect(page.locator(".trace-summary strong")).toHaveText("← → H");
  await secondTap.getByLabel("One-shot expiry", { exact: true }).check();
  await secondTap.getByLabel("One-shot timeout", { exact: true }).fill("0");
  await expect(page.getByRole("alert")).toContainText(
    "Only one-shot layers accept expiry",
  );
  await expect(
    page.getByRole("button", { name: /Export to Karabiner/ }),
  ).toBeDisabled();
  await secondTap.getByLabel("One-shot timeout", { exact: true }).fill("500");
  await play(600);
  await expect(page.locator(".trace-summary strong")).toHaveText("H → H");
  await secondTap.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".cache/oneshot-editor.png", fullPage: true });
  await page.getByRole("button", { name: /Export to Karabiner/ }).click();
  const rule = JSON.parse(
    await page.getByLabel("Rule JSON", { exact: true }).inputValue(),
  );
  expect(JSON.stringify(rule)).toContain("system.now.milliseconds + 500");
  expect(Object.keys(rule).sort()).toEqual(["description", "manipulators"]);
});

test("export selects JSON for manual copying when clipboard access is denied", async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    }),
  );
  const originalOverflow = await page.evaluate(
    () => document.body.style.overflow,
  );
  await page.getByRole("button", { name: /Export to Karabiner/ }).click();
  const dialog = page.getByRole("dialog", { name: "Export to Karabiner" });
  await dialog.getByRole("button", { name: "Copy JSON", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "The JSON is selected",
  );
  const json = dialog.getByLabel("Rule JSON", { exact: true });
  await expect(json).toBeFocused();
  expect(
    await json.evaluate(
      (el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart,
    ),
  ).toBe((await json.inputValue()).length);
  await dialog.getByRole("button", { name: "Close export dialog" }).click();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    originalOverflow,
  );
  await page.getByRole("button", { name: /Export to Karabiner/ }).click();
  await expect(dialog.getByRole("status")).not.toContainText("Couldn’t copy");
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
});

test("opening export stops recording so Escape closes the dialog", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Record keys", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Export to Karabiner/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record keys", exact: true }),
  ).toBeVisible();
});
