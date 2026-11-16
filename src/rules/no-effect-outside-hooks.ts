import path from "node:path";
import { defineRule } from "@oxlint/plugins";

import { EFFECT_HOOKS, effectCall } from "../effects.ts";
import { projectPath } from "../paths.ts";

const DEFAULT_ALLOW = ["**/hooks/**"];

type Options = {
  allow?: string[];
  hooks?: string[];
};

const message = (hook: string, allow: readonly string[]) =>
  `\`${hook}\` is only allowed in files matching ${allow.map((glob) => `\`${glob}\``).join(", ")}. ` +
  "Replace it: compute derived values during render; reset state on prop change with a `key`; " +
  "run user-triggered logic in the event handler; read external stores with `useSyncExternalStore`; " +
  "load data through a data hook; read the latest props in an existing Effect with `useEffectEvent`. " +
  "Only a real external-system sync belongs in an Effect: move it into a custom hook in an allowed file.";

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Confine `useEffect`, `useLayoutEffect` and `useInsertionEffect` to approved files.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
          hooks: {
            type: "array",
            items: { type: "string", enum: EFFECT_HOOKS },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const allow = options.allow ?? DEFAULT_ALLOW;
    const file = projectPath(context.filename);
    if (allow.some((glob) => path.posix.matchesGlob(file, glob))) return {};
    const hooks = options.hooks ?? EFFECT_HOOKS;

    return {
      CallExpression(node) {
        const effect = effectCall(context, node, hooks);
        if (effect === undefined) return;
        context.report({
          node: node.callee,
          message: message(effect.hook, allow),
        });
      },
    };
  },
});
