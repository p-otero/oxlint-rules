import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

const ui = `export const Widget = 1;
`;
const core = `export const local = 1;
`;
const layerBoundary = {
  id: "LAYER-1",
  message: "core must not import ui",
  from: "^src/core/",
  to: "^src/ui/",
};
const files = {
  "src/ui/widget.ts": ui,
  "src/core/local.ts": core,
};

const rule = createRuleHarness("p-otero/import-boundaries", {
  ruleOptions: [{ boundaries: [layerBoundary] }],
  files,
});

describe("p-otero/import-boundaries", () => {
  rule.valid(
    "allows imports inside the layer",
    `
      import { local } from "./local.ts";
      export const app = local;
    `,
    {
      filename: "src/core/app.ts",
      lint: ["src/core/app.ts", "src/ui/widget.ts"],
    },
  );

  rule.valid(
    "allows type-only imports across a boundary",
    `
      import type { Widget } from "../ui/widget.ts";
      export type Value = Widget;
    `,
    { filename: "src/core/app.ts" },
  );

  rule.valid(
    "allows imports used only as types",
    `
      import { Widget } from "../ui/widget.ts";
      export type Value = Widget;
    `,
    { filename: "src/core/app.ts" },
  );

  rule.valid(
    "allows type-only re-exports",
    `export type { Widget } from "../ui/widget.ts";`,
    { filename: "src/core/app.ts" },
  );

  rule.invalid(
    "reports a relative import across the boundary",
    `
      import { Widget } from "../ui/widget.ts";
      export const app = Widget;
    `,
    (output) => {
      expect(output).toContain(
        'LAYER-1: core must not import ui (imports "../ui/widget.ts")',
      );
    },
    { filename: "src/core/app.ts" },
  );

  rule.invalid(
    "reports a value re-export across the boundary",
    `export { Widget } from "../ui/widget.ts";`,
    undefined,
    { filename: "src/core/app.ts" },
  );

  rule.invalid(
    "reports a dynamic import across the boundary",
    `export const load = () => import("../ui/widget.ts");`,
    undefined,
    { filename: "src/core/app.ts" },
  );

  rule.invalid(
    "reports require across the boundary",
    `
      const widget = require("../ui/widget.ts");
      export { widget };
    `,
    undefined,
    { filename: "src/core/app.ts" },
  );

  rule.valid(
    "respects the scope option",
    `
      import { Widget } from "../ui/widget.ts";
      export const app = Widget;
    `,
    {
      filename: "src/core/app.ts",
      ruleOptions: [
        {
          scope: "^src/web/",
          boundaries: [{ id: "ALL", message: "no ui imports", to: "^src/ui/" }],
        },
      ],
    },
  );

  rule.valid(
    "allows npm imports when only node builtins are banned",
    `
      import { useState } from "react";
      export const value = useState(0);
    `,
    {
      filename: "src/web/app.ts",
      ruleOptions: [
        {
          boundaries: [
            {
              id: "NO-NODE",
              message: "web must not import node builtins",
              from: "^src/web/",
              dependencyTypes: ["core"],
            },
          ],
        },
      ],
    },
  );

  rule.invalid(
    "reports node builtins by dependency type",
    `
      import * as NodeFS from "node:fs";
      export const fs = NodeFS;
    `,
    (output) => {
      expect(output).toContain("NO-NODE: web must not import node builtins");
    },
    {
      filename: "src/web/app.ts",
      ruleOptions: [
        {
          boundaries: [
            {
              id: "NO-NODE",
              message: "web must not import node builtins",
              from: "^src/web/",
              dependencyTypes: ["core"],
            },
          ],
        },
      ],
    },
  );

  rule.invalid(
    "maps workspace packages to their folders",
    `
      import { Button } from "@repo/ui/button";
      export const button = Button;
    `,
    (output) => {
      expect(output).toContain(
        'UI-CONFINE: ui package imports stay inside the ui layer (imports "@repo/ui/button")',
      );
    },
    {
      filename: "src/web/app.ts",
      ruleOptions: [
        {
          workspacePackages: { "@repo/ui": "packages/ui" },
          boundaries: [
            {
              id: "UI-CONFINE",
              message: "ui package imports stay inside the ui layer",
              from: "^src/web/",
              to: "^packages/ui/",
            },
          ],
        },
      ],
    },
  );

  rule.invalid(
    "reports banned npm packages",
    `
      import { debounce } from "lodash";
      export const value = debounce;
    `,
    undefined,
    {
      filename: "src/app.ts",
      ruleOptions: [
        {
          boundaries: [
            { id: "NO-LODASH", message: "lodash is banned", to: "^lodash$" },
          ],
        },
      ],
    },
  );
});
