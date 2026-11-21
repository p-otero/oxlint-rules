import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const OXLINT_BIN = path.join(ROOT, "node_modules", "oxlint", "bin", "oxlint");
const PLUGIN_PATH = path.join(ROOT, "dist", "plugin.js");
const PRESETS = path.join(ROOT, "presets");
const FIXTURE = path.join(ROOT, "test", "fixtures", "consumer-without-effect");
const RENDER_PROPS_FIXTURE = path.join(
  ROOT,
  "test",
  "fixtures",
  "react-render-props",
);

const asConfigPath = (value: string) => value.replaceAll("\\", "/");

const readPreset = (name: string) =>
  JSON.parse(readFileSync(path.join(PRESETS, name), "utf8"));

type Project = {
  directory: string;
  run: (
    paths: string[],
    extraArgs?: string[],
  ) => {
    status: number | null;
    output: string;
  };
};

function createProject(
  files: Record<string, string>,
  config: unknown,
): Project {
  const directory = mkdtempSync(path.join(tmpdir(), "oxlint-rules-preset-"));
  for (const [name, source] of Object.entries(files)) {
    const filePath = path.join(directory, name);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
  }
  writeFileSync(
    path.join(directory, ".oxlintrc.json"),
    JSON.stringify(config, null, 2),
  );
  return {
    directory,
    run(paths, extraArgs = []) {
      const result = spawnSync(
        process.execPath,
        [OXLINT_BIN, "--config", ".oxlintrc.json", ...extraArgs, ...paths],
        { cwd: directory, encoding: "utf8" },
      );
      return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`,
      };
    },
  };
}

const consumerConfig = (presetNames: string[]) => ({
  extends: presetNames.map((name) => asConfigPath(path.join(PRESETS, name))),
  jsPlugins: [asConfigPath(PLUGIN_PATH)],
});

const componentSource = `
export function UserCard({ label }: { label: string }) {
  return <div>{label}</div>;
}
`;

describe("presets", () => {
  test("base and react load in a project without effect installed", () => {
    const result = spawnSync(
      process.execPath,
      [OXLINT_BIN, "--config", "oxlint.json", "--deny-warnings", "src"],
      { cwd: FIXTURE, encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    const manifest = JSON.parse(
      readFileSync(path.join(FIXTURE, "package.json"), "utf8"),
    );
    expect(manifest.dependencies["@effect/tsgo"]).toBeUndefined();
    expect(manifest.dependencies.effect).toBeUndefined();
  });

  test("base is usable alone", () => {
    const project = createProject(
      {
        "src/app.ts": `export const formatLabel = (label: string) => label.trim();
`,
      },
      consumerConfig(["base.json"]),
    );
    try {
      const result = project.run(["src"]);
      expect(result.status, result.output).toBe(0);
    } finally {
      rmSync(project.directory, { recursive: true, force: true });
    }
  });

  test("react is usable alone", () => {
    const project = createProject(
      { "src/user-card.tsx": componentSource },
      consumerConfig(["react.json"]),
    );
    try {
      const result = project.run(["src"]);
      expect(result.status, result.output).toBe(0);
    } finally {
      rmSync(project.directory, { recursive: true, force: true });
    }
  });

  test("react allows render callbacks held in column definitions", () => {
    const result = spawnSync(
      process.execPath,
      [OXLINT_BIN, "--config", "oxlint.json", "--deny-warnings", "src"],
      { cwd: RENDER_PROPS_FIXTURE, encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });

  test("react still reports components created during render", () => {
    const result = spawnSync(
      process.execPath,
      [OXLINT_BIN, "--config", "oxlint.json", "invalid"],
      { cwd: RENDER_PROPS_FIXTURE, encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("react(no-unstable-nested-components)");
    expect(result.stdout).toContain("Do not define components during render");
  });

  test("ui-tailwind is usable alone and applies the role list", () => {
    const project = createProject(
      {
        "src/card.tsx": `export const card = "gap-inline px-inset-item";
`,
      },
      consumerConfig(["ui-tailwind.json"]),
    );
    try {
      const clean = project.run(["src"]);
      expect(clean.status, clean.output).toBe(0);

      writeFileSync(
        path.join(project.directory, "src", "bad.ts"),
        `export const card = "p-4";
`,
      );
      const raw = project.run(["src"]);
      expect(raw.status).not.toBe(0);
      expect(raw.output).toContain('"p-4" is raw spacing');
      expect(raw.output).toContain("gap-inline");
    } finally {
      rmSync(project.directory, { recursive: true, force: true });
    }
  });

  test("layered presets merge into one effective config", () => {
    const result = spawnSync(
      process.execPath,
      [OXLINT_BIN, "--config", "oxlint.json", "--print-config"],
      { cwd: FIXTURE, encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    const config = JSON.parse(result.stdout);
    expect(config.plugins).toContain("react");
    expect(config.plugins).toContain("typescript");
    expect(config.plugins).toContain("import");
    expect(config.plugins).toContain("unicorn");
    expect(config.plugins).toContain("oxc");
    expect(config.rules["react/rules-of-hooks"]).toBe("deny");
    expect(config.rules["react/exhaustive-deps"]).toBe("deny");
    expect(config.rules["react/react-in-jsx-scope"]).toBe("allow");
    expect(config.rules["no-debugger"]).toBe("deny");
    expect(config.rules["import/no-cycle"]).toBe("deny");
    expect(config.options.reportUnusedDisableDirectives).toBe("deny");
  });

  test("loads the plugin from an installed node_modules layout", () => {
    const directory = mkdtempSync(
      path.join(tmpdir(), "oxlint-rules-installed-"),
    );
    try {
      const packageDirectory = path.join(
        directory,
        "node_modules",
        "@p-otero",
        "oxlint-rules",
      );
      mkdirSync(packageDirectory, { recursive: true });
      for (const entry of [
        "dist",
        "presets",
        "package.json",
        "NOTICE",
        "LICENSE",
      ]) {
        cpSync(path.join(ROOT, entry), path.join(packageDirectory, entry), {
          recursive: true,
        });
      }
      for (const dependency of ["@oxlint", "@oxc-parser", "oxc-parser"]) {
        symlinkSync(
          path.join(ROOT, "node_modules", dependency),
          path.join(directory, "node_modules", dependency),
          "junction",
        );
      }
      writeFileSync(path.join(directory, ".gitignore"), "node_modules/\n");
      writeFileSync(
        path.join(directory, ".oxlintrc.json"),
        JSON.stringify({
          extends: [
            "./node_modules/@p-otero/oxlint-rules/presets/base.json",
            "./node_modules/@p-otero/oxlint-rules/presets/react.json",
          ],
          jsPlugins: ["./node_modules/@p-otero/oxlint-rules/dist/plugin.js"],
        }),
      );
      mkdirSync(path.join(directory, "src"), { recursive: true });
      writeFileSync(
        path.join(directory, "src", "user-card.tsx"),
        componentSource,
      );
      const result = spawnSync(
        process.execPath,
        [OXLINT_BIN, "--deny-warnings"],
        { cwd: directory, encoding: "utf8" },
      );
      expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("base preset carries the required rules", () => {
    const base = readPreset("base.json");
    expect(base.plugins).toEqual(["typescript", "unicorn", "oxc", "import"]);
    expect(base.categories).toEqual({
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
    });
    expect(base.options.reportUnusedDisableDirectives).toBe("error");
    expect(base.rules["no-unused-vars"]).toEqual([
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ]);
    expect(base.rules["max-lines"]).toEqual([
      "error",
      { max: 400, skipBlankLines: true, skipComments: true },
    ]);
    expect(base.rules["p-otero/no-low-value-comments"]).toBe("error");
    expect(base.rules["p-otero/require-suppression-reason"]).toBe("error");
    expect(base.rules["p-otero/no-global-error"]).toBe("error");
    expect(base.rules["p-otero/namespace-node-imports"]).toBe("off");
    for (const rule of [
      "no-debugger",
      "oxc/no-accumulating-spread",
      "typescript/no-extraneous-class",
      "no-new",
      "no-unneeded-ternary",
      "no-unsafe-optional-chaining",
      "no-empty-pattern",
      "unicorn/no-useless-spread",
      "unicorn/no-useless-fallback-in-spread",
      "unicorn/require-module-specifiers",
    ]) {
      expect(base.rules[rule], rule).toBe("error");
    }
    expect(base.rules["import/no-cycle"]).toEqual([
      "error",
      { ignoreTypes: true },
    ]);
  });

  test("react preset carries the required rules", () => {
    const react = readPreset("react.json");
    expect(react.plugins).toEqual(["react"]);
    expect(react.rules["react/react-in-jsx-scope"]).toBe("off");
    for (const rule of [
      "react/rules-of-hooks",
      "react/exhaustive-deps",
      "react/purity",
      "react/refs",
      "react/immutability",
      "react/set-state-in-effect",
      "react/no-deriving-state-in-effects",
      "react/exhaustive-effect-dependencies",
      "react/static-components",
      "react/no-array-index-key",
    ]) {
      expect(react.rules[rule], rule).toBe("error");
    }
    expect(react.rules["react/no-unstable-nested-components"]).toEqual([
      "error",
      { allowAsProps: true },
    ]);
    for (const rule of [
      "p-otero/one-public-component",
      "p-otero/component-name-matches-file",
      "p-otero/max-component-lines",
      "p-otero/no-large-private-component",
    ]) {
      expect(react.rules[rule]?.[0], rule).toBe("error");
      expect(react.rules[rule]?.[1], rule).toBeInstanceOf(Object);
    }
  });

  test("react-agents preset enables the Effect rules", () => {
    const agents = readPreset("react-agents.json");
    expect(agents.rules["p-otero/no-effect-outside-hooks"]).toEqual([
      "error",
      { allow: ["**/hooks/**"] },
    ]);
    for (const rule of [
      "p-otero/no-callback-prop-in-effect-deps",
      "p-otero/require-effect-fetch-cleanup",
      "p-otero/prefer-sync-external-store",
      "p-otero/no-latest-ref-effect",
      "p-otero/no-sticky-request-effect",
    ]) {
      expect(agents.rules[rule], rule).toBe("error");
    }
    expect(readPreset("react.json").rules).not.toHaveProperty(
      "p-otero/no-effect-outside-hooks",
    );
  });

  test("react-agents confines Effects to hook files on top of react", () => {
    const project = createProject(
      {
        "src/user-card.tsx": `import { useEffect } from "react";

export function UserCard({ label }: { label: string }) {
  useEffect(() => {
    document.title = label;
  }, [label]);
  return <div>{label}</div>;
}
`,
        "src/hooks/use-title.ts": `import { useEffect } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
`,
      },
      consumerConfig(["react.json", "react-agents.json"]),
    );
    try {
      const result = project.run(["src"]);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain("p-otero(no-effect-outside-hooks)");
      expect(result.output).toContain("user-card.tsx");
      expect(result.output).not.toContain("use-title.ts");
    } finally {
      rmSync(project.directory, { recursive: true, force: true });
    }
  });

  test("ui-tailwind preset configures the role tokens", () => {
    const uiTailwind = readPreset("ui-tailwind.json");
    const rule = uiTailwind.rules["p-otero/spacing-tokens"];
    expect(rule[0]).toBe("error");
    expect(rule[1].roles).toContain("gap-inline");
    expect(rule[1].roles).toContain("p-inset-surface");
  });

  test("effect preset extends the optional @effect/tsgo strict preset", () => {
    const effect = readPreset("effect.json");
    expect(effect.extends).toEqual([
      "../../../@effect/tsgo/oxlint-presets/strict.json",
    ]);
    expect(effect.rules["effecttsgo/unstable-api-usage"]).toBe("off");
    expect(effect.rules["p-otero/no-inline-schema-compile"]).toBe("error");
    expect(effect.rules["p-otero/prefer-effect-fn"]).toBe("error");
    expect(effect.rules["p-otero/prefer-catch-tags"]).toBe("error");

    const manifest = JSON.parse(
      readFileSync(path.join(ROOT, "package.json"), "utf8"),
    );
    expect(manifest.peerDependencies["@effect/tsgo"]).toBeDefined();
    expect(manifest.peerDependenciesMeta["@effect/tsgo"].optional).toBe(true);
    const peerRange = manifest.peerDependencies["@effect/tsgo"];
    expect(Bun.semver.satisfies("0.67.5", peerRange)).toBe(true);
    expect(Bun.semver.satisfies("0.69.0", peerRange)).toBe(true);
    expect(Bun.semver.satisfies("0.66.0", peerRange)).toBe(false);
    expect(manifest.dependencies.effect).toBeUndefined();
    expect(manifest.dependencies["@effect/tsgo"]).toBeUndefined();
  });
});
