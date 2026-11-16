/*!
 * Ported from pingdotgg/t3code (oxlint-plugin-t3code/utils.ts).
 * MIT License, Copyright (c) 2026 T3 Tools Inc.
 * Changes: plain values instead of Effect Option.
 */
import type { ESTree } from "@oxlint/plugins";
export type AstNode = ESTree.Node;
export declare function asNode(value: unknown): AstNode | undefined;
export declare function unwrapExpression(value: unknown): AstNode | undefined;
export declare function getPropertyName(value: unknown): string | undefined;
export declare function isIdentifier(value: unknown, name?: string): boolean;
