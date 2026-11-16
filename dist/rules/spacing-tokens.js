import { defineRule } from "@oxlint/plugins";
const SPACING_UTILITY = /^-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xyse])?|top|right|bottom|left|start|end|scroll-[mp][xytrblse]?)-(\d+(?:\.\d+)?)$/u;
// Variants (`md:`, `data-[state=open]:`) end at a colon outside brackets and parentheses.
function utilityOf(token) {
    let depth = 0;
    let start = 0;
    for (let index = 0; index < token.length; index += 1) {
        const char = token[index];
        if (char === "[" || char === "(")
            depth += 1;
        else if (char === "]" || char === ")")
            depth -= 1;
        else if (char === ":" && depth === 0)
            start = index + 1;
    }
    return token.slice(start).replace(/^!|!$/gu, "");
}
function rawSpacing(token) {
    const match = SPACING_UTILITY.exec(utilityOf(token));
    return match !== null && Number(match[1]) !== 0;
}
export default defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Spacing uses the configured role tokens, not the numeric Tailwind scale.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    roles: { type: "array", items: { type: "string" } },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const roles = (context.options[0] ?? {}).roles ?? [];
        const guidance = roles.length === 0
            ? "Use a spacing role token."
            : `Use a role (${roles.join(", ")}).`;
        const check = (node, text) => {
            for (const token of text.split(/\s+/u)) {
                if (!rawSpacing(token))
                    continue;
                context.report({
                    node,
                    message: `"${token}" is raw spacing. ${guidance}`,
                });
            }
        };
        return {
            Literal(node) {
                if (typeof node.value !== "string")
                    return;
                if (node.parent.type === "ImportDeclaration" ||
                    node.parent.type === "ExportNamedDeclaration") {
                    return;
                }
                check(node, node.value);
            },
            TemplateElement(node) {
                check(node, node.value.cooked ?? node.value.raw);
            },
        };
    },
});
