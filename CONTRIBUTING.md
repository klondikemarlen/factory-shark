# Contributing

## Setup and Checks

Use a current Node.js 22 or 24 release and npm 11.12.1 for development checks. No Docker, WRAP checkout, application environment variables, external database, or private fixtures are needed. CI pins the same npm version because npm 10.9.9 crashes in peer-dependency resolution for the consumer's Vitest toolchain; the library's Node/Sequelize runtime contract is unchanged.

```sh
npm install --global npm@11.12.1
npm ci
npm run check
```

`npm run format:check` checks formatting for code, documentation examples, and configuration. `npm run typecheck` checks the strict TypeScript library and type-safety scenarios. `npm test` runs consumer-visible scenarios against isolated, in-memory SQLite with Sequelize 7.0.0-alpha.48. `npm run build` emits CommonJS and declarations into `dist/`. `npm run smoke` builds/packs the package, installs that tarball into a temporary external consumer, and compiles every README TypeScript example with WRAP's TypeScript 5.4.5, ES2020 target, and Node16 module resolution. It runs the documented Vitest tests unchanged against small real SQLite model contracts and supporting factories from `scripts/fixtures/readme/`; no WRAP services or application boot are involved. The consumer pins WRAP's resolved Faker 8.4.1, Vitest 4.1.5, and Vite 7.3.1 versions rather than allowing Vitest's broad Vite peer range to drift to a different major. After those checks, it removes consumer development dependencies and exercises a CommonJS factory build using only runtime dependencies. The smoke command needs npm registry access and cleans up its own temporary directory on completion. SQLite's native dependency needs either an available prebuilt binary or the usual native build toolchain.

Tests belong in `tests/`; use generic local models and real disposable persistence rather than application models or mock-only ORM assertions. Cover externally observable contracts, not private implementation structure. Use `when [condition], [behavior]` test names and Arrange/Act/Assert phases. Type-safety cases use `@ts-expect-error` so unexpectedly accepted invalid input fails type checking.

Changes follow an issue-linked branch and PR. Keep extraction behavior stable unless a separate accepted issue changes the contract. Include meaningful QA steps, resolve review findings, and merge only after checks pass. New source derived from WRAP must preserve its Apache attribution and identify modifications; new original infrastructure/documentation is MIT licensed.

## Coding Conventions

Run `npm run format` before submitting changes. The checked-in Prettier configuration uses two-space indentation, double quotes, no semicolons, and trailing commas where supported by ES5. `npm run check` includes the format check, so CI checks the same files and README code examples as local development. Generated output, installed dependencies, tarballs, and the npm-generated lockfile are not formatter inputs.

- Keep multi-property objects and types expanded, including Sequelize schemas, options, and assertion expectations. Give each callback statement its own line and separate logical steps with one blank line.
- Group imports by standard library, third-party dependencies, then local modules. Mark type-only bindings explicitly and keep them together within each group; do not interleave them with runtime bindings.
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

Record the merged commit and the resulting tarball filename, integrity, and SHA-256. Inspect the file list: only compiled code/declarations, attributed source, README, package metadata, and both licenses/NOTICE belong in the artifact. CI uses an unfiltered Node 22/24 matrix; package or source changes run the same checks, and `setup-node` keys its dependency cache from `package-lock.json`.

For an authorized registry release:

1. Authenticate with the intended npm maintainer identity (`npm whoami`). Recheck `npm view factory-shark name version`: the initial unscoped name returned 404, but was not reserved. If another owner has claimed it, resolve a maintainer-controlled name before publishing; do not silently publish under another identity or scope.
2. For subsequent releases, update the version and lockfile together and add a scoped changelog entry through the normal issue/PR workflow. Pack the exact merged version intended for release.
3. Inspect with `npm publish ./factory-shark-<version>.tgz --dry-run`, then, only with authorization, publish that exact tarball using `npm publish ./factory-shark-<version>.tgz --access public`. Retain npm's result and registry integrity/version; an upload command alone is not installed-artifact proof.
4. Tag the intended release commit as `v<version>` after successful publication. In a fresh external consumer, install `factory-shark@<version>` from the registry, verify its installed version and registry integrity against the release artifact, compile the README example, and run it. A local pack smoke does not establish registry publication or deployment.

The `MIT AND Apache-2.0` package metadata reflects the combined distribution. `LICENSE` covers new original work; `LICENSE-APACHE` and `NOTICE` cover extracted material. Do not change this to MIT-only without explicit rights-holder permission.
