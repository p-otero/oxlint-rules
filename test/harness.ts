import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "bun:test";

const OXLINT_BIN = path.join(
  import.meta.dirname,
  "..",
  "node_modules",
  "oxlint",
  "bin",
  "oxlint",
);
const PLUGIN_PATH = path.join(import.meta.dirname, "..", "dist", "plugin.js");

const asConfigPath = (value: string) => value.replaceAll("\\", "/");

export type LintRequest = {
  rule: string;
  ruleOptions?: unknown[];
  files?: Record<string, string>;
  lint?: string[];
};

export type LintResult = {
  exitCode: number;
  output: string;
};

export function lint(request: LintRequest): LintResult {
  const directory = mkdtempSync(path.join(tmpdir(), "oxlint-rules-"));
  try {
    const files = request.files ?? {};
    for (const [name, source] of Object.entries(files)) {
      const filePath = path.join(directory, name);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, source);
    }
    const config = {
      plugins: [],
      categories: { correctness: "off" },
      jsPlugins: [asConfigPath(PLUGIN_PATH)],
      rules: { [request.rule]: ["error", ...(request.ruleOptions ?? [])] },
    };
    writeFileSync(
      path.join(directory, ".oxlintrc.json"),
      JSON.stringify(config, null, 2),
    );
    const lintPaths = request.lint ?? [Object.keys(files)[0] ?? "."];
    const result = spawnSync(
      process.execPath,
      [OXLINT_BIN, "--config", ".oxlintrc.json", ...lintPaths],
      { cwd: directory, encoding: "utf8" },
    );
    return {
      exitCode: result.status ?? 1,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

type CaseOptions = {
  filename?: string;
  ruleOptions?: unknown[];
  files?: Record<string, string>;
  lint?: string[];
};

export function createRuleHarness(rule: string, defaults: CaseOptions = {}) {
  const run = (source: string, options: CaseOptions = {}): LintResult => {
    const filename = options.filename ?? defaults.filename ?? "fixture.ts";
    return lint({
      rule,
      ruleOptions: options.ruleOptions ?? defaults.ruleOptions,
      files: { [filename]: source, ...defaults.files, ...options.files },
      lint: options.lint ?? defaults.lint ?? [filename],
    });
  };

  return {
    run,
    valid(name: string, source: string, options: CaseOptions = {}) {
      test(name, () => {
        const result = run(source, options);
        expect(
          result.exitCode,
          `expected no diagnostics\n${result.output}`,
        ).toBe(0);
      });
    },
    invalid(
      name: string,
      source: string,
      assertion?: (output: string) => void,
      options: CaseOptions = {},
    ) {
      test(name, () => {
        const result = run(source, options);
        expect(
          result.exitCode,
          `expected diagnostics\n${result.output}`,
        ).not.toBe(0);
        expect(result.output).toContain(`p-otero(${rule.split("/")[1]})`);
        assertion?.(result.output);
      });
    },
  };
}
