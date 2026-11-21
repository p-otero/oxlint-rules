import { definePlugin } from "@oxlint/plugins";

import componentNameMatchesFile from "./rules/component-name-matches-file.ts";
import importBoundaries from "./rules/import-boundaries.ts";
import maxComponentLines from "./rules/max-component-lines.ts";
import namespaceNodeImports from "./rules/namespace-node-imports.ts";
import noCallbackPropInEffectDeps from "./rules/no-callback-prop-in-effect-deps.ts";
import noCrossFeatureImports from "./rules/no-cross-feature-imports.ts";
import noEffectOutsideHooks from "./rules/no-effect-outside-hooks.ts";
import noEmDashCopy from "./rules/no-em-dash-copy.ts";
import noGlobalError from "./rules/no-global-error.ts";
import noInlineSchemaCompile from "./rules/no-inline-schema-compile.ts";
import noLargePrivateComponent from "./rules/no-large-private-component.ts";
import noLatestRefEffect from "./rules/no-latest-ref-effect.ts";
import noLooseSemanticLiterals from "./rules/no-loose-semantic-literals.ts";
import noLowValueComments from "./rules/no-low-value-comments.ts";
import noStickyRequestEffect from "./rules/no-sticky-request-effect.ts";
import onePublicComponent from "./rules/one-public-component.ts";
import preferCatchTags from "./rules/prefer-catch-tags.ts";
import preferEffectFn from "./rules/prefer-effect-fn.ts";
import preferSyncExternalStore from "./rules/prefer-sync-external-store.ts";
import requireEffectFetchCleanup from "./rules/require-effect-fetch-cleanup.ts";
import requireSuppressionReason from "./rules/require-suppression-reason.ts";
import spacingTokens from "./rules/spacing-tokens.ts";

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
