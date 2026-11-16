import { defineRule } from "@oxlint/plugins";
import { getPropertyName } from "../ast.js";
import { effectCall, findVariable, isFunctionNode, isStateSetter, walk, } from "../effects.js";
const PROMISE_METHODS = new Set(["then", "catch", "finally"]);
const message = (setter, hook) => `This \`${hook}\` calls \`${setter}\` after async work but returns no cleanup that cancels it, ` +
    "so a slow response for old dependencies (or after unmount) overwrites newer state. " +
    "Declare `let ignore = false`, guard the update with `if (!ignore)`, and `return () => { ignore = true; }`; " +
    "or create an `AbortController`, pass its `signal`, and `return () => controller.abort()`. " +
    "Better: load the data through a data hook that handles races and caching instead of an Effect.";
const isPromiseCallback = (node) => node.parent?.type === "CallExpression" &&
    node.parent.callee !== node &&
    node.parent.callee.type === "MemberExpression" &&
    PROMISE_METHODS.has(getPropertyName(node.parent.callee.property) ?? "");
function followsAwait(context, owner, call) {
    if (!owner.async)
        return false;
    let found = false;
    walk(context, owner.body, (node) => {
        if (found || (node !== owner.body && isFunctionNode(node)))
            return false;
        if (node.type === "AwaitExpression" && node.end <= call.start)
            found = true;
        return undefined;
    });
    return found;
}
function runsAfterAsyncWork(context, call, callback) {
    if (isPromiseCallback(call))
        return true;
    let node = call.parent;
    let owner;
    while (node !== null && node !== callback.parent) {
        if (isFunctionNode(node)) {
            owner ??= node;
            if (isPromiseCallback(node))
                return true;
        }
        node = node.parent;
    }
    return owner !== undefined && followsAwait(context, owner, call);
}
function lateSetter(context, callback) {
    let setter;
    walk(context, callback, (node) => {
        if (setter !== undefined)
            return false;
        if (node.type === "Identifier" &&
            node.parent?.type === "CallExpression" &&
            isStateSetter(context, node) &&
            (node.parent.callee === node
                ? runsAfterAsyncWork(context, node.parent, callback)
                : isPromiseCallback(node))) {
            setter = node;
        }
        return undefined;
    });
    return setter;
}
function cancels(context, cleanup) {
    let cancelled = false;
    walk(context, cleanup, (node) => {
        if (cancelled)
            return false;
        cancelled =
            node.type === "AssignmentExpression" ||
                (node.type === "CallExpression" &&
                    node.callee.type === "MemberExpression" &&
                    getPropertyName(node.callee.property) === "abort");
        return undefined;
    });
    return cancelled;
}
function isCancellingCleanup(context, returned) {
    if (isFunctionNode(returned))
        return cancels(context, returned);
    if (returned.type !== "Identifier")
        return returned.type === "CallExpression";
    const def = findVariable(context, returned)?.defs[0];
    const declared = def?.node.type === "VariableDeclarator" ? def.node.init : def?.node;
    return isFunctionNode(declared ?? undefined)
        ? cancels(context, declared)
        : true;
}
function hasCancellingCleanup(context, callback) {
    if (callback.body?.type !== "BlockStatement") {
        const body = callback.body ?? undefined;
        return isFunctionNode(body) && cancels(context, body);
    }
    let found = false;
    walk(context, callback.body, (node) => {
        if (found || isFunctionNode(node))
            return false;
        if (node.type === "ReturnStatement" && node.argument !== null) {
            found = isCancellingCleanup(context, node.argument);
        }
        return undefined;
    });
    return found;
}
export default defineRule({
    meta: {
        type: "problem",
        docs: {
            description: "Require Effects that set state after async work to return a cleanup that ignores or aborts it.",
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const effect = effectCall(context, node);
                if (effect?.callback === undefined)
                    return;
                const setter = lateSetter(context, effect.callback);
                if (setter === undefined ||
                    hasCancellingCleanup(context, effect.callback)) {
                    return;
                }
                context.report({
                    node: node.callee,
                    message: message(setter.name, effect.hook),
                });
            },
        };
    },
});
