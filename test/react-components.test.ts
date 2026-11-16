import { describe, expect } from "bun:test";

import { createRuleHarness } from "./harness.ts";

describe("p-otero/one-public-component", () => {
  const rule = createRuleHarness("p-otero/one-public-component");

  rule.valid(
    "allows one exported component plus a private helper",
    `
      function format(label: string) {
        return label.trim();
      }

      export function UserCard({ label }: { label: string }) {
        return <div>{format(label)}</div>;
      }
    `,
    { filename: "src/user-card.tsx" },
  );

  rule.valid(
    "allows a memo-wrapped component",
    `
      import { memo } from "react";

      export const UserCard = memo(function UserCard() {
        return <div />;
      });
    `,
    { filename: "src/user-card.tsx" },
  );

  rule.valid(
    "ignores non-component files",
    `
      export const first = (value: number) => value;
      export const second = (value: number) => value;
    `,
    { filename: "src/math.ts" },
  );

  rule.invalid(
    "reports a second exported component",
    `
      export const First = () => <div />;
      export const Second = () => <div />;
    `,
    (output) => {
      expect(output).toContain("found First, Second");
    },
    { filename: "src/card.tsx" },
  );

  rule.valid(
    "counts a component exported through an export list as public",
    `
      function First() { return <div />; }
      function Helper() { return <span />; }
      export { First };
    `,
    { filename: "src/card.tsx" },
  );

  rule.valid(
    "counts a component exported as the default binding as public",
    `
      function UserCard() { return <div />; }
      export { UserCard as default };
    `,
    { filename: "src/user-card.tsx" },
  );

  rule.invalid(
    "reports a second component exported through an export list",
    `
      function First() { return <div />; }
      function Second() { return <div />; }
      export { First, Second };
    `,
    (output) => {
      expect(output).toContain("found First, Second");
    },
    { filename: "src/card.tsx" },
  );

  rule.invalid(
    "applies the files option",
    `
      export const First = () => <div />;
      export const Second = () => <div />;
    `,
    undefined,
    {
      filename: "src/card.js",
      ruleOptions: [{ files: "\\.[jt]sx?$" }],
    },
  );
});

describe("p-otero/component-name-matches-file", () => {
  const rule = createRuleHarness("p-otero/component-name-matches-file");

  rule.valid(
    "allows a component matching the file name",
    `export function UserCard() { return <div />; }`,
    { filename: "src/user-card.tsx" },
  );

  rule.valid(
    "allows a component that is a suffix of the file name",
    `
      export function List() { return <div />; }
      export const helper = 1;
    `,
    { filename: "src/user-card-list.tsx" },
  );

  rule.valid(
    "honors the exempt pattern",
    `export function SomethingElse() { return <div />; }`,
    {
      filename: "src/index.tsx",
      ruleOptions: [{ exempt: "(^|/)index\\.tsx$" }],
    },
  );

  rule.valid(
    "ignores private components",
    `
      function PrivateRow() { return <div />; }
      export function UserCard() { return <div />; }
    `,
    { filename: "src/user-card.tsx" },
  );

  rule.invalid(
    "reports a public component with another name",
    `export function Profile() { return <div />; }`,
    (output) => {
      expect(output).toContain("expected UserCard, found Profile");
    },
    { filename: "src/user-card.tsx" },
  );

  rule.valid(
    "allows a component exported through an export list",
    `
      function UserCard() { return <div />; }
      export { UserCard };
    `,
    { filename: "src/user-card.tsx" },
  );

  rule.invalid(
    "reports a component exported through an export list with another name",
    `
      function Profile() { return <div />; }
      export { Profile };
    `,
    (output) => {
      expect(output).toContain("expected UserCard, found Profile");
    },
    { filename: "src/user-card.tsx" },
  );

  rule.invalid(
    "reports a default-exported component with another name",
    `
      function Profile() { return <div />; }
      export default Profile;
    `,
    (output) => {
      expect(output).toContain("expected UserCard, found Profile");
    },
    { filename: "src/user-card.tsx" },
  );
});

describe("p-otero/no-large-private-component", () => {
  const rule = createRuleHarness("p-otero/no-large-private-component");

  rule.valid(
    "allows a small private component",
    `
    function Row() {
      return <div />;
    }
    export const row = Row;
  `,
    {
      filename: "src/row.tsx",
      ruleOptions: [{ maxLoc: 3 }],
    },
  );

  rule.valid(
    "allows a large exported component",
    `
    export function Row() {
      const a = 1;
      const b = 2;
      const c = 3;
      return <div>{a + b + c}</div>;
    }
  `,
    {
      filename: "src/row.tsx",
      ruleOptions: [{ maxLoc: 3 }],
    },
  );

  rule.invalid(
    "reports a private component past the option limit",
    `
      function Row() {
        const a = 1;
        const b = 2;
        const c = 3;
        return <div>{a + b + c}</div>;
      }
      export const row = Row;
    `,
    (output) => {
      expect(output).toContain("Private components over 3 lines");
      expect(output).toContain("Row has 6");
    },
    { filename: "src/row.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );

  rule.valid(
    "allows a large component exported through an export list",
    `
      function Row() {
        const a = 1;
        const b = 2;
        const c = 3;
        return <div>{a + b + c}</div>;
      }
      export { Row };
    `,
    { filename: "src/row.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );

  rule.valid(
    "allows a large component exported through an export list by variable",
    `
      const Row = () => {
        const a = 1;
        const b = 2;
        const c = 3;
        return <div>{a + b + c}</div>;
      };
      export { Row };
    `,
    { filename: "src/row.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );

  rule.valid(
    "allows a large default-exported component",
    `
      function Row() {
        const a = 1;
        const b = 2;
        const c = 3;
        return <div>{a + b + c}</div>;
      }
      export default Row;
    `,
    { filename: "src/row.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );

  rule.invalid(
    "does not export a nested component through an export list",
    `
      function UserCard() {
        function Row() {
          const a = 1;
          const b = 2;
          return <div>{a + b}</div>;
        }
        return <Row />;
      }
      export { UserCard };
    `,
    (output) => {
      expect(output).toContain("Row has 5");
    },
    { filename: "src/user-card.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );
});

describe("p-otero/max-component-lines", () => {
  const rule = createRuleHarness("p-otero/max-component-lines");

  rule.valid(
    "allows a component within the option limit",
    `
      export function Row() {
        return <div />;
      }
    `,
    { filename: "src/row.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );

  rule.invalid(
    "reports a component past the option limit",
    `
      export function Row() {
        const a = 1;
        const b = 2;
        return <div>{a + b}</div>;
      }
    `,
    (output) => {
      expect(output).toContain("Components must stay within 3 lines");
      expect(output).toContain("Row has 5");
    },
    { filename: "src/row.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );

  rule.valid(
    "collects a component exported through an export list",
    `
      function Row() {
        return <div />;
      }
      export { Row };
    `,
    { filename: "src/row.tsx", ruleOptions: [{ maxLoc: 3 }] },
  );
});
