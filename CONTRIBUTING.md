# Contributing

Before making changes, consult the [project knowledge base](docs/README.md). Update the owning document when verified behavior, decisions, or QA knowledge changes; keep transient run reports in the issue or pull request.

## Setup and Checks

Use a current Node.js 22 or 24 release and npm 11.12.1 for development checks. No Docker, WRAP checkout, application environment variables, external database, or private fixtures are needed. CI pins the same npm version because npm 10.9.9 crashes in peer-dependency resolution for the consumer's Vitest toolchain; the library's Node/Sequelize runtime contract is unchanged.

```sh
npm install --global npm@11.12.1
npm ci
npm run check
```

`npm run format:check` checks code, documentation examples, and configuration. `npm run typecheck` checks the strict TypeScript library and type-safety scenarios. `npm test` runs consumer-visible scenarios against isolated, in-memory SQLite with Sequelize 6.37.8 and @sequelize/core 7.0.0-alpha.48. `npm run build` emits CommonJS and declarations into `dist/`. `npm run smoke` packs the package and installs it into separate external consumers for each integration. The v7 consumer compiles every README TypeScript example with TypeScript 5.4.5, ES2020, and Node16 module resolution, then runs the documented Vitest tests unchanged against the real SQLite contracts in `scripts/fixtures/readme/`. It pins Faker 8.4.1, Vitest 4.1.5, and Vite 7.3.1 and exercises a CommonJS build after removing development dependencies. The v6 consumer compiles with declaration checking enabled and runs real association behavior without `@sequelize/core` installed. No application checkout, services, or boot are involved. The smoke needs npm registry access and cleans up its temporary directories. SQLite needs an available prebuilt binary or the usual native build toolchain.

Tests belong in `tests/`; use generic local models and real disposable persistence rather than application models or mock-only ORM assertions. Cover externally observable contracts, not private implementation structure. Use `when [condition], [behavior]` test names and Arrange/Act/Assert phases. Type-safety cases use `@ts-expect-error` so unexpectedly accepted invalid input fails type checking.

Changes follow an issue-linked branch and PR. Keep factory behavior stable unless a separate accepted issue changes the contract. Include meaningful QA steps, resolve review findings, and merge only after checks pass. Project contributions use Apache-2.0. Preserve attribution and identify modifications to WRAP-derived material; dependencies retain their own licenses.

## Coding Conventions

Run `npm run format` before submitting changes. The checked-in Prettier configuration uses two-space indentation, double quotes, no semicolons, and trailing commas where supported by ES5. `npm run check` includes the format check, so CI checks the same files and README code examples as local development. Generated output, installed dependencies, tarballs, and the npm-generated lockfile are not formatter inputs.

- Keep non-empty objects and types expanded, including Sequelize schemas, options, and assertion expectations. Give each callback statement its own line and separate logical steps with one blank line.
- Group imports by standard library, third-party dependencies, then local modules. Mark type-only bindings explicitly and keep them together within each group; do not interleave them with runtime bindings.
- README application examples and their supporting factory fixtures use WRAP's root aliases (`@/models`, `@/factories`), including sibling and type-only imports. Keep relative barrel re-exports. The smoke consumer must configure matching TypeScript and test-runner resolution and execute the examples unchanged; do not replace aliases with relative imports for portability. This does not change the standalone library's relative internal imports or its package-root public entry point.
- Keep the module under test in its own final import group, separated from model, support, and factory dependencies by a blank line.
- Use explanatory names and named parameter types instead of dense inline generic shapes. Preserve type predicates, conditional types, and explicit return types that protect a public or recursive contract.
- Use explicit `if`/`else` branches instead of runtime ternaries. Prefer Lodash `isUndefined` for undefined checks. Keep necessary TypeScript conditional types; they describe type relationships rather than runtime control flow.
- Break dense fluent expressions into named steps when that makes precedence or effects easier to follow. Extract a helper only when it names a meaningful responsibility, not merely to shorten a line.
- Keep model initialization, factory evaluation, and package-verification side effects visible. Explain non-obvious state invariants beside their owner, including sequence ownership, generator caching, and Sequelize fixture isolation.
- Give each behavioral test one primary expectation concept. Keep returned-model state, association state, and each independently observed persistence result in separate tests; do not hide secondary assertions in Arrange, Act, helpers, or synthetic summary objects. Keep literal inputs in Arrange, the operation in Act, and observation queries in Assert immediately above their assertions. Use fresh isolated fixtures rather than depending on previous tests.

## Release

Releases are published manually from a reviewed, synchronized `main` checkout. Publication requires maintainer authorization and credentials; never put tokens in the repository.

After the reviewed PR merges, synchronize `main` and run:

```sh
npm ci
npm run check
npm pack --json
```

Record the merged commit and the resulting tarball filename, integrity, and SHA-256. Inspect the file list: only compiled code/declarations, attributed source, README, package metadata, LICENSE, and NOTICE belong in the artifact. CI uses an unfiltered Node 22/24 matrix; package or source changes run the same checks, and `setup-node` keys its dependency cache from `package-lock.json`.

For an authorized registry release:

1. Authenticate with the intended npm maintainer identity (`npm whoami`). Recheck `npm view factory-shark name version`: the initial unscoped name returned 404, but was not reserved. If another owner has claimed it, resolve a maintainer-controlled name before publishing; do not silently publish under another identity or scope.
2. For subsequent releases, update the version and lockfile together and add a scoped changelog entry through the normal issue/PR workflow. Pack the exact merged version intended for release.
3. Inspect with `npm publish ./factory-shark-<version>.tgz --dry-run`, then, only with authorization, publish that exact tarball using `npm publish ./factory-shark-<version>.tgz --access public`. Retain npm's result and registry integrity/version; an upload command alone is not installed-artifact proof.
4. Tag the intended release commit as `v<version>` after successful publication. In a fresh external consumer, install `factory-shark@<version>` from the registry, verify its installed version and registry integrity against the release artifact, compile the README example, and run it. A local pack smoke does not establish registry publication or deployment.

The current source and future releases use Apache-2.0 for project work. Previously published releases retain the terms under which they were released; dependencies retain their own licenses.
