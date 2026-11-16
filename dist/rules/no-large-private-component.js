import { defineRule } from "@oxlint/plugins";
import { collectComponents, componentOptions, coversFile, limitsSchema, } from "../components.js";
import { projectPath } from "../paths.js";
const DEFAULT_MAX_LOC = 40;
export default defineRule({
    meta: {
        type: "suggestion",
        docs: {
            description: "Private components beyond the configured line limit must be extracted.",
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
                if (entry.exported || entry.loc <= maxLoc)
                    continue;
                context.report({
                    node: entry.node,
                    message: `Private components over ${maxLoc} lines must be extracted (${entry.name} has ${entry.loc}).`,
                });
            }
        });
    },
});
