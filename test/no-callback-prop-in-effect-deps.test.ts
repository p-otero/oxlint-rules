import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

describe("p-otero/no-callback-prop-in-effect-deps", () => {
  const rule = createRuleHarness("p-otero/no-callback-prop-in-effect-deps", {
    filename: "src/quick-open.tsx",
  });

  rule.invalid(
    "reports the quick-open search loop",
    `
      import { useEffect, useState } from "react";

      export function QuickOpen({ onSearch }: { onSearch: (text: string) => void }) {
        const [text] = useState("");
        useEffect(() => {
          const id = setTimeout(() => onSearch(text), 150);
          return () => clearTimeout(id);
        }, [text, onSearch]);
        return null;
      }
    `,
    (output) => {
      expect(output).toContain("`onSearch` is a callback prop");
      expect(output).toContain(
        "`const onSearchEvent = useEffectEvent(onSearch)`",
      );
      expect(output).toContain("remove `onSearch` from the dependencies");
    },
  );

  rule.invalid(
    "reports a function-typed prop from a same-file interface whatever its name",
    `
      import { useEffect } from "react";

      interface Props {
        search(text: string): void;
        text: string;
      }

      export function QuickOpen({ search, text }: Props) {
        useEffect(() => search(text), [text, search]);
        return null;
      }
    `,
    (output) => {
      expect(output).toContain("`search` is a callback prop");
      expect(output).not.toContain("`text` is a callback prop");
    },
  );

  rule.invalid(
    "reports callbacks destructured from a props parameter in the body",
    `
      import { useEffect } from "react";

      type Props = { onChange?: (value: string) => void };

      export function Field(props: Props) {
        const { onChange } = props;
        useEffect(() => onChange?.("x"), [onChange]);
        return null;
      }
    `,
  );

  rule.invalid(
    "reports props.onX member dependencies",
    `
      import { useEffect } from "react";

      export function Field(props: { onReady: () => void }) {
        useEffect(() => props.onReady(), [props.onReady]);
        return null;
      }
    `,
    (output) => expect(output).toContain("`props.onReady` is a callback prop"),
  );

  rule.invalid(
    "reports a callback parameter of a custom hook",
    `
      import { useEffect } from "react";

      export function useSearch(text: string, onResults: (r: string[]) => void) {
        useEffect(() => onResults([text]), [text, onResults]);
      }
    `,
    undefined,
    { filename: "src/hooks/use-search.ts" },
  );

  rule.valid(
    "ignores on-prefixed props typed as non-functions in the same file",
    `
      import { useEffect } from "react";

      export function Status({ onLine }: { onLine: boolean }) {
        useEffect(() => {}, [onLine]);
        return null;
      }
    `,
  );

  rule.valid(
    "ignores local callbacks and Effect Events",
    `
      import { useCallback, useEffect, useEffectEvent } from "react";

      export function Panel({ onSave }: { onSave: () => void }) {
        const save = useEffectEvent(onSave);
        const onTick = useCallback(() => save(), [save]);
        useEffect(() => onTick(), [onTick]);
        return null;
      }
    `,
  );

  rule.valid(
    "ignores dependencies of non-Effect hooks",
    `
      import { useMemo } from "react";

      export function Panel({ onSave }: { onSave: () => void }) {
        return useMemo(() => onSave, [onSave]);
      }
    `,
  );

  rule.valid(
    "honours a custom pattern",
    `
      import { useEffect } from "react";

      export function Panel({ onSave }) {
        useEffect(() => onSave(), [onSave]);
        return null;
      }
    `,
    { filename: "src/panel.jsx", ruleOptions: [{ pattern: "^handle[A-Z]" }] },
  );
});
