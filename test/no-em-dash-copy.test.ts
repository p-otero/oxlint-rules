import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const rule = createRuleHarness("p-otero/no-em-dash-copy", {
  filename: "fixture.tsx",
});

describe("p-otero/no-em-dash-copy", () => {
  rule.valid(
    "allows em dashes in comments and regex literals",
    `
      // Parses titles like "Issue \u2014 Browser".
      const title = /^ [–—-] \\S/u;
    `,
  );

  rule.valid(
    "allows hyphens and en dashes",
    `const label = "Refresh failed - retry 1–2";`,
  );

  rule.invalid(
    "reports a string literal",
    `const label = "Refresh failed \u2014 retry";`,
  );

  rule.invalid(
    "reports a template literal",
    "const label = `${name} \u2014 ${kind}`;",
  );

  rule.invalid(
    "reports JSX text",
    `const node = <p>Run a prompt \u2014 on an interval</p>;`,
  );

  rule.invalid(
    "names the replacement punctuation",
    `const label = "Saved \u2014 offline";`,
    (output) => {
      expect(output).toContain("No em dashes in product copy");
    },
  );
});
