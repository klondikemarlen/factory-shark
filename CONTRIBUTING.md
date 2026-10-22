# Contributing

## Setup and Checks

Use Node.js 22 or 24 and npm. No Docker, WRAP checkout, application environment variables, external database, or private fixtures are needed.

```sh
npm ci
npm run check
```

`npm run typecheck` checks the strict TypeScript library and type-safety scenarios. `npm test` runs consumer-visible scenarios against isolated, in-memory SQLite with Sequelize 7.0.0-alpha.48. `npm run build` emits CommonJS and declarations into `dist/`. `npm run smoke` builds/packs the package, installs that tarball into a temporary external consumer, and compiles and executes the README example, including real association persistence. The smoke command needs npm registry access for consumer dependencies and cleans up its own temporary directory on completion. SQLite's native dependency needs either an available prebuilt binary or the usual native build toolchain.

Tests belong in `tests/`; use generic local models and real disposable persistence rather than application models or mock-only ORM assertions. Cover externally observable contracts, not private implementation structure. Use `when [condition], [behavior]` test names and Arrange/Act/Assert phases. Type-safety cases use `@ts-expect-error` so unexpectedly accepted invalid input fails type checking.

Changes follow an issue-linked branch and PR. Keep extraction behavior stable unless a separate accepted issue changes the contract. Include meaningful QA steps, resolve review findings, and merge only after checks pass. New source derived from WRAP must preserve its Apache attribution and identify modifications; new original infrastructure/documentation is MIT licensed.

## Release

There is no automatic registry publication. The initial deliverable is a verified, publish-ready `0.1.0` tarball, not evidence of an npm release. Publishing requires separate maintainer authorization and credentials; never put tokens in the repository.

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
