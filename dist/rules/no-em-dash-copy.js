/*!
 * Ported from pingdotgg/t3code (oxlint-plugin-t3code/rules/no-em-dash-copy.ts).
 * MIT License, Copyright (c) 2026 T3 Tools Inc.
 */
import { defineRule } from "@oxlint/plugins";
const EM_DASH = "\u2014";
const MESSAGE = "No em dashes in product copy. Use a period, comma, colon, or parentheses instead.";
// Comments are not product copy, so only string and JSX text nodes are checked.
export default defineRule({
    meta: {
        type: "suggestion",
        docs: {
            description: "Disallow em dashes in strings and JSX text that users or agents read.",
        },
    },
    create(context) {
        const check = (node, text) => {
            if (text?.includes(EM_DASH))
                context.report({ node, message: MESSAGE });
        };
        return {
            Literal(node) {
                if (typeof node.value === "string")
                    check(node, node.value);
            },
            TemplateElement(node) {
                check(node, node.value.cooked);
            },
            JSXText(node) {
                check(node, node.value);
            },
        };
    },
});
