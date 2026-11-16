import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const rule = createRuleHarness("p-otero/namespace-node-imports");

describe("p-otero/namespace-node-imports", () => {
  rule.valid(
    "allows canonical Node namespaces",
    `
      import * as NodeFS from "node:fs";
      import * as NodeFSP from "node:fs/promises";
      import * as NodeAssert from "node:assert/strict";
      import * as NodeChildProcess from "node:child_process";
      import * as NodeTimersPromises from "node:timers/promises";
      import type * as NodeStream from "node:stream";

      NodeAssert.ok(NodeChildProcess.spawn && NodeTimersPromises.setTimeout);
      export const read = NodeFS.readFileSync;
      export const readAsync = NodeFSP.readFile;
      export type Input = NodeStream.Readable;
    `,
  );

  rule.valid(
    "does not apply to non-Node packages",
    `
      import { spawn } from "electron";

      export const process = spawn;
    `,
  );

  rule.invalid(
    "reports named imports",
    `
      import { readFile } from "node:fs/promises";
      export const read = readFile;
    `,
    (output) => {
      expect(output).toContain("namespace named NodeFSP");
    },
  );

  rule.invalid(
    "reports default imports",
    `
      import path from "node:path";
      export const join = path.join;
    `,
    (output) => {
      expect(output).toContain("namespace named NodePath");
    },
  );

  rule.invalid(
    "reports non-canonical namespace aliases",
    `
      import * as Crypto from "node:crypto";
      import * as NodeOs from "node:os";
      export const values = [Crypto, NodeOs];
    `,
    (output) => {
      expect(output).toContain("namespace named NodeCrypto");
      expect(output).toContain("namespace named NodeOS");
    },
  );
});
