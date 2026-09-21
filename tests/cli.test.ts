import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exampleProject } from "@kmk/compiler";
const run = (...args: string[]) =>
  spawnSync(
    process.execPath,
    ["--import", "tsx", "packages/cli/src/main.ts", ...args],
    { encoding: "utf8" },
  );
test("CLI checks, explains, and exports valid standalone JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "kmk-cli-"));
  try {
    const input = join(dir, "project.json"),
      output = join(dir, "rules.json");
    writeFileSync(input, JSON.stringify(exampleProject()));
    assert.equal(run("check", input).status, 0);
    const compiled = run("compile", input);
    assert.equal(compiled.status, 0);
    assert.equal(JSON.parse(compiled.stdout).rules.length, 1);
    assert.equal(run("compile", input, "-o", output).status, 0);
    assert.equal(
      JSON.parse(readFileSync(output, "utf8")).title,
      exampleProject().name,
    );
    const explained = run("explain", input, "--json");
    assert.equal(JSON.parse(explained.stdout).passes.length, 6);
    assert.equal(run("compile", input, "-o", input).status, 2);
    assert.equal(JSON.parse(readFileSync(input, "utf8")).version, 1);
    writeFileSync(input, "{}");
    assert.equal(run("compile", input).status, 1);
    assert.equal(run("compile", input).stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
