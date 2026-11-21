# @p-otero/oxlint-rules

Oxlint rules and layered presets shared across our repositories: `base`,
`react`, `react-agents`, `ui-tailwind`, and an optional `effect` layer.

## Install

Pin a commit SHA; do not use a branch or tag:

```json
{
  "devDependencies": {
    "@p-otero/oxlint-rules": "github:p-otero/oxlint-rules#<sha>",
    "oxlint": "1.92.0"
  }
}
```

The package ships compiled JavaScript in `dist/`, because Node type stripping
refuses `.ts` files under `node_modules`.

## Configure

`.oxlintrc.json`:

```json
{
  "extends": [
    "./node_modules/@p-otero/oxlint-rules/presets/base.json",
    "./node_modules/@p-otero/oxlint-rules/presets/react.json"
  ],
  "jsPlugins": ["./node_modules/@p-otero/oxlint-rules/dist/plugin.js"]
}
```

Every preset works on its own. Layer them by adding entries to `extends`;
the presets never include the optional `effect` layer.

Apply rules to part of the tree with `overrides`:

```json
{
  "overrides": [
    {
      "files": ["packages/ui/**/*.tsx"],
      "rules": {
        "p-otero/one-public-component": "error",
        "p-otero/component-name-matches-file": [
          "error",
          { "files": "\\.tsx$", "exempt": "(^|/)index\\.tsx$" }
        ],
        "p-otero/max-component-lines": [
          "error",
          { "files": "\\.tsx$", "maxLoc": 250 }
        ],
        "p-otero/no-large-private-component": [
          "error",
          { "files": "\\.tsx$", "maxLoc": 40 }
        ]
      }
    },
    {
      "files": ["packages/ui/src/features/**"],
      "rules": {
        "p-otero/no-cross-feature-imports": [
          "error",
          {
            "featuresDirectory": "features",
            "alias": "@acme/ui/features"
          }
        ]
      }
    }
  ]
}
```

## Presets

- `base.json`: built-in `typescript`, `unicorn`, `oxc` and `import` plugins;
  `correctness` error, `suspicious` warn, `perf` warn;
  `options.reportUnusedDisableDirectives` error; `no-unused-vars` with `^_`
  for arguments, variables and caught errors; `no-debugger`;
  `import/no-cycle` with `ignoreTypes`; `oxc/no-accumulating-spread`;
  `typescript/no-extraneous-class`; `no-new`; `no-unneeded-ternary`;
  `no-unsafe-optional-chaining`; `no-empty-pattern`;
  `unicorn/no-useless-spread`; `unicorn/no-useless-fallback-in-spread`;
  `unicorn/require-module-specifiers`; `max-lines` 400 ignoring blank lines and
  comments; `p-otero/no-low-value-comments`;
  `p-otero/require-suppression-reason`. `p-otero/namespace-node-imports` is
  available but off.
- `react.json`: the React hook, purity, refs, immutability, set-state,
  derived-state-in-Effect, Effect dependency, static-component and JSX key
  rules error; `react/react-in-jsx-scope` off;
  `react/no-unstable-nested-components` allows render callbacks held in object
  or array definitions (for example column `cell` renderers); the `p-otero`
  component rules enabled with their options.
- `react-agents.json`: opt-in `useEffect` rules for codebases where agents
  write product code; see [Effects in agent-written code](#effects-in-agent-written-code).
- `ui-tailwind.json`: `p-otero/spacing-tokens` with the role token list as its
  `roles` option. Override the list per project.
- `effect.json`: extends the `@effect/tsgo` oxlint strict preset (an
  optional peer dependency accepting `>=0.67.0`), which has the rules of the
  recommended preset with every warning raised to an error. It turns
  `effecttsgo/unstable-api-usage` off and enables
  `p-otero/no-inline-schema-compile`, `p-otero/prefer-effect-fn` and
  `p-otero/prefer-catch-tags`. The plugin matches Effect syntax by name and
  does not import `effect`.

### Render callbacks

`react/no-unstable-nested-components` runs with `allowAsProps: true`. Column
definitions such as `{ key, cell: (row) => <span /> }` are render callbacks,
not components: they are recreated on every render by design and their identity
never reaches React as an element type. Without the option the rule reports
every such callback. Nested component definitions keep failing: `const Inner =
() => <div />` inside a component is still reported, whether it is rendered
directly or passed as a prop. The `test/fixtures/react-render-props` fixture
pins both outcomes.

### React rule names

oxlint 1.92 configures the hook rules as `react/rules-of-hooks` and
`react/exhaustive-deps`; `react-hooks/…` is accepted as an alias and resolves
to the same rule, and diagnostics print as `react-hooks(exhaustive-deps)`. The
React Compiler based Effect rules are `react/set-state-in-effect`,
`react/no-deriving-state-in-effects` and `react/exhaustive-effect-dependencies`.

### Effects in agent-written code

Effects are an escape hatch for syncing with an external system
([You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)),
and agents reach for them by default. `react-agents.json` turns that guidance
into deterministic checks whose messages say what to write instead:

| Rule                                      | Reports                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `p-otero/no-effect-outside-hooks`         | any Effect hook outside the `allow` globs (default `**/hooks/**`)      |
| `p-otero/no-callback-prop-in-effect-deps` | a callback prop in Effect deps, which loops on inline parent callbacks |
| `p-otero/require-effect-fetch-cleanup`    | state set after async work without an ignore flag or abort cleanup     |
| `p-otero/prefer-sync-external-store`      | a subscription whose listener mirrors a value into state               |
| `p-otero/no-latest-ref-effect`            | p-otero                                                                | `checkDependencyArrays` |
| `p-otero/no-latest-ref-effect`            | an Effect without deps that only assigns `ref.current`                 |
| `p-otero/no-sticky-request-effect`        | a `requested*` prop re-applied whenever another dependency changes     |

The layer is opt-in rather than part of `react.json` for two reasons.
`no-effect-outside-hooks` is a policy, not a bug check: it needs each project's
`allow` globs (editor adapters, framework primitives) and fails every Effect in
component files on day one. The other five are syntactic heuristics without
type information, so each has documented false positives (memoised callbacks,
`on…` props that are not functions, fire-and-forget requests). `react.json`
stays limited to checks that hold in any React codebase; the React Compiler
based `react/no-deriving-state-in-effects` and
`react/exhaustive-effect-dependencies` live there.

```json
{
  "extends": [
    "./node_modules/@p-otero/oxlint-rules/presets/base.json",
    "./node_modules/@p-otero/oxlint-rules/presets/react.json",
    "./node_modules/@p-otero/oxlint-rules/presets/react-agents.json"
  ],
  "jsPlugins": ["./node_modules/@p-otero/oxlint-rules/dist/plugin.js"],
  "rules": {
    "p-otero/no-effect-outside-hooks": [
      "error",
      { "allow": ["**/hooks/**", "packages/editor/src/adapters/**"] }
    ]
  }
}
```

`eslint-plugin-react-you-might-not-need-an-effect` adds heuristics for event
logic, adjusting or resetting state on prop change, chained updates, passing
state to the parent and initial state. Version 1.2.0 has no runtime
dependencies and loads through `jsPlugins` under oxlint 1.92. Load it next to
this layer, pinned exactly, and leave off the rules covered here:
`no-derived-state` (covered by `react/no-deriving-state-in-effects`),
`no-external-store-subscription` (covered by
`p-otero/prefer-sync-external-store`) and `no-pass-data-to-parent` (it reports
subscriptions that return their unsubscribe function). Its `eslint >=8.40.0`
peer is not imported at runtime; with pnpm, keep it from being installed
(`auto-install-peers=false`) and check with `pnpm why eslint`. It has one
maintainer, no npm provenance and frequent releases, so review each bump.

```json
{
  "jsPlugins": [
    "./node_modules/@p-otero/oxlint-rules/dist/plugin.js",
    "eslint-plugin-react-you-might-not-need-an-effect"
  ],
  "rules": {
    "react-you-might-not-need-an-effect/no-event-handler": "error",
    "react-you-might-not-need-an-effect/no-adjust-state-on-prop-change": "error",
    "react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change": "error",
    "react-you-might-not-need-an-effect/no-chain-state-updates": "error",
    "react-you-might-not-need-an-effect/no-pass-live-state-to-parent": "error",
    "react-you-might-not-need-an-effect/no-initialize-state": "error"
  }
}
```

### Effect layer

```json
{
  "extends": [
    "./node_modules/@p-otero/oxlint-rules/presets/base.json",
    "./node_modules/@p-otero/oxlint-rules/presets/effect.json"
  ],
  "jsPlugins": ["./node_modules/@p-otero/oxlint-rules/dist/plugin.js"],
  "options": { "typeAware": true }
}
```

`effect.json` extends `@effect/tsgo` through the root `node_modules` path, so
the package must be installed at the project root (the default for bun and
npm). 0.67.x ships the same strict preset as 0.69, minus
`effecttsgo/on-exit-failure-to-on-error`, so the optional peer accepts
`>=0.67.0`. With isolated `node_modules` layouts, import the preset from
`oxlint.config.ts` instead. Run the Effect rules through `effect-tsgo oxlint`
(or another patched oxlint binding); stock oxlint rejects the preset with
`Unknown plugin: 'effecttsgo'`. Keep `options.typeAware` in the root config
because oxlint applies that option from the root file only.

### @shadcn/lint

`@shadcn/lint` needs its own Tailwind v4 design-system settings, so it stays
optional. Add it next to the presets:

```json
{
  "jsPlugins": [
    "./node_modules/@p-otero/oxlint-rules/dist/plugin.js",
    "@shadcn/lint"
  ],
  "rules": {
    "shadcn/no-arbitrary-values": "error"
  }
}
```

## Rules

| Rule                                      | Origin               | Options                                               |
| ----------------------------------------- | -------------------- | ----------------------------------------------------- |
| `p-otero/no-low-value-comments`           | t3code               |                                                       |
| `p-otero/require-suppression-reason`      | t3code               |                                                       |
| `p-otero/no-inline-schema-compile`        | t3code (no `effect`) |                                                       |
| `p-otero/prefer-effect-fn`                | t3code               |                                                       |
| `p-otero/prefer-catch-tags`               | t3code               |                                                       |
| `p-otero/namespace-node-imports`          | t3code               |                                                       |
| `p-otero/no-em-dash-copy`                 | t3code               |                                                       |
| `p-otero/no-effect-outside-hooks`         | p-otero              | `allow`, `hooks`                                      |
| `p-otero/no-callback-prop-in-effect-deps` | p-otero              | `pattern`                                             |
| `p-otero/no-sticky-request-effect`        | p-otero              | `pattern`                                             |
| `p-otero/require-effect-fetch-cleanup`    | p-otero              |                                                       |
| `p-otero/prefer-sync-external-store`      | p-otero              | `methods`, `ignoreEvents`                             |
| `p-otero/no-loose-semantic-literals`      | p-otero              | `roots`, `skipDirectories`, `testDirectories`         |
| `p-otero/one-public-component`            | p-otero              | `files`, `exempt`                                     |
| `p-otero/component-name-matches-file`     | p-otero              | `files`, `exempt`                                     |
| `p-otero/no-large-private-component`      | p-otero              | `files`, `exempt`, `maxLoc`                           |
| `p-otero/max-component-lines`             | p-otero              | `files`, `exempt`, `maxLoc`                           |
| `p-otero/import-boundaries`               | p-otero              | `scope`, `exclude`, `boundaries`, `workspacePackages` |
| `p-otero/no-cross-feature-imports`        | p-otero              | `featuresDirectory`, `alias`, `files`                 |
| `p-otero/spacing-tokens`                  | p-otero              | `roles`                                               |

`no-callback-prop-in-effect-deps` reports Effect dependencies that are
parameters or props named by `pattern` (default `^on[A-Z]`), or typed as
functions in a same-file type literal, `interface` or `type` alias. JS plugins
get no type information, so imported prop types fall back to the name.
`no-sticky-request-effect` reports a `requested*` prop (`pattern`, default
`^requested[A-Z]`) that an Effect re-applies alongside other dependencies
without calling a consume callback or recording it in a ref.

`require-effect-fetch-cleanup` reports an Effect that calls a state setter in a
`.then`/`.catch`/`.finally` callback or after an `await`, unless it returns a
cleanup that assigns a flag or calls `.abort()`. `prefer-sync-external-store`
reports `addEventListener`, `addListener` and `subscribe` calls (`methods`) in an
Effect whose listener sets state; user-input events such as `keydown` and
`click` are skipped (`ignoreEvents` replaces that list).

`no-latest-ref-effect` checks Effects without a deps array; set
`checkDependencyArrays` to also report `useEffect(() => { ref.current = value; }, [value])`.

`allow` values are globs matched with `path.matchesGlob` against the project
relative path (no brace expansion); the default is `["**/hooks/**"]`.
`files` values are regular expression strings matched against the project
relative path; `roots` and `skipDirectories` are directory names or paths.
Boundary objects are `{ id, message, from?, fromNot?, to?, dependencyTypes? }`;
`dependencyTypes` takes `core`, `local` or `npm`, and the other patterns are
regular expression strings.

The four component rules treat `export { Name }` and `export default Name` as
public bindings: export specifiers and default-exported identifiers resolve to
their module-scope declarations, so `function Name() {}` followed by
`export { Name }` is a public component. Only module-scope declarations resolve;
a nested function is private even when an outer component is exported, and
re-exports (`export { Name } from "./other.ts"`) export nothing declared here.

## License

MIT. Rules ported from `pingdotgg/t3code` keep their MIT headers; see
[NOTICE](NOTICE).
