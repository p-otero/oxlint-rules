import { asNode } from "./ast.js";
export const EFFECT_HOOKS = [
    "useEffect",
    "useLayoutEffect",
    "useInsertionEffect",
];
const STATE_HOOKS = new Set(["useState", "useReducer"]);
const SETTER_NAME = /^set[A-Z]/u;
export function isFunctionNode(node) {
    return (node?.type === "ArrowFunctionExpression" ||
        node?.type === "FunctionExpression" ||
        node?.type === "FunctionDeclaration");
}
export function findVariable(context, identifier) {
    let scope = context.sourceCode.getScope(identifier);
    while (true) {
        const variable = scope.set.get(identifier.name);
        if (variable !== undefined)
            return variable;
        if (scope.upper === null)
            return undefined;
        scope = scope.upper;
    }
}
function reactImport(variable) {
    const def = variable.defs[0];
    if (def?.type !== "ImportBinding" ||
        def.parent?.type !== "ImportDeclaration" ||
        def.parent.source.value !== "react") {
        return undefined;
    }
    return def.node;
}
function importedName(specifier) {
    return specifier.imported.type === "Identifier"
        ? specifier.imported.name
        : String(specifier.imported.value);
}
export function reactHookName(context, callee) {
    if (callee.type === "Identifier") {
        const variable = findVariable(context, callee);
        if (variable === undefined)
            return callee.name;
        const specifier = reactImport(variable);
        return specifier?.type === "ImportSpecifier"
            ? importedName(specifier)
            : undefined;
    }
    if (callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.object.type === "Identifier" &&
        callee.property.type === "Identifier") {
        const variable = findVariable(context, callee.object);
        const specifier = variable === undefined ? undefined : reactImport(variable);
        const isReactNamespace = variable === undefined
            ? callee.object.name === "React"
            : specifier !== undefined && specifier.type !== "ImportSpecifier";
        return isReactNamespace ? callee.property.name : undefined;
    }
    return undefined;
}
export function effectCall(context, node, hooks = EFFECT_HOOKS) {
    const hook = reactHookName(context, node.callee);
    if (hook === undefined || !hooks.includes(hook))
        return undefined;
    const callback = asNode(node.arguments[0]);
    const deps = asNode(node.arguments[1]);
    return {
        node,
        hook,
        callback: isFunctionNode(callback) ? callback : undefined,
        deps: deps?.type === "ArrayExpression" ? deps : undefined,
        hasDepsArgument: node.arguments.length > 1,
    };
}
export function walk(context, node, visit) {
    if (visit(node) === false)
        return;
    for (const key of context.sourceCode.visitorKeys[node.type] ?? []) {
        const value = node[key];
        for (const item of Array.isArray(value) ? value : [value]) {
            const child = asNode(item);
            if (child !== undefined)
                walk(context, child, visit);
        }
    }
}
export function isStateSetter(context, identifier) {
    const def = findVariable(context, identifier)?.defs[0];
    if (def?.type === "Variable" && def.node.type === "VariableDeclarator") {
        const { id, init } = def.node;
        const hook = init?.type === "CallExpression"
            ? reactHookName(context, init.callee)
            : undefined;
        if (id.type === "ArrayPattern" &&
            hook !== undefined &&
            STATE_HOOKS.has(hook)) {
            const setter = id.elements[1];
            return setter?.type === "Identifier" && setter.name === identifier.name;
        }
    }
    return SETTER_NAME.test(identifier.name);
}
export function callsStateSetter(context, root) {
    let found = false;
    walk(context, root, (node) => {
        if (found)
            return false;
        if (node.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            isStateSetter(context, node.callee)) {
            found = true;
        }
        return undefined;
    });
    return found;
}
export function isParameterBinding(context, variable) {
    const def = variable?.defs[0];
    if (def === undefined)
        return false;
    if (def.type === "Parameter")
        return true;
    if (def.type !== "Variable" || def.node.type !== "VariableDeclarator") {
        return false;
    }
    const { id, init } = def.node;
    return (id.type === "ObjectPattern" &&
        init?.type === "Identifier" &&
        findVariable(context, init)?.defs[0]?.type === "Parameter");
}
