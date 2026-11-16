import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

describe("p-otero/no-latest-ref-effect", () => {
  const rule = createRuleHarness("p-otero/no-latest-ref-effect", {
    filename: "src/hooks/use-autosave.ts",
  });

  rule.invalid(
    "reports an Effect without deps that only assigns ref.current",
    `
      import { useEffect, useRef } from "react";

      export function useAutosave(onSave: () => void) {
        const onSaveRef = useRef(onSave);
        useEffect(() => {
          onSaveRef.current = onSave;
        });
      }
    `,
    (output) => {
      expect(output).toContain("only copies values into `onSaveRef.current`");
      expect(output).toContain("`const onTick = useEffectEvent(() => …)`");
    },
  );

  rule.invalid(
    "reports an expression-bodied latest-ref Effect",
    `
      import { useLayoutEffect, useRef } from "react";

      export function useLatest<T>(value: T) {
        const ref = useRef(value);
        useLayoutEffect(() => void (ref.current = value));
        useLayoutEffect(() => (ref.current = value));
        return ref;
      }
    `,
  );

  rule.valid(
    "ignores Effects with a deps array by default",
    `
      import { useEffect, useRef } from "react";

      export function useTabs(tabs: string[]) {
        const tabsRef = useRef(tabs);
        useEffect(() => {
          tabsRef.current = tabs;
        }, [tabs]);
      }
    `,
  );

  rule.invalid(
    "reports Effects with a deps array when checkDependencyArrays is on",
    `
      import { useEffect, useRef } from "react";

      export function useTabs(tabs: string[]) {
        const tabsRef = useRef(tabs);
        useEffect(() => {
          tabsRef.current = tabs;
        }, [tabs]);
      }
    `,
    (output) => expect(output).toContain("`tabsRef.current`"),
    { ruleOptions: [{ checkDependencyArrays: true }] },
  );

  rule.valid(
    "ignores Effects that do more than assign refs",
    `
      import { useEffect, useRef } from "react";

      export function useFocus(active: boolean) {
        const ref = useRef<HTMLElement | null>(null);
        useEffect(() => {
          ref.current = document.activeElement as HTMLElement;
          ref.current?.focus();
        });
      }
    `,
  );
});
