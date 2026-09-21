#!/usr/bin/env node
import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { compile } from "@kmk/compiler";

const usage = `KMK — compile a keyboard project for Karabiner 16.3.0

  kmk check project.kmk.json
  kmk compile project.kmk.json [-o output.json] [--no-optimize]
  kmk explain project.kmk.json [--json] [--no-optimize]

Compilation writes a standalone Complex Modifications asset, never a live profile.
`;
try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      "no-optimize": { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    process.stdout.write(usage);
  } else {
    const [command, file] = positionals;
    if (
      !["check", "compile", "explain"].includes(command) ||
      !file ||
      positionals.length !== 2
    )
      throw new Error(usage);
    const project = JSON.parse(readFileSync(resolve(file), "utf8"));
    const result = compile(project, { optimize: !values["no-optimize"] });
    for (const d of result.diagnostics)
      process.stderr.write(`${d.severity} ${d.code} ${d.path}: ${d.message}\n`);
    if (!result.ok) process.exitCode = 1;
    else if (command === "check")
      process.stdout.write(
        `Valid · ${result.statistics.manipulators} manipulators · ${result.statistics.variables} variables · Karabiner 16.3.0\n`,
      );
    else {
      const { asset, ...report } = result;
      const text =
        command === "compile"
          ? JSON.stringify(asset, null, 2) + "\n"
          : values.json
            ? JSON.stringify(report, null, 2) + "\n"
            : [
                ...result.passes.map(
                  (p, i) => `${i + 1}. ${p.name}\n   ${p.detail}`,
                ),
                "\nStatistics: " + JSON.stringify(result.statistics),
                "\nSource map:",
                ...result.sourceMap.map(
                  (s) =>
                    `  #${s.manipulator} ← ${s.layerId}/${s.bindingId} (${s.phase})`,
                ),
              ].join("\n") + "\n";
      if (values.output) {
        const target = resolve(values.output);
        if (target === resolve(file))
          throw new Error("Output must not overwrite the source project.");
        const temp = `${target}.${process.pid}.tmp`;
        try {
          writeFileSync(temp, text, { flag: "wx" });
          renameSync(temp, target);
        } catch (e) {
          try {
            unlinkSync(temp);
          } catch {}
          throw e;
        }
      } else process.stdout.write(text);
    }
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
