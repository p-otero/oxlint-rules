import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const OXLINT_BIN = path.join(ROOT, "node_modules", "oxlint", "bin", "oxlint");
const OFF = new Set([
  "typescript/prefer-readonly-parameter-types",
  "typescript/explicit-function-return-type",
  "typescript/explicit-module-boundary-types",
  "typescript/explicit-member-accessibility",
]);

describe("typescript-strict preset", () => {
  test("makes every oxlint typescript rule an error", () => {
    const strict = JSON.parse(
      readFileSync(
        path.join(ROOT, "presets", "typescript-strict.json"),
        "utf8",
      ),
    );
    const listing = spawnSync(
      process.execPath,
      [OXLINT_BIN, "--rules", "--format", "json"],
      { encoding: "utf8" },
    );
    const typescriptRules = (
      JSON.parse(listing.stdout) as { scope: string; value: string }[]
    )
      .filter((rule) => rule.scope === "typescript")
      .map((rule) => `typescript/${rule.value}`)
      .toSorted();
    expect(Object.keys(strict.rules).toSorted()).toEqual(typescriptRules);
    for (const rule of typescriptRules) {
      const expected = OFF.has(rule)
        ? "off"
        : rule === "typescript/consistent-type-definitions"
          ? ["error", "type"]
          : "error";
      expect(strict.rules[rule], rule).toEqual(expected);
    }
  });
});
