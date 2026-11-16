const WRAPPER_TYPES = new Set([
    "ChainExpression",
    "ParenthesizedExpression",
    "TSNonNullExpression",
    "TSAsExpression",
    "TSTypeAssertion",
]);
export function asNode(value) {
    return typeof value === "object" &&
        value !== null &&
        "type" in value &&
        typeof value.type === "string"
        ? value
        : undefined;
}
export function unwrapExpression(value) {
    let node = asNode(value);
    while (node !== undefined && WRAPPER_TYPES.has(node.type)) {
        node = asNode(node.expression);
    }
    return node;
}
export function getPropertyName(value) {
    const node = asNode(value);
    if (node === undefined)
        return undefined;
    if (node.type === "Identifier" || node.type === "PrivateIdentifier") {
        return node.name;
    }
    if (node.type === "Literal" && typeof node.value === "string") {
        return node.value;
    }
    return undefined;
}
export function isIdentifier(value, name) {
    const node = asNode(value);
    return (node?.type === "Identifier" && (name === undefined || node.name === name));
}
