import path from "node:path";
import type { Context, ESTree, Visitor } from "@oxlint/plugins";

import { matchesPattern, compilePattern } from "./paths.ts";

const PASCAL_CASE = /^[A-Z]/u;
const DEFAULT_FILES = "\\.tsx$";
const WRAPPER_EXPRESSIONS = new Set([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
]);

type SourceCode = Context["sourceCode"];
type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

export type ComponentEntry = {
  node: ESTree.Node;
  name: string;
  exported: boolean;
  loc: number;
};

export type ComponentRuleOptions = {
  files?: string;
  exempt?: string;
  maxLoc?: number;
};

export const filesSchema = {
  type: "object",
  properties: {
    files: { type: "string" },
    exempt: { type: "string" },
  },
  additionalProperties: false,
};

export const limitsSchema = {
  type: "object",
  properties: {
    files: { type: "string" },
    exempt: { type: "string" },
    maxLoc: { type: "integer", minimum: 1 },
  },
  additionalProperties: false,
};

export function componentOptions(context: Context): ComponentRuleOptions {
  return (context.options[0] ?? {}) as ComponentRuleOptions;
}

export function coversFile(
  options: ComponentRuleOptions,
  file: string,
): boolean {
  const files = compilePattern(options.files ?? DEFAULT_FILES);
  const exempt = compilePattern(options.exempt);
  return matchesPattern(files, file) && !(exempt?.test(file) ?? false);
}

function unwrap(expression: ESTree.Expression): ESTree.Expression {
  let current = expression;
  while (WRAPPER_EXPRESSIONS.has(current.type)) {
    current = (current as ESTree.Expression & { expression: ESTree.Expression })
      .expression;
  }
  return current;
}

function isFunction(node: ESTree.Expression): node is FunctionNode {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  );
}

function calleeName(callee: ESTree.Expression): string | null {
  if (callee.type === "Identifier") return callee.name;
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "React" &&
    callee.property.type === "Identifier"
  ) {
    return callee.property.name;
  }
  return null;
}

type WrappedComponent = {
  kind: "memo" | "forward-ref";
  fn: FunctionNode;
};

function wrappedComponent(
  expression: ESTree.Expression,
): WrappedComponent | null {
  const call = unwrap(expression);
  if (call.type !== "CallExpression") return null;
  const first = call.arguments[0];
  if (first === undefined || first.type === "SpreadElement") return null;
  const name = calleeName(call.callee);
  if (name === "memo") {
    const inner = wrappedComponent(first);
    if (inner?.kind === "forward-ref") return inner;
    const fn = unwrap(first);
    return isFunction(fn) ? { kind: "memo", fn } : null;
  }
  if (name === "forwardRef") {
    const fn = unwrap(first);
    return isFunction(fn) ? { kind: "forward-ref", fn } : null;
  }
  return null;
}

// The signature is excluded: multi-line props are not component complexity.
function bodyLoc(sourceCode: SourceCode, fn: FunctionNode): number {
  const text = sourceCode.text;
  const body = fn.body;
  if (body === null) return 0;
  let start = body.start;
  let end = body.end;
  if (body.type !== "BlockStatement") {
    let opened = 0;
    for (
      let index = start - 1;
      index >= 0 && /[\s(]/u.test(text[index]!);
      index -= 1
    ) {
      if (text[index] === "(") {
        opened += 1;
        start = index;
      }
    }
    for (
      let index = end;
      index < text.length && opened > 0 && /[\s)]/u.test(text[index]!);
      index += 1
    ) {
      if (text[index] === ")") {
        opened -= 1;
        end = index + 1;
      }
    }
  }
  return (
    sourceCode.getLocFromIndex(end).line -
    sourceCode.getLocFromIndex(start).line +
    1
  );
}

function isModuleScopeDeclaration(node: ESTree.Node): boolean {
  if (node.type === "VariableDeclarator") {
    const declaration = node.parent;
    return (
      declaration.type === "VariableDeclaration" &&
      declaration.parent?.type === "Program"
    );
  }
  return node.parent?.type === "Program";
}

function exportedValueName(specifier: ESTree.ExportSpecifier): string | null {
  if (specifier.exportKind === "type") return null;
  return specifier.local.type === "Identifier" ? specifier.local.name : null;
}

export function componentFileStem(file: string): string {
  const base = path.posix.basename(file);
  return base.replace(/\.[cm]?[jt]sx?$/u, "");
}

export function pascalCase(stem: string): string {
  return stem
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}

export function collectComponents(
  context: Context,
  onComplete: (entries: ComponentEntry[]) => void,
): Visitor {
  const entries: ComponentEntry[] = [];
  const exportedNames = new Set<string>();
  return {
    ExportNamedDeclaration(node) {
      if (node.declaration !== null || node.source !== null) return;
      if (node.exportKind === "type") return;
      for (const specifier of node.specifiers) {
        const name = exportedValueName(specifier);
        if (name !== null) exportedNames.add(name);
      }
    },
    ExportDefaultDeclaration(node) {
      if (node.declaration.type === "Identifier") {
        exportedNames.add(node.declaration.name);
      }
    },
    FunctionDeclaration(node) {
      if (
        node.id === null ||
        !PASCAL_CASE.test(node.id.name) ||
        node.body === null
      ) {
        return;
      }
      entries.push({
        node,
        name: node.id.name,
        exported:
          node.parent.type === "ExportNamedDeclaration" ||
          node.parent.type === "ExportDefaultDeclaration",
        loc: bodyLoc(context.sourceCode, node),
      });
    },
    VariableDeclaration(node) {
      if (/^For(In|Of)?Statement$/u.test(node.parent.type)) return;
      const exported = node.parent.type === "ExportNamedDeclaration";
      for (const declarator of node.declarations) {
        if (
          declarator.id.type !== "Identifier" ||
          !PASCAL_CASE.test(declarator.id.name) ||
          declarator.init === null
        ) {
          continue;
        }
        const expression = unwrap(declarator.init);
        const fn = isFunction(expression)
          ? expression
          : wrappedComponent(expression)?.fn;
        if (fn === undefined) continue;
        entries.push({
          node: declarator,
          name: declarator.id.name,
          exported,
          loc: bodyLoc(context.sourceCode, fn),
        });
      }
    },
    "Program:exit"() {
      for (const entry of entries) {
        if (entry.exported) continue;
        entry.exported =
          isModuleScopeDeclaration(entry.node) && exportedNames.has(entry.name);
      }
      onComplete(entries);
    },
  };
}
