import { defineRule } from "@oxlint/plugins";
import { getPropertyName } from "../ast.js";
import { callsStateSetter, effectCall, findVariable, isFunctionNode, isStateSetter, walk, } from "../effects.js";
const DEFAULT_METHODS = ["addEventListener", "addListener", "subscribe"];
const DEFAULT_IGNORE_EVENTS = [
    "auxclick",
    "beforeinput",
    "blur",
    "change",
    "click",
    "compositionend",
    "compositionstart",
    "contextmenu",
    "copy",
    "cut",
    "dblclick",
    "drag",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "dragstart",
    "drop",
    "focus",
    "focusin",
    "focusout",
    "input",
    "keydown",
    "keypress",
    "keyup",
    "mousedown",
    "mouseenter",
    "mouseleave",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup",
    "paste",
    "pointercancel",
    "pointerdown",
    "pointerenter",
    "pointerleave",
    "pointermove",
    "pointerout",
    "pointerover",
    "pointerup",
    "select",
    "submit",
    "touchcancel",
    "touchend",
    "touchmove",
    "touchstart",
    "wheel",
];
const message = (method, hook) => `This \`${hook}\` subscribes with \`${method}\` and copies the value into state from the listener. ` +
    "Read it with `useSyncExternalStore(subscribe, getSnapshot)` instead: move the subscription into a stable `subscribe(callback)` " +
    "that returns the unsubscribe function, return the current value from `getSnapshot`, and delete the state and this Effect. " +
    "That avoids tearing, missed updates between render and subscription, and leaked listeners. " +
    "If the listener reacts to a user action rather than tracking a value, handle it in an event handler or add the event to `ignoreEvents`.";
function methodName(callee) {
    if (callee.type === "Identifier")
        return callee.name;
    if (callee.type === "MemberExpression" && !callee.computed) {
        return getPropertyName(callee.property);
    }
    return undefined;
}
function listenerSetsState(context, listener) {
    if (isFunctionNode(listener))
        return callsStateSetter(context, listener);
    if (listener.type !== "Identifier")
        return false;
    if (isStateSetter(context, listener)) {
        return true;
    }
    const def = findVariable(context, listener)
        ?.defs[0];
    const declared = def?.node.type === "VariableDeclarator" ? def.node.init : def?.node;
    return (isFunctionNode(declared ?? undefined) &&
        callsStateSetter(context, declared));
}
export default defineRule({
    meta: {
        type: "suggestion",
        docs: {
            description: "Prefer `useSyncExternalStore` over Effects that mirror a subscription into state.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    methods: { type: "array", items: { type: "string" } },
                    ignoreEvents: { type: "array", items: { type: "string" } },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const options = (context.options[0] ?? {});
        const methods = new Set(options.methods ?? DEFAULT_METHODS);
        const ignoreEvents = new Set(options.ignoreEvents ?? DEFAULT_IGNORE_EVENTS);
        const isIgnoredEvent = (call) => {
            const type = call.arguments[0];
            return (type?.type === "Literal" &&
                typeof type.value === "string" &&
                ignoreEvents.has(type.value));
        };
        return {
            CallExpression(node) {
                const effect = effectCall(context, node);
                if (effect?.callback === undefined)
                    return;
                walk(context, effect.callback, (child) => {
                    if (child.type !== "CallExpression")
                        return undefined;
                    const method = methodName(child.callee);
                    if (method !== undefined &&
                        methods.has(method) &&
                        !isIgnoredEvent(child) &&
                        child.arguments.some((argument) => listenerSetsState(context, argument))) {
                        context.report({
                            node: child,
                            message: message(method, effect.hook),
                        });
                    }
                    return undefined;
                });
            },
        };
    },
});
