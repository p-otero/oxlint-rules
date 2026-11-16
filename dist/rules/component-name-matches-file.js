import { defineRule } from "@oxlint/plugins";
import { collectComponents, componentFileStem, componentOptions, coversFile, filesSchema, pascalCase, } from "../components.js";
import { projectPath } from "../paths.js";
export default defineRule({
    meta: {
        type: "suggestion",
        docs: {
            description: "The public component name must match the file name.",
        },
        schema: [filesSchema],
    },
    create(context) {
        const file = projectPath(context.filename);
        if (!coversFile(componentOptions(context), file))
            return {};
        const expected = pascalCase(componentFileStem(file));
        return collectComponents(context, (entries) => {
            for (const entry of entries) {
                if (!entry.exported)
                    continue;
                if (entry.name === expected ||
                    entry.name.endsWith(expected) ||
                    expected.endsWith(entry.name)) {
                    continue;
                }
                context.report({
                    node: entry.node,
                    message: `The public component name must match the file name (expected ${expected}, found ${entry.name}).`,
                });
            }
        });
    },
});
