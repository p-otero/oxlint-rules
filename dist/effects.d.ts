import type { Context, ESTree, Variable } from "@oxlint/plugins";
import { type AstNode } from "./ast.ts";
export declare const EFFECT_HOOKS: string[];
export type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;
export type EffectCall = {
    node: ESTree.CallExpression;
    hook: string;
    callback: FunctionNode | undefined;
    deps: ESTree.ArrayExpression | undefined;
    hasDepsArgument: boolean;
};
export declare function isFunctionNode(node: AstNode | undefined): node is FunctionNode;
export declare function findVariable(context: Context, identifier: ESTree.Node & {
    name: string;
}): Variable | undefined;
export declare function reactHookName(context: Context, callee: ESTree.Node): string | undefined;
export declare function effectCall(context: Context, node: ESTree.CallExpression, hooks?: readonly string[]): EffectCall | undefined;
export declare function walk(context: Context, node: AstNode, visit: (node: AstNode) => boolean | void): void;
export declare function isStateSetter(context: Context, identifier: ESTree.Node & {
    name: string;
}): boolean;
export declare function callsStateSetter(context: Context, root: AstNode): boolean;
export declare function isParameterBinding(context: Context, variable: Variable | undefined): boolean;
