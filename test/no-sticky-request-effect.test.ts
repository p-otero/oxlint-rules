import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

describe("p-otero/no-sticky-request-effect", () => {
  const rule = createRuleHarness("p-otero/no-sticky-request-effect", {
    filename: "src/brain-workspace.tsx",
  });

  rule.invalid(
    "reports a request prop re-applied whenever another dependency changes",
    `
      import { useEffect } from "react";

      export function Workspace({ requestedNoteRef, openNote }: {
        requestedNoteRef: string | null;
        openNote: (ref: string) => Promise<void>;
      }) {
        useEffect(() => {
          if (requestedNoteRef) void openNote(requestedNoteRef);
        }, [openNote, requestedNoteRef]);
        return null;
      }
    `,
    (output) => {
      expect(output).toContain(
        "`requestedNoteRef` is a request prop that this `useEffect` never clears",
      );
      expect(output).toContain("also depends on `openNote`");
      expect(output).toContain("`onRequestConsumed()`");
    },
  );

  rule.valid(
    "allows an Effect that only depends on the request",
    `
      import { useEffect } from "react";

      export function List({ requestedId, select }: { requestedId: string; select: (id: string) => void }) {
        useEffect(() => select(requestedId), [requestedId]);
        return null;
      }
    `,
  );

  rule.valid(
    "allows an Effect that consumes the request",
    `
      import { useEffect } from "react";

      export function List({ requestedId, items, onRequestConsumed }: {
        requestedId: string | null;
        items: string[];
        onRequestConsumed: () => void;
      }) {
        useEffect(() => {
          if (requestedId && items.includes(requestedId)) onRequestConsumed();
        }, [requestedId, items, onRequestConsumed]);
        return null;
      }
    `,
  );

  rule.valid(
    "allows an Effect that remembers the handled request in a ref",
    `
      import { useEffect, useRef } from "react";

      export function List({ requestedId, items }: { requestedId: string; items: string[] }) {
        const handledRef = useRef<string | null>(null);
        useEffect(() => {
          if (handledRef.current === requestedId) return;
          handledRef.current = requestedId;
        }, [requestedId, items]);
        return null;
      }
    `,
  );

  rule.invalid(
    "reports a request compared against a changing list",
    `
      import { useEffect, useState } from "react";

      export function useIdeas({ items, requestedCaptureId }: { items: { id: string }[]; requestedCaptureId?: string }) {
        const [, setSelectedId] = useState<string | null>(null);
        useEffect(() => {
          const capture = items.find((item) => item.id === requestedCaptureId);
          if (capture) setSelectedId(capture.id);
        }, [items, requestedCaptureId]);
      }
    `,
  );

  rule.valid(
    "allows an Effect that only checks whether a request is present",
    `
      import { useEffect } from "react";

      export function Chat({ requestedSessionId, sessions, open }: {
        requestedSessionId?: string;
        sessions: string[];
        open: (id: string) => void;
      }) {
        useEffect(() => {
          if (requestedSessionId !== undefined || sessions.length === 0) return;
          open(sessions[0]);
        }, [open, requestedSessionId, sessions]);
        return null;
      }
    `,
  );

  rule.valid(
    "ignores request-like local state",
    `
      import { useEffect, useState } from "react";

      export function List({ items }: { items: string[] }) {
        const [requestedId] = useState("a");
        useEffect(() => {}, [requestedId, items]);
        return null;
      }
    `,
  );
});
