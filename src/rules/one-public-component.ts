import { defineRule } from "@oxlint/plugins";

import {
  collectComponents,
  componentOptions,
  coversFile,
  filesSchema,
} from "../components.ts";
import { projectPath } from "../paths.ts";

export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "A component file exposes at most one public component.",
    },
    schema: [filesSchema],
  },
  create(context) {
    const file = projectPath(context.filename);
    if (!coversFile(componentOptions(context), file)) return {};
    return collectComponents(context, (entries) => {
      const exported = entries.filter((entry) => entry.exported);
      if (exported.length <= 1) return;
      context.report({
        node: exported[1]!.node,
        message: `A module exposes at most one public component (found ${exported
          .map((entry) => entry.name)
          .join(", ")}).`,
      });
    });
  },
});
