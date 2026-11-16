import { defineRule, type ESTree } from "@oxlint/plugins";

import { getPropertyName, unwrapExpression, type AstNode } from "../ast.ts";
import { effectCall } from "../effects.ts";

type Options = { checkDependencyArrays?: boolean };

const message = (refs: readonly string[], hook: string) =>
  `This \`${hook}\` only copies values into ${refs.map((ref) => `\`${ref}\``).join(", ")} after render (the latest-ref pattern), ` +
  "so anything that reads the ref during render or before the Effect runs sees the previous value. " +
  "Wrap the code that needs the latest props or state in an Effect Event (`const onTick = useEffectEvent(() => …)`), " +
  "call it from the Effect or listener that used the ref, and delete the ref and this Effect.";

function refAssignmentTarget(value: AstNode | undefined): string | undefined {
  const expression = unwrapExpression(value);
  const node =
    expression?.type === "UnaryExpression" && expression.operator === "void"
      ? unwrapExpression(expression.argument)
      : expression;
  if (
    node?.type !== "AssignmentExpression" ||
    node.operator !== "=" ||
    node.left.type !== "MemberExpression" ||
    getPropertyName(node.left.property) !== "current"
  ) {
    return undefined;
  }
  const target = node.left.object;
  return target.type === "Identifier" ? `${target.name}.current` : "a ref";
}

function assignedRefs(body: ESTree.Node | null | undefined): string[] {
  if (body?.type !== "BlockStatement") {
    const target = refAssignmentTarget(body ?? undefined);
    return target === undefined ? [] : [target];
  }
  const targets = body.body.map((statement) =>
    statement.type === "ExpressionStatement"
      ? refAssignmentTarget(statement.expression)
      : undefined,
  );
  return targets.length > 0 && targets.every((target) => target !== undefined)
    ? (targets as string[])
    : [];
}

export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow Effects that only mirror values into refs; use `useEffectEvent`.",
    },
    schema: [
      {
        type: "object",
        properties: { checkDependencyArrays: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    return {
      CallExpression(node) {
        const effect = effectCall(context, node);
        if (effect?.callback === undefined) return;
        if (effect.hasDepsArgument && options.checkDependencyArrays !== true) {
          return;
        }
        const refs = assignedRefs(effect.callback.body);
        if (refs.length === 0) return;
        context.report({
          node: node.callee,
          message: message(refs, effect.hook),
        });
      },
    };
  },
});
