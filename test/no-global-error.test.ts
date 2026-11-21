import { describe } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const rule = createRuleHarness("p-otero/no-global-error", {
  filename: "fixture.ts",
});

describe("p-otero/no-global-error", () => {
  rule.valid(
    "allows a named error class and throwing it",
    `
      class ConfigError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "ConfigError";
        }
      }
      export const fail = () => {
        throw new ConfigError("bad config");
      };
    `,
  );

  rule.valid(
    "allows narrowing on a named error class",
    `
      class ConfigError extends Error {}
      export const describe = (error: unknown) =>
        error instanceof ConfigError ? error.message : String(error);
    `,
  );

  rule.valid(
    "allows a local binding named Error",
    `
      import { Error } from "./errors.ts";
      export const fail = () => new Error("bad");
    `,
  );

  rule.invalid(
    "reports new Error",
    `export const fail = () => new Error("bad");`,
  );

  rule.invalid(
    "reports Error called without new",
    `export const fail = () => Error("bad");`,
  );

  rule.invalid(
    "reports instanceof Error",
    `export const message = (error: unknown) => (error instanceof Error ? error.message : String(error));`,
  );
});
