# Agent notes

## Code style

- Code must be self-explanatory: names, structure and small units convey intent
  without comments.
- Comments only for non-obvious rationale: upstream bugs, platform or protocol
  constraints, security or performance reasoning. No narrative comments, no
  section dividers, no commented-out code, and no TODOs without a linked issue.
- A ported file keeps its license header; that is the only allowed boilerplate.
- TypeScript uses erasable syntax only (Node 24 type stripping): no enums,
  namespaces or parameter properties.

## Verify

```sh
bun run verify
```

Runs the repo's own base preset plus plugin with `oxlint --deny-warnings`,
`bun fmt --check`, `tsc --noEmit`, and `bun test`.
