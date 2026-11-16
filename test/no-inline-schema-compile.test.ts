import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const rule = createRuleHarness("p-otero/no-inline-schema-compile");

describe("p-otero/no-inline-schema-compile", () => {
  rule.valid(
    "allows schema compilers hoisted to module scope",
    `
      const User = Schema.Struct({ name: Schema.String });
      const decodeUser = Schema.decodeUnknownEffect(User);

      export const parseUser = (input: unknown) => decodeUser(input);
    `,
  );

  rule.valid(
    "allows factory helpers that return a precompiled decoder",
    `
      export const makeParser = <A, I>(schema: Schema.Codec<A, I>) => {
        const decode = Schema.decodeUnknownEffect(schema);
        return (input: unknown) => decode(input);
      };
    `,
  );

  rule.valid(
    "allows schema construction helpers that use encode transformations",
    `
      export const makePrettyJson = <S extends Schema.Top>(schema: S) =>
        Schema.fromJsonString(schema).pipe(
          Schema.encode({
            decode: Schema.String,
            encode: Schema.String,
          }),
        );
    `,
  );

  rule.valid(
    "allows dynamic schema parameters that cannot be hoisted to module scope",
    `
      export const parseWith = <A, I>(schema: Schema.Codec<A, I>, input: unknown) =>
        Schema.decodeUnknownEffect(schema)(input);
    `,
  );

  rule.invalid(
    "reports schema compilers inside function bodies",
    `
      const User = Schema.Struct({ name: Schema.String });

      export const parseUser = (input: unknown) => Schema.decodeUnknownEffect(User)(input);
    `,
    (output) => {
      expect(output).toContain("Hoist Schema.decodeUnknownEffect");
    },
  );

  rule.invalid(
    "reports inline schema literals as high confidence findings",
    `
      export const parseUser = (input: unknown) =>
        Schema.decodeUnknownEffect(Schema.Struct({ name: Schema.String }))(input);
    `,
    (output) => {
      expect(output).toContain(
        "inline schema literal and the compiled function",
      );
    },
  );
});
