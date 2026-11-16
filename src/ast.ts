/*!
 * Ported from pingdotgg/t3code (oxlint-plugin-t3code/utils.ts).
 * MIT License, Copyright (c) 2026 T3 Tools Inc.
 * Changes: plain values instead of Effect Option.
 */
import type { ESTree } from "@oxlint/plugins";

const WRAPPER_TYPES = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "TSTypeAssertion",
]);

export type AstNode = ESTree.Node;

export function asNode(value: unknown): AstNode | undefined {
  return typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
    ? (value as AstNode)
    : undefined;
}

export function unwrapExpression(value: unknown): AstNode | undefined {
  let node = asNode(value);
  while (node !== undefined && WRAPPER_TYPES.has(node.type)) {
    node = asNode((node as AstNode & { expression: unknown }).expression);
  }
  return node;
}

export function getPropertyName(value: unknown): string | undefined {
  const node = asNode(value);
  if (node === undefined) return undefined;
  if (node.type === "Identifier" || node.type === "PrivateIdentifier") {
    return node.name;
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  return undefined;
}

export function isIdentifier(value: unknown, name?: string): boolean {
  const node = asNode(value);
  return (
    node?.type === "Identifier" && (name === undefined || node.name === name)
  );
}
