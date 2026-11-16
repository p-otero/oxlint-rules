import { existsSync, statSync } from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { defineRule } from "@oxlint/plugins";
import { projectPath } from "../paths.js";
const RESOLVE_SUFFIXES = [
    "",
    ".ts",
    ".tsx",
    ".d.ts",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    "/index.ts",
    "/index.tsx",
    "/index.d.ts",
    "/index.js",
    "/index.mjs",
];
const optionalRegExp = (source) => source === undefined ? undefined : new RegExp(source, "u");
const isFile = (candidate) => existsSync(candidate) && statSync(candidate).isFile();
function resolveRelative(fromFile, specifier) {
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [base];
    if (/\.[cm]?jsx?$/u.test(base)) {
        candidates.push(base.replace(/\.([cm]?)js(x?)$/u, ".$1ts$2"));
    }
    for (const candidate of candidates) {
        for (const suffix of RESOLVE_SUFFIXES) {
            if (isFile(candidate + suffix)) {
                return projectPath(candidate + suffix);
            }
        }
    }
    return projectPath(base);
}
function describeTarget(fromFile, specifier, workspacePackages) {
    if (isBuiltin(specifier)) {
        const bare = specifier.replace(/^node:/u, "");
        return {
            targets: [isBuiltin(bare) ? bare : specifier],
            dependencyTypes: ["core"],
        };
    }
    if (specifier.startsWith(".")) {
        return {
            targets: [resolveRelative(fromFile, specifier)],
            dependencyTypes: ["local"],
        };
    }
    for (const [name, folder] of Object.entries(workspacePackages)) {
        if (specifier === name || specifier.startsWith(`${name}/`)) {
            return {
                targets: [specifier, folder + specifier.slice(name.length)],
                dependencyTypes: ["local"],
            };
        }
    }
    return { targets: [specifier], dependencyTypes: ["npm"] };
}
function violatedBoundaries(boundaries, fromFile, specifier, workspacePackages) {
    const target = describeTarget(fromFile, specifier, workspacePackages);
    return boundaries.filter((boundary) => boundary.dependencyTypes
        ? boundary.dependencyTypes.some((type) => target.dependencyTypes.includes(type))
        : target.targets.some((value) => boundary.to?.test(value) ?? false));
}
const stringLiteral = (node) => {
    if (typeof node !== "object" || node === null)
        return null;
    if (!("type" in node) || node.type !== "Literal")
        return null;
    if (!("value" in node) || typeof node.value !== "string")
        return null;
    return node.value;
};
const insideTypeQuery = (node) => {
    let current = node.parent;
    while (current !== null && current !== undefined) {
        if (current.type === "TSTypeQuery")
            return true;
        if (!current.type.startsWith("TS") &&
            current.type !== "Identifier" &&
            current.type !== "MemberExpression") {
            return false;
        }
        current = current.parent;
    }
    return false;
};
const allSpecifiersAreTypes = (specifiers, kind) => specifiers.length > 0 &&
    specifiers.every((specifier) => {
        if (typeof specifier !== "object" || specifier === null)
            return false;
        return specifier[kind] === "type";
    });
// @oxlint/plugins omits ESLint's `isValueReference` from its Reference type.
const isValueReference = (reference) => reference.isValueReference ===
    true;
export default defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Enforce configured package and layer import boundaries.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    scope: { type: "string" },
                    exclude: { type: "string" },
                    boundaries: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["id", "message"],
                            properties: {
                                id: { type: "string" },
                                message: { type: "string" },
                                from: { type: "string" },
                                fromNot: { type: "string" },
                                to: { type: "string" },
                                dependencyTypes: {
                                    type: "array",
                                    items: { enum: ["core", "local", "npm"] },
                                },
                            },
                            additionalProperties: false,
                        },
                    },
                    workspacePackages: {
                        type: "object",
                        additionalProperties: { type: "string" },
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const options = (context.options[0] ?? {});
        const scope = optionalRegExp(options.scope);
        const exclude = new RegExp(options.exclude ?? "node_modules|dist|coverage", "u");
        const workspacePackages = options.workspacePackages ?? {};
        const file = projectPath(context.filename);
        if ((scope !== undefined && !scope.test(file)) || exclude.test(file)) {
            return {};
        }
        const boundaries = (options.boundaries ?? []).map((boundary) => ({
            id: boundary.id,
            message: boundary.message,
            from: optionalRegExp(boundary.from),
            fromNot: optionalRegExp(boundary.fromNot),
            to: optionalRegExp(boundary.to),
            dependencyTypes: boundary.dependencyTypes,
        }));
        const active = boundaries.filter((boundary) => (boundary.from === undefined || boundary.from.test(file)) &&
            !boundary.fromNot?.test(file));
        if (active.length === 0)
            return {};
        const absoluteFile = path.resolve(context.filename);
        const check = (node, specifier) => {
            if (specifier === null)
                return;
            for (const boundary of violatedBoundaries(active, absoluteFile, specifier, workspacePackages)) {
                context.report({
                    node,
                    message: `${boundary.id}: ${boundary.message} (imports "${specifier}")`,
                });
            }
        };
        const isErased = (node) => {
            if (node.importKind === "type" ||
                allSpecifiersAreTypes(node.specifiers, "importKind")) {
                return true;
            }
            if (node.specifiers.length === 0)
                return false;
            return !context.sourceCode
                .getDeclaredVariables(node)
                .some((variable) => variable.references.some((reference) => isValueReference(reference) &&
                !insideTypeQuery(reference.identifier)));
        };
        return {
            ImportDeclaration(node) {
                if (!isErased(node))
                    check(node, stringLiteral(node.source));
            },
            ExportNamedDeclaration(node) {
                if (node.source === null ||
                    node.exportKind === "type" ||
                    allSpecifiersAreTypes(node.specifiers, "exportKind")) {
                    return;
                }
                check(node, stringLiteral(node.source));
            },
            ExportAllDeclaration(node) {
                if (node.exportKind !== "type")
                    check(node, stringLiteral(node.source));
            },
            ImportExpression(node) {
                check(node, stringLiteral(node.source));
            },
            TSImportEqualsDeclaration(node) {
                if (node.importKind !== "type" &&
                    node.moduleReference.type === "TSExternalModuleReference") {
                    check(node, stringLiteral(node.moduleReference.expression));
                }
            },
            CallExpression(node) {
                if (node.callee.type === "Identifier" &&
                    node.callee.name === "require" &&
                    node.arguments.length === 1) {
                    check(node, stringLiteral(node.arguments[0]));
                }
            },
        };
    },
});
