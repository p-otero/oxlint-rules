import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import plugin from "../src/plugin.ts";

const EXPECTED_RULES = [
  "component-name-matches-file",
  "import-boundaries",
  "max-component-lines",
  "namespace-node-imports",
  "no-callback-prop-in-effect-deps",
  "no-cross-feature-imports",
  "no-effect-outside-hooks",
  "no-em-dash-copy",
  "no-inline-schema-compile",
  "no-large-private-component",
  "no-latest-ref-effect",
  "no-loose-semantic-literals",
  "no-low-value-comments",
  "no-sticky-request-effect",
  "one-public-component",
  "prefer-catch-tags",
  "prefer-effect-fn",
  "prefer-sync-external-store",
  "require-effect-fetch-cleanup",
  "require-suppression-reason",
  "spacing-tokens",
];

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(entryPath)
      : entryPath.endsWith(".ts")
        ? [entryPath]
        : [];
  });

describe("p-otero plugin", () => {
  test("registers every rule under the p-otero namespace", () => {
    expect(plugin.meta?.name).toBe("p-otero");
    expect(Object.keys(plugin.rules ?? {}).toSorted()).toEqual(EXPECTED_RULES);
    for (const rule of Object.values(plugin.rules ?? {})) {
      expect("create" in rule || "createOnce" in rule).toBe(true);
    }
  });

  test("has no runtime dependency on effect", () => {
    const directory = path.join(import.meta.dirname, "..", "src");
    for (const file of sourceFiles(directory)) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from "effect(?:\/|")/u);
      expect(source, file).not.toMatch(/require\("effect(?:\/|")/u);
    }
  });
});
