import { defineRule } from "@oxlint/plugins";
import { getPropertyName } from "../ast.js";
import { effectCall, findVariable, isParameterBinding, walk, } from "../effects.js";
const DEFAULT_PATTERN = "^requested[A-Z]";
const CONSUME_CALL = /^(on)?(clear|consume|reset|ack|acknowledge|dismiss)|(Consumed|Handled|Cleared|Done)$/iu;
const dependencyName = (element) => element.type === "Identifier"
    ? element.name
    : element.type === "MemberExpression"
        ? getPropertyName(element.property)
        : undefined;
const isRefCurrent = (node) => node?.type === "MemberExpression" &&
    getPropertyName(node.property) === "current";
const isIdentifierNamed = (node, name) => node?.type === "Identifier" && node.name === name;
const EQUALITY_OPERATORS = new Set(["===", "!==", "==", "!="]);
const isNullish = (node) => (node.type === "Literal" && node.value === null) ||
    isIdentifierNamed(node, "undefined");
function isPresenceCheck(reference) {
    const parent = reference.parent;
    if (parent?.type === "UnaryExpression")
        return parent.operator === "typeof";
    if (parent?.type !== "BinaryExpression" ||
        !EQUALITY_OPERATORS.has(parent.operator)) {
        return false;
    }
    const other = parent.left === reference ? parent.right : parent.left;
    return isNullish(other);
}
function appliesRequest(context, callback, request) {
    let applied = false;
    walk(context, callback, (node) => {
        if (applied)
            return false;
        applied =
            isIdentifierNamed(node, request) &&
                !(node.parent?.type === "MemberExpression" &&
                    node.parent.property === node) &&
                !isPresenceCheck(node);
        return undefined;
    });
    return applied;
}
function consumesRequest(context, callback, request) {
    let consumed = false;
    walk(context, callback, (node) => {
        if (consumed)
            return false;
        if (node.type === "CallExpression") {
            const name = node.callee.type === "Identifier"
                ? node.callee.name
                : node.callee.type === "MemberExpression"
                    ? getPropertyName(node.callee.property)
                    : undefined;
            consumed = name !== undefined && CONSUME_CALL.test(name);
        }
        if (node.type === "AssignmentExpression") {
            consumed =
                isRefCurrent(node.left) && isIdentifierNamed(node.right, request);
        }
        if (node.type === "BinaryExpression" &&
            EQUALITY_OPERATORS.has(node.operator)) {
            consumed =
                (isRefCurrent(node.left) && isIdentifierNamed(node.right, request)) ||
                    (isRefCurrent(node.right) && isIdentifierNamed(node.left, request));
        }
        return undefined;
    });
    return consumed;
}
const message = (request, others, hook) => `\`${request}\` is a request prop that this \`${hook}\` never clears, and the Effect also depends on ${others.map((name) => `\`${name}\``).join(", ")}. ` +
    "Whenever those change, the Effect applies the same request again and overrides the user's newer choice. " +
    "After handling the request, call a consume callback (for example `onRequestConsumed()`) so the parent clears it, " +
    "or remember the handled value in a ref (`handledRef.current = " +
    request +
    "`) and return early when it matches.";
export default defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Require Effects that apply a `requested*` prop to consume or clear it.",
        },
        schema: [
            {
                type: "object",
                properties: { pattern: { type: "string" } },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const options = (context.options[0] ?? {});
        const pattern = new RegExp(options.pattern ?? DEFAULT_PATTERN, "u");
        return {
            CallExpression(node) {
                const effect = effectCall(context, node);
                if (effect?.deps === undefined || effect.callback === undefined)
                    return;
                const elements = effect.deps.elements.filter((element) => element !== null && element.type !== "SpreadElement");
                if (elements.length < 2)
                    return;
                for (const element of elements) {
                    if (element.type !== "Identifier" ||
                        !pattern.test(element.name) ||
                        !isParameterBinding(context, findVariable(context, element)) ||
                        !appliesRequest(context, effect.callback, element.name) ||
                        consumesRequest(context, effect.callback, element.name)) {
                        continue;
                    }
                    const others = elements
                        .filter((other) => other !== element)
                        .flatMap((other) => dependencyName(other) ?? []);
                    context.report({
                        node: element,
                        message: message(element.name, others, effect.hook),
                    });
                }
            },
        };
    },
});
