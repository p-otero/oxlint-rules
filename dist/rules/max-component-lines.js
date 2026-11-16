import { defineRule } from "@oxlint/plugins";
import { collectComponents, componentOptions, coversFile, limitsSchema, } from "../components.js";
import { projectPath } from "../paths.js";
const DEFAULT_MAX_LOC = 250;
export default defineRule({
    meta: {
        type: "suggestion",
        docs: {
            description: "Components must stay within the configured line limit.",
        },
        schema: [limitsSchema],
    },
    create(context) {
        const file = projectPath(context.filename);
        const options = componentOptions(context);
        if (!coversFile(options, file))
            return {};
        const maxLoc = options.maxLoc ?? DEFAULT_MAX_LOC;
        return collectComponents(context, (entries) => {
            for (const entry of entries) {
                if (entry.loc <= maxLoc)
                    continue;
                context.report({
                    node: entry.node,
                    message: `Components must stay within ${maxLoc} lines (${entry.name} has ${entry.loc}).`,
                });
            }
        });
    },
});
