import { defineRule, type ESTree } from "@oxlint/plugins";

const CONSTRUCT_MESSAGE =
  "Throw a named error class (`class ConfigError extends Error`) so callers can tell failures apart, not the global `Error`.";
const NARROW_MESSAGE =
  "Narrow on a named error class, not `instanceof Error`; show an unknown error with `String(error)`.";

export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow constructing the global `Error` and narrowing with `instanceof Error`.",
    },
  },
  create(context) {
    const isGlobalError = (node: ESTree.Node) => {
      if (node.type !== "Identifier" || node.name !== "Error") return false;
      let scope = context.sourceCode.getScope(node);
      while (true) {
        const variable = scope.set.get("Error");
        if (variable !== undefined) return variable.defs.length === 0;
        if (scope.upper === null) return true;
        scope = scope.upper;
      }
    };

    return {
      NewExpression(node) {
        if (isGlobalError(node.callee)) {
          context.report({ node, message: CONSTRUCT_MESSAGE });
        }
      },
      CallExpression(node) {
        if (isGlobalError(node.callee)) {
          context.report({ node, message: CONSTRUCT_MESSAGE });
        }
      },
      BinaryExpression(node) {
        if (node.operator === "instanceof" && isGlobalError(node.right)) {
          context.report({ node, message: NARROW_MESSAGE });
        }
      },
    };
  },
});
