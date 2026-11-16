/*!
 * Ported from pingdotgg/t3code (oxlint-plugin-t3code/rules/no-inline-schema-compile.ts).
 * MIT License, Copyright (c) 2026 T3 Tools Inc.
 * Changes: Effect APIs are matched by name instead of being imported from `effect`.
 */
import { defineRule } from "@oxlint/plugins";

import { getPropertyName, isIdentifier, unwrapExpression } from "../ast.ts";

const COMPILER_METHODS = new Set([
  "is",
  "asserts",
  "decodeEffect",
  "decodeExit",
  "decodeOption",
  "decodePromise",
  "decodeResult",
  "decodeSync",
  "decodeUnknownExit",
  "decodeUnknownEffect",
  "decodeUnknownOption",
  "decodeUnknownPromise",
  "decodeUnknownResult",
  "decodeUnknownSync",
  "encodeExit",
  "encodeEffect",
  "encodeOption",
  "encodePromise",
  "encodeResult",
  "encodeSync",
  "encodeUnknownExit",
  "encodeUnknownEffect",
  "encodeUnknownOption",
  "encodeUnknownPromise",
  "encodeUnknownResult",
  "encodeUnknownSync",
]);

const getSchemaCompilerMethod = (callee: unknown): string | undefined => {
  const expression = unwrapExpression(callee);
  if (expression?.type !== "MemberExpression") return undefined;

  const object = unwrapExpression(expression.object);
  if (!isIdentifier(object, "Schema")) return undefined;

  const method = getPropertyName(expression.property);
  return method !== undefined && COMPILER_METHODS.has(method)
    ? method
    : undefined;
};

const isStaticSchemaReference = (node: unknown): boolean => {
  const expression = unwrapExpression(node);
  if (expression === undefined) return false;

  if (expression.type === "Identifier") {
    const [firstChar] = expression.name;
    return firstChar !== undefined && firstChar.toUpperCase() === firstChar;
  }

  return expression.type === "MemberExpression";
};

const isNestedStaticSchemaCall = (node: unknown): boolean => {
  const expression = unwrapExpression(node);
  if (expression?.type !== "CallExpression") return false;

  const callee = unwrapExpression(expression.callee);
  if (callee?.type !== "MemberExpression") return false;

  const object = unwrapExpression(callee.object);
  if (!isIdentifier(object, "Schema")) return false;

  const method = getPropertyName(callee.property);
  if (method === "fromJsonString") {
    const firstArg = expression.arguments[0];
    return (
      isStaticSchemaReference(firstArg) || isNestedStaticSchemaCall(firstArg)
    );
  }

  return true;
};

const isImmediatelyInvoked = (node: unknown): boolean => {
  const expression = unwrapExpression(node);
  if (expression === undefined) return false;

  const parent =
    "parent" in expression ? unwrapExpression(expression.parent) : undefined;
  return (
    parent?.type === "CallExpression" &&
    unwrapExpression(parent.callee) === expression
  );
};

const messageHigh = (method: string) =>
  `Hoist Schema.${method}(...) to module scope: both the inline schema literal and the compiled function are rebuilt on every call. Move the compiled function to a module-level const.`;

const messageMedium = (method: string) =>
  `Hoist Schema.${method}(...) to module scope: the compiled function is rebuilt on every call. Move it to a module-level const.`;

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Schema decoder/encoder compiler calls inside function bodies; hoist them to module scope.",
    },
  },
  createOnce(context) {
    let functionDepth = 0;

    const resetFunctionDepth = () => {
      functionDepth = 0;
    };

    const enterFunction = () => {
      functionDepth++;
    };

    const exitFunction = () => {
      functionDepth--;
    };

    return {
      before: resetFunctionDepth,
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      CallExpression(node) {
        if (functionDepth === 0) return;

        const method = getSchemaCompilerMethod(node.callee);
        if (method === undefined) return;
        if (!isImmediatelyInvoked(node)) return;

        const firstArg = node.arguments[0];
        const high = firstArg && isNestedStaticSchemaCall(firstArg);
        if (!high && !isStaticSchemaReference(firstArg)) return;

        context.report({
          node: node.callee,
          message: high ? messageHigh(method) : messageMedium(method),
        });
      },
    };
  },
});
