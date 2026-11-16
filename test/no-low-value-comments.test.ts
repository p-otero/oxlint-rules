import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const rule = createRuleHarness("p-otero/no-low-value-comments");

describe("p-otero/no-low-value-comments", () => {
  rule.valid(
    "keeps a license header",
    `
      /*!
       * Copyright (c) 2026 Example.
       */
      export const value = 1;
    `,
  );

  rule.valid(
    "keeps lint and type-checker directives",
    `
      // oxlint-disable-next-line no-console
      // @ts-expect-error
      // @effect-diagnostics floatingEffect:off
      export const value = 1;
    `,
  );

  rule.valid(
    "keeps comments that explain why",
    `
      // ANSI escapes start with ESC.
      const ansi = /\\x1b\\[/u;
      export const pattern = ansi;
    `,
  );

  rule.valid(
    "keeps test markers that carry their issue number",
    `
      // regression: #123
      test("keeps the numbering", () => {});
    `,
  );

  rule.valid(
    "keeps a lone @public tag",
    `
      // @public
      export const value = 1;
    `,
  );

  rule.invalid(
    "reports a section divider",
    `
      // ==============================
      export const value = 1;
    `,
  );

  rule.invalid(
    "reports a comment that repeats the name below it",
    `
      // The user list
      const userList = ["a"];
      export const users = userList;
    `,
  );

  rule.invalid(
    "reports a TODO without an issue link",
    `
      // TODO: handle retries.
      export const value = 1;
    `,
    (output) => {
      expect(output).toContain("Link the issue that tracks this");
    },
  );

  rule.invalid(
    "reports a bare issue reference",
    `
      // Fix from #123 broke this.
      export const value = 1;
    `,
  );

  rule.invalid(
    "reports a JSDoc type annotation in TypeScript",
    `
      /**
       * @param {string} name
       */
      export const greet = (name: string) => name;
    `,
  );

  rule.invalid(
    "reports commented-out code",
    `
      // const value = 1;
      export const other = 2;
    `,
    (output) => {
      expect(output).toContain("Delete commented-out code");
    },
  );

  rule.invalid(
    "reports an empty JSDoc tag",
    `
      /**
       * @returns
       */
      export const value = 1;
    `,
  );

  rule.invalid(
    "reports a test step label",
    `
      // arrange
      const input = 1;
      export const value = input;
    `,
  );

  rule.invalid(
    "reports @public boilerplate",
    `
      // @public Service construction is part of the canonical setup.
      export const value = 1;
    `,
  );

  rule.invalid(
    "reports a comment block past the limit",
    `
      // Reads the file.
      // Opens it once.
      // Keeps the handle.
      // Retries on failure.
      // Closes the handle.
      export const read = () => 1;
    `,
    (output) => {
      expect(output).toContain("Cut this to 4 lines or fewer");
    },
  );
});
