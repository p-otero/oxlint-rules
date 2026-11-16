import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const rule = createRuleHarness("p-otero/prefer-catch-tags");

describe("p-otero/prefer-catch-tags", () => {
  rule.valid(
    "allows Effect.catchTags",
    `
      import * as Effect from "effect/Effect";

      export const program = Effect.fail({ _tag: "A" } as const).pipe(
        Effect.catchTags({ A: () => Effect.void }),
      );
    `,
  );

  rule.valid(
    "ignores catchTag on other modules",
    `
      import * as Stream from "effect/Stream";

      export const recover = Stream.catchTag("A", () => Stream.empty);
    `,
  );

  rule.valid(
    "ignores a local that shadows the namespace",
    `
      import * as Effect from "effect/Effect";

      export const program = Effect.void;
      export function recover(Effect: { catchTag: (tag: string) => void }) {
        Effect.catchTag("A");
      }
    `,
  );

  rule.invalid(
    "reports Effect.catchTag",
    `
      import * as Effect from "effect/Effect";

      export const program = Effect.fail({ _tag: "A" } as const).pipe(
        Effect.catchTag("A", () => Effect.void),
      );
    `,
    (output) => {
      expect(output).toContain("Effect.catchTags({ Tag: handler })");
    },
  );

  rule.invalid(
    "reports catchTag through an aliased namespace",
    `
      import * as Eff from "effect/Effect";

      export const recover = Eff.catchTag("A", () => Eff.void);
    `,
  );

  rule.invalid(
    "reports a named catchTag import",
    `import { catchTag } from "effect/Effect";`,
  );
});
