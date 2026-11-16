import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const status = `export const Status = {
  ok: "ok",
  failed: "failed",
} as const;
`;

const rule = createRuleHarness("p-otero/no-loose-semantic-literals", {
  ruleOptions: [{ roots: ["src"] }],
  files: { "src/status.ts": status },
});

describe("p-otero/no-loose-semantic-literals", () => {
  rule.valid("allows the values inside the exported as const object", status, {
    filename: "src/status.ts",
    lint: ["src/status.ts"],
  });

  rule.valid(
    "allows literals that are not semantic values",
    `
      import { Status } from "./status.ts";

      export const read = (value: string) =>
        value === "something-else" ? Status.ok : Status.failed;
    `,
    { filename: "src/use.ts" },
  );

  rule.valid(
    "allows a single literal type for a non-semantic value",
    `export type Kind = "custom";`,
    { filename: "src/use.ts" },
  );

  rule.valid(
    "allows indexing the as const object",
    `
      import { Status } from "./status.ts";

      export type Ok = (typeof Status)["ok"];
    `,
    { filename: "src/use.ts" },
  );

  rule.valid(
    "ignores files under a test directory unless they are test files",
    `
      export const check = (value: string) => value === "ok";
    `,
    { filename: "src/test/helper.ts" },
  );

  rule.valid(
    "ignores files outside the configured roots",
    `
    export const check = (value: string) => value === "ok";
  `,
    {
      filename: "scripts/tool.ts",
    },
  );

  rule.invalid(
    "reports a loose semantic literal in a comparison",
    `
      import { Status } from "./status.ts";

      export const isOk = (value: string) => value === "ok";
    `,
    (output) => {
      expect(output).toContain('loose semantic literal "ok"');
    },
    { filename: "src/use.ts" },
  );

  rule.invalid(
    "reports a literal union of semantic values",
    `
      export type StatusValue = "ok" | "failed";
    `,
    (output) => {
      expect(output).toContain("literal union StatusValue");
    },
    { filename: "src/use.ts" },
  );

  rule.invalid(
    "reports a single semantic literal type",
    `
      export type Ok = "ok";
    `,
    undefined,
    { filename: "src/use.ts" },
  );

  rule.invalid(
    "checks test files inside test directories",
    `
      export const check = (value: string) => value === "failed";
    `,
    undefined,
    { filename: "src/test/helper.test.ts" },
  );
});
