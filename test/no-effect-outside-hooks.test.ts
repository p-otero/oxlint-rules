import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

describe("p-otero/no-effect-outside-hooks", () => {
  const rule = createRuleHarness("p-otero/no-effect-outside-hooks", {
    filename: "src/features/search/search-box.tsx",
  });

  rule.invalid(
    "reports useEffect in a component file and names the alternatives",
    `
      import { useEffect, useState } from "react";

      export function SearchBox({ items }: { items: string[] }) {
        const [count, setCount] = useState(0);
        useEffect(() => setCount(items.length), [items]);
        return <div>{count}</div>;
      }
    `,
    (output) => {
      expect(output).toContain(
        "`useEffect` is only allowed in files matching `**/hooks/**`",
      );
      for (const alternative of [
        "during render",
        "`key`",
        "event handler",
        "`useSyncExternalStore`",
        "data hook",
        "`useEffectEvent`",
      ]) {
        expect(output).toContain(alternative);
      }
    },
  );

  rule.invalid(
    "reports React.useLayoutEffect through the default import",
    `
      import React from "react";

      export function Panel() {
        React.useLayoutEffect(() => {}, []);
        return null;
      }
    `,
    (output) => expect(output).toContain("`useLayoutEffect`"),
  );

  rule.invalid(
    "reports a namespace import",
    `
      import * as R from "react";

      export function Panel() {
        R.useInsertionEffect(() => {});
        return null;
      }
    `,
    (output) => expect(output).toContain("`useInsertionEffect`"),
  );

  rule.invalid(
    "reports an aliased import",
    `
      import { useEffect as useMountEffect } from "react";

      export function Panel() {
        useMountEffect(() => {}, []);
        return null;
      }
    `,
    (output) => expect(output).toContain("`useEffect`"),
  );

  rule.invalid(
    "reports an unimported global useEffect",
    `
      export function Panel() {
        useEffect(() => {}, []);
        return null;
      }
    `,
  );

  rule.valid(
    "allows Effects in the default hooks folder",
    `
      import { useEffect } from "react";

      export function useTitle(title: string) {
        useEffect(() => {
          document.title = title;
        }, [title]);
      }
    `,
    { filename: "src/hooks/use-title.ts" },
  );

  rule.valid(
    "allows files matching a configured glob",
    `
      import { useLayoutEffect } from "react";

      export function mountEditor() {
        useLayoutEffect(() => {}, []);
      }
    `,
    {
      filename: "src/editor/adapters/codemirror.tsx",
      ruleOptions: [{ allow: ["**/editor/adapters/**"] }],
    },
  );

  rule.invalid(
    "replaces the default allow list",
    `
      import { useEffect } from "react";

      export function useTitle() {
        useEffect(() => {}, []);
      }
    `,
    (output) => expect(output).toContain("`src/primitives/**`"),
    {
      filename: "src/hooks/use-title.ts",
      ruleOptions: [{ allow: ["src/primitives/**"] }],
    },
  );

  rule.valid(
    "restricts only the configured hooks",
    `
      import { useLayoutEffect } from "react";

      export function Panel() {
        useLayoutEffect(() => {}, []);
        return null;
      }
    `,
    { ruleOptions: [{ hooks: ["useEffect"] }] },
  );

  rule.valid(
    "ignores useEffectEvent and non-React hooks of the same name",
    `
      import { useEffectEvent } from "react";
      import { useEffect } from "./my-effect.ts";

      export function Panel({ onSave }: { onSave: () => void }) {
        const save = useEffectEvent(onSave);
        useEffect(save);
        return null;
      }
    `,
  );
});
