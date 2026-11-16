import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const files = {
  "src/features/a/local.ts": `export const local = 1;
`,
  "src/features/b/item.ts": `export const item = 1;
`,
  "src/modules/a/local.ts": `export const local = 1;
`,
  "src/modules/b/item.ts": `export const item = 1;
`,
};

const rule = createRuleHarness("p-otero/no-cross-feature-imports", { files });

describe("p-otero/no-cross-feature-imports", () => {
  rule.valid(
    "allows imports inside the same feature",
    `
      import { local } from "./local.ts";
      export const page = local;
    `,
    { filename: "src/features/a/page.ts" },
  );

  rule.valid(
    "ignores files outside a features directory",
    `
      import { item } from "../b/item.ts";
      export const page = item;
    `,
    { filename: "src/app.ts" },
  );

  rule.invalid(
    "reports a relative import from another feature",
    `
      import { item } from "../b/item.ts";
      export const page = item;
    `,
    (output) => {
      expect(output).toContain("a imports b");
    },
    { filename: "src/features/a/page.ts" },
  );

  rule.invalid(
    "reports a re-export from another feature",
    `export { item } from "../b/item.ts";`,
    undefined,
    { filename: "src/features/a/page.ts" },
  );

  rule.invalid(
    "reports a package alias import from another feature",
    `
      import { item } from "@repo/ui/features/b";
      export const page = item;
    `,
    undefined,
    {
      filename: "src/features/a/page.ts",
      ruleOptions: [{ alias: "@repo/ui/features" }],
    },
  );

  rule.invalid(
    "honors a custom features directory",
    `
      import { item } from "../b/item.ts";
      export const page = item;
    `,
    undefined,
    {
      filename: "src/modules/a/page.ts",
      ruleOptions: [{ featuresDirectory: "modules" }],
    },
  );

  rule.valid(
    "ignores files outside the files pattern",
    `
      import { item } from "../b/item.ts";
      export const page = item;
    `,
    {
      filename: "src/features/a/page.ts",
      ruleOptions: [{ files: "\\.tsx$" }],
    },
  );

  rule.invalid(
    "applies the files pattern",
    `
      import { item } from "../b/item.ts";
      export const page = item;
    `,
    undefined,
    {
      filename: "src/features/a/page.tsx",
      ruleOptions: [{ files: "\\.tsx$" }],
    },
  );
});
