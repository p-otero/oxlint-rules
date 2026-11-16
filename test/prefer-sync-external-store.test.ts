import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

describe("p-otero/prefer-sync-external-store", () => {
  const rule = createRuleHarness("p-otero/prefer-sync-external-store", {
    filename: "src/hooks/use-online.ts",
  });

  rule.invalid(
    "reports window listeners that mirror a value into state",
    `
      import { useEffect, useState } from "react";

      export function useOnline() {
        const [online, setOnline] = useState(true);
        useEffect(() => {
          const update = () => setOnline(navigator.onLine);
          window.addEventListener("online", update);
          return () => window.removeEventListener("online", update);
        }, []);
        return online;
      }
    `,
    (output) => {
      expect(output).toContain("subscribes with `addEventListener`");
      expect(output).toContain(
        "`useSyncExternalStore(subscribe, getSnapshot)`",
      );
    },
  );

  rule.invalid(
    "reports store.subscribe with an inline listener",
    `
      import { useEffect, useState } from "react";

      export function useCount(store: { get(): number; subscribe(fn: () => void): () => void }) {
        const [count, setCount] = useState(store.get());
        useEffect(() => store.subscribe(() => setCount(store.get())), [store]);
        return count;
      }
    `,
    (output) => expect(output).toContain("`subscribe`"),
  );

  rule.invalid(
    "reports a setter passed directly as the listener",
    `
      import { useEffect, useState } from "react";

      export function useTheme(query: MediaQueryList) {
        const [event, setEvent] = useState<MediaQueryListEvent | null>(null);
        useEffect(() => {
          query.addListener(setEvent);
          return () => query.removeListener(setEvent);
        }, [query]);
        return event;
      }
    `,
  );

  rule.valid(
    "ignores user-input events",
    `
      import { useEffect, useState } from "react";

      export function useShortcut() {
        const [open, setOpen] = useState(false);
        useEffect(() => {
          const onKey = (event: KeyboardEvent) => {
            if (event.key === "k") setOpen(true);
          };
          window.addEventListener("keydown", onKey);
          return () => window.removeEventListener("keydown", onKey);
        }, []);
        return open;
      }
    `,
  );

  rule.valid(
    "ignores listeners that do not set state",
    `
      import { useEffect } from "react";

      export function useFlushOnHide(flush: () => void) {
        useEffect(() => {
          window.addEventListener("pagehide", flush);
          return () => window.removeEventListener("pagehide", flush);
        }, [flush]);
      }
    `,
  );

  rule.valid(
    "honours a custom ignore list",
    `
      import { useEffect, useState } from "react";

      export function useWidth() {
        const [width, setWidth] = useState(0);
        useEffect(() => {
          const update = () => setWidth(window.innerWidth);
          window.addEventListener("resize", update);
          return () => window.removeEventListener("resize", update);
        }, []);
        return width;
      }
    `,
    { ruleOptions: [{ ignoreEvents: ["resize"] }] },
  );
});
