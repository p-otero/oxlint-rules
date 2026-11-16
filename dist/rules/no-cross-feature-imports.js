import path from "node:path";
import { defineRule } from "@oxlint/plugins";
import { compilePattern, projectPath } from "../paths.js";
const DEFAULT_FILES = "\\.[cm]?[jt]sx?$";
const DEFAULT_FEATURES_DIRECTORY = "features";
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
function featureOf(file, directory) {
    const pattern = new RegExp(`(?:^|/)${escapeRegExp(directory)}/([^/]+)/`, "u");
    return pattern.exec(file)?.[1] ?? null;
}
function targetFeature(file, specifier, directory, alias) {
    if (specifier.startsWith(".")) {
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        return featureOf(resolved, directory);
    }
    if (alias !== undefined && specifier.startsWith(`${alias}/`)) {
        return specifier.slice(alias.length + 1).split("/")[0] ?? null;
    }
    return null;
}
export default defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Features must not import another feature's internals.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    featuresDirectory: { type: "string" },
                    alias: { type: "string" },
                    files: { type: "string" },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const options = (context.options[0] ?? {});
        const file = projectPath(context.filename);
        if (!(compilePattern(options.files ?? DEFAULT_FILES)?.test(file) ?? true)) {
            return {};
        }
        const directory = options.featuresDirectory ?? DEFAULT_FEATURES_DIRECTORY;
        const ownFeature = featureOf(file, directory);
        if (ownFeature === null)
            return {};
        const check = (node, source) => {
            if (source === null)
                return;
            const feature = targetFeature(file, source.value, directory, options.alias);
            if (feature === null || feature === ownFeature)
                return;
            context.report({
                node,
                message: `Features must not import another feature's internals (${ownFeature} imports ${feature}).`,
            });
        };
        return {
            ImportDeclaration(node) {
                if (node.specifiers.length > 0)
                    check(node, node.source);
            },
            ExportNamedDeclaration(node) {
                check(node, node.source);
            },
            ExportAllDeclaration(node) {
                check(node, node.source);
            },
        };
    },
});
