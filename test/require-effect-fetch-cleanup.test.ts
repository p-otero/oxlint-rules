import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

describe("p-otero/require-effect-fetch-cleanup", () => {
  const rule = createRuleHarness("p-otero/require-effect-fetch-cleanup", {
    filename: "src/user-panel.tsx",
  });

  rule.invalid(
    "reports a setter in a then callback without cleanup",
    `
      import { useEffect, useState } from "react";

      export function UserPanel({ id }: { id: string }) {
        const [user, setUser] = useState(null);
        useEffect(() => {
          fetch("/users/" + id).then((response) => setUser(response));
        }, [id]);
        return user;
      }
    `,
    (output) => {
      expect(output).toContain("calls `setUser` after async work");
      expect(output).toContain("`return () => { ignore = true; }`");
      expect(output).toContain("`return () => controller.abort()`");
      expect(output).toContain("data hook");
    },
  );

  rule.invalid(
    "reports a setter passed by reference to then",
    `
      import { useEffect, useState } from "react";

      export function UserPanel({ id, load }: { id: string; load: (id: string) => Promise<string> }) {
        const [user, setUser] = useState("");
        useEffect(() => {
          void load(id).then(setUser);
        }, [id, load]);
        return user;
      }
    `,
  );

  rule.invalid(
    "reports a setter after await in an inner async function",
    `
      import { useEffect, useState } from "react";

      export function UserPanel({ id }: { id: string }) {
        const [user, setUser] = useState(null);
        useEffect(() => {
          async function load() {
            const response = await fetch("/users/" + id);
            setUser(await response.json());
          }
          void load();
        }, [id]);
        return user;
      }
    `,
  );

  rule.invalid(
    "rejects a cleanup that does not cancel",
    `
      import { useEffect, useState } from "react";

      export function UserPanel({ id }: { id: string }) {
        const [user, setUser] = useState(null);
        useEffect(() => {
          fetch(id).then(setUser);
          return () => console.log("done");
        }, [id]);
        return user;
      }
    `,
  );

  rule.valid(
    "allows an ignore flag set in the cleanup",
    `
      import { useEffect, useState } from "react";

      export function UserPanel({ id }: { id: string }) {
        const [user, setUser] = useState(null);
        useEffect(() => {
          let ignore = false;
          fetch(id).then((response) => {
            if (!ignore) setUser(response);
          });
          return () => {
            ignore = true;
          };
        }, [id]);
        return user;
      }
    `,
  );

  rule.valid(
    "allows an abort controller",
    `
      import { useEffect, useState } from "react";

      export function UserPanel({ id }: { id: string }) {
        const [user, setUser] = useState(null);
        useEffect(() => {
          const controller = new AbortController();
          (async () => {
            const response = await fetch(id, { signal: controller.signal });
            setUser(response);
          })();
          return () => controller.abort();
        }, [id]);
        return user;
      }
    `,
  );

  rule.valid(
    "allows setters before the first await and synchronous Effects",
    `
      import { useEffect, useState } from "react";

      export function UserPanel({ id }: { id: string }) {
        const [loading, setLoading] = useState(false);
        useEffect(() => {
          async function load() {
            setLoading(true);
            await fetch(id);
          }
          void load();
        }, [id]);
        useEffect(() => {
          setLoading(false);
        }, [id]);
        return loading;
      }
    `,
  );
});
