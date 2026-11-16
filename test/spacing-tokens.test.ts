import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const rule = createRuleHarness("p-otero/spacing-tokens", {
  ruleOptions: [{ roles: ["gap-inline", "px-inset-item"] }],
});

describe("p-otero/spacing-tokens", () => {
  rule.valid(
    "allows role tokens and zero",
    `const className = "gap-inline px-inset-item p-0";`,
  );

  rule.valid(
    "allows variant role tokens",
    `const className = "md:gap-inline data-[state=open]:px-inset-item";`,
  );

  rule.valid(
    "ignores a non-spacing utility",
    `const className = "text-sm rounded-md";`,
  );

  rule.valid("ignores import sources", `import "p-4";`);

  rule.invalid(
    "reports a numeric spacing token",
    `const className = "p-4";`,
    (output) => {
      expect(output).toContain('"p-4" is raw spacing');
      expect(output).toContain("gap-inline, px-inset-item");
    },
  );

  rule.invalid(
    "reports spacing after a variant",
    `const className = "md:gap-2";`,
    undefined,
  );

  rule.invalid(
    "reports spacing after an arbitrary variant",
    `const className = "data-[state=open]:p-4";`,
    undefined,
  );

  rule.invalid(
    "reports negative spacing",
    `const className = "-m-2";`,
    undefined,
  );

  rule.invalid(
    "reports spacing in a template literal",
    "const className = `p-4 ${extra}`;",
    undefined,
  );

  rule.valid("allows zero without roles", `const className = "p-0";`, {
    ruleOptions: [],
  });

  rule.invalid(
    "uses generic guidance without roles",
    `const className = "p-4";`,
    (output) => {
      expect(output).toContain("Use a spacing role token.");
    },
    { ruleOptions: [] },
  );
});
