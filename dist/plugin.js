import { definePlugin } from "@oxlint/plugins";
import componentNameMatchesFile from "./rules/component-name-matches-file.js";
import importBoundaries from "./rules/import-boundaries.js";
import maxComponentLines from "./rules/max-component-lines.js";
import namespaceNodeImports from "./rules/namespace-node-imports.js";
import noCallbackPropInEffectDeps from "./rules/no-callback-prop-in-effect-deps.js";
import noCrossFeatureImports from "./rules/no-cross-feature-imports.js";
import noEffectOutsideHooks from "./rules/no-effect-outside-hooks.js";
import noEmDashCopy from "./rules/no-em-dash-copy.js";
import noGlobalError from "./rules/no-global-error.js";
import noInlineSchemaCompile from "./rules/no-inline-schema-compile.js";
import noLargePrivateComponent from "./rules/no-large-private-component.js";
import noLatestRefEffect from "./rules/no-latest-ref-effect.js";
import noLooseSemanticLiterals from "./rules/no-loose-semantic-literals.js";
import noLowValueComments from "./rules/no-low-value-comments.js";
import noStickyRequestEffect from "./rules/no-sticky-request-effect.js";
import onePublicComponent from "./rules/one-public-component.js";
import preferCatchTags from "./rules/prefer-catch-tags.js";
import preferEffectFn from "./rules/prefer-effect-fn.js";
import preferSyncExternalStore from "./rules/prefer-sync-external-store.js";
import requireEffectFetchCleanup from "./rules/require-effect-fetch-cleanup.js";
import requireSuppressionReason from "./rules/require-suppression-reason.js";
import spacingTokens from "./rules/spacing-tokens.js";
export default definePlugin({
    meta: { name: "p-otero" },
    rules: {
        "component-name-matches-file": componentNameMatchesFile,
        "import-boundaries": importBoundaries,
        "max-component-lines": maxComponentLines,
        "namespace-node-imports": namespaceNodeImports,
        "no-callback-prop-in-effect-deps": noCallbackPropInEffectDeps,
        "no-cross-feature-imports": noCrossFeatureImports,
        "no-effect-outside-hooks": noEffectOutsideHooks,
        "no-em-dash-copy": noEmDashCopy,
        "no-global-error": noGlobalError,
        "no-inline-schema-compile": noInlineSchemaCompile,
        "no-large-private-component": noLargePrivateComponent,
        "no-latest-ref-effect": noLatestRefEffect,
        "no-loose-semantic-literals": noLooseSemanticLiterals,
        "no-low-value-comments": noLowValueComments,
        "no-sticky-request-effect": noStickyRequestEffect,
        "one-public-component": onePublicComponent,
        "prefer-catch-tags": preferCatchTags,
        "prefer-effect-fn": preferEffectFn,
        "prefer-sync-external-store": preferSyncExternalStore,
        "require-effect-fetch-cleanup": requireEffectFetchCleanup,
        "require-suppression-reason": requireSuppressionReason,
        "spacing-tokens": spacingTokens,
    },
});
