import { defineRule, } from "@oxlint/plugins";
import { asNode, getPropertyName } from "../ast.js";
import { effectCall, findVariable, isParameterBinding } from "../effects.js";
const DEFAULT_PATTERN = "^on[A-Z]";
const FUNCTION_TYPE_NAMES = /^(Function|VoidFunction|Dispatch)$|(Handler|Callback|Listener)$/u;
const NULLISH_TYPES = new Set(["TSNullKeyword", "TSUndefinedKeyword"]);
const message = (dependency, hook) => {
    const event = `${dependency.replace(/^props\./u, "")}Event`;
    return (`\`${dependency}\` is a callback prop in the dependencies of this \`${hook}\`. ` +
        "Parents usually pass a new function on every render, so the Effect re-runs on every parent render and loops when it makes the parent render again. " +
        `Read it through an Effect Event instead: \`const ${event} = useEffectEvent(${dependency})\`, call \`${event}(…)\` inside the Effect, and remove \`${dependency}\` from the dependencies. ` +
        "If the call answers a user action, make it in that event handler and drop the Effect.");
};
function findTypeDeclaration(context, name) {
    for (const statement of context.sourceCode.ast.body) {
        const declaration = statement.type === "ExportNamedDeclaration" ||
            statement.type === "ExportDefaultDeclaration"
            ? asNode(statement.declaration)
            : statement;
        if ((declaration?.type === "TSInterfaceDeclaration" ||
            declaration?.type === "TSTypeAliasDeclaration") &&
            declaration.id.name === name) {
            return declaration;
        }
    }
    return undefined;
}
function memberType(context, type, key, seen = new Set()) {
    if (type === undefined)
        return undefined;
    switch (type.type) {
        case "TSTypeAliasDeclaration":
            return memberType(context, type.typeAnnotation, key, seen);
        case "TSInterfaceDeclaration":
            return membersType(type.body.body, key);
        case "TSTypeLiteral":
            return membersType(type.members, key);
        case "TSIntersectionType":
            for (const part of type.types) {
                const verdict = memberType(context, part, key, seen);
                if (verdict !== undefined)
                    return verdict;
            }
            return undefined;
        case "TSTypeReference": {
            if (type.typeName.type !== "Identifier")
                return undefined;
            const name = type.typeName.name;
            if (seen.has(name))
                return undefined;
            seen.add(name);
            return memberType(context, findTypeDeclaration(context, name), key, seen);
        }
        default:
            return undefined;
    }
}
function membersType(members, key) {
    for (const member of members) {
        if (getPropertyName(member.key) !== key)
            continue;
        if (member.type === "TSMethodSignature")
            return "function";
        if (member.type === "TSPropertySignature") {
            return isFunctionType(member.typeAnnotation?.typeAnnotation)
                ? "function"
                : "other";
        }
    }
    return undefined;
}
function isFunctionType(type) {
    if (type === undefined)
        return false;
    switch (type.type) {
        case "TSFunctionType":
        case "TSConstructorType":
            return true;
        case "TSParenthesizedType":
            return isFunctionType(type.typeAnnotation);
        case "TSUnionType":
            return type.types.some((part) => !NULLISH_TYPES.has(part.type) && isFunctionType(part));
        case "TSTypeReference":
            return (type.typeName.type === "Identifier" &&
                FUNCTION_TYPE_NAMES.test(type.typeName.name));
        default:
            return false;
    }
}
function annotationOf(pattern) {
    if (pattern?.type === "AssignmentPattern")
        return annotationOf(pattern.left);
    const annotation = asNode(pattern?.typeAnnotation);
    return annotation?.type === "TSTypeAnnotation"
        ? annotation.typeAnnotation
        : undefined;
}
function enclosingProperty(binding) {
    const parent = binding.parent?.type === "AssignmentPattern"
        ? binding.parent.parent
        : binding.parent;
    return parent?.type === "Property" && parent.parent?.type === "ObjectPattern"
        ? parent
        : undefined;
}
function declaredType(context, variable) {
    const def = variable.defs[0];
    if (def === undefined)
        return undefined;
    const binding = def.name;
    const property = enclosingProperty(binding);
    if (property?.type !== "Property") {
        if (def.type !== "Parameter")
            return undefined;
        const type = annotationOf(binding);
        if (type === undefined)
            return undefined;
        return isFunctionType(type) ? "function" : "other";
    }
    const key = getPropertyName(property.key);
    if (key === undefined)
        return undefined;
    if (def.type === "Parameter") {
        return memberType(context, annotationOf(property.parent), key);
    }
    if (def.node.type === "VariableDeclarator" &&
        def.node.init?.type === "Identifier") {
        const source = findVariable(context, def.node.init)?.defs[0]?.name;
        return memberType(context, annotationOf(source), key);
    }
    return undefined;
}
const isCallbackProp = (name, verdict, pattern) => verdict === "function" || (verdict === undefined && pattern.test(name));
export default defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Disallow callback props in Effect dependencies; read them through `useEffectEvent`.",
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
        const checkIdentifier = (dependency, hook) => {
            const variable = findVariable(context, dependency);
            if (variable === undefined || !isParameterBinding(context, variable)) {
                return;
            }
            if (isCallbackProp(dependency.name, declaredType(context, variable), pattern)) {
                context.report({
                    node: dependency,
                    message: message(dependency.name, hook),
                });
            }
        };
        const checkMember = (dependency, hook) => {
            if (dependency.computed || dependency.object.type !== "Identifier")
                return;
            const key = getPropertyName(dependency.property);
            const variable = findVariable(context, dependency.object);
            if (key === undefined || variable?.defs[0]?.type !== "Parameter")
                return;
            const verdict = memberType(context, annotationOf(variable.defs[0].name), key);
            if (isCallbackProp(key, verdict, pattern)) {
                context.report({
                    node: dependency,
                    message: message(`${dependency.object.name}.${key}`, hook),
                });
            }
        };
        return {
            CallExpression(node) {
                const effect = effectCall(context, node);
                if (effect?.deps === undefined)
                    return;
                for (const element of effect.deps.elements) {
                    if (element?.type === "Identifier")
                        checkIdentifier(element, effect.hook);
                    if (element?.type === "MemberExpression")
                        checkMember(element, effect.hook);
                }
            },
        };
    },
});
