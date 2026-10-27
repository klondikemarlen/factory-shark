# Consumer Verification

FactoryShark needs two kinds of evidence: isolated scenarios for factory behavior and an installed consumer for packaging and documented usage. Use the commands and prerequisites in [CONTRIBUTING.md](/CONTRIBUTING.md); this page explains their coverage.

## Library Behavior

`npm test` runs factory scenarios against Sequelize 6.37.8 and @sequelize/core 7.0.0-alpha.48 with real in-memory SQLite models. Both families use the root factory API, including a process containing both ORM packages. Scenarios distinguish returned model state from persisted records and cover unsaved builds, association creation and reuse, override precedence, sequences, conditional registration, and hook timing and failure behavior. Type-safety cases are checked by `npm run typecheck`.

The [v7 SQLite fixture](/tests/support.ts) creates fresh model subclasses for each scenario. Sequelize 7 binds an initialized model class to one database instance; closing that database does not make the class reusable for another initialization. Preserve isolated model classes and databases when adding scenarios for either integration.

## Installed Package and README

`npm run smoke` uses [the package verifier](/scripts/verify-package.mjs) to build and pack the current checkout, inspect the artifact, and install it in a temporary external consumer. It verifies the installed package metadata, compiles every README TypeScript block as its documented file, and runs the README's Vitest scenarios against real SQLite fixtures.

The [build command](/scripts/build.mjs) clears `dist/` before building. [Vite library mode](/vite.config.mjs) emits native ESM and CommonJS bundles while keeping runtime dependencies external. TypeScript emits shared declarations; `tsc-alias` rewrites repository-root imports to portable relative paths. Separate `.d.mts` and `.d.cts` root declarations let Node16/NodeNext consumers select the same module format as the runtime exports. Preserve this clean cutover when removing or renaming modules: obsolete generated files must not remain in the artifact.

The consumer configures `@/` in both TypeScript and Vitest. README application imports—including sibling and type-only imports—must remain unchanged during extraction. A compiler-only path mapping does not prove runtime alias resolution. Model setup and supporting factories live in [the smoke fixtures](/scripts/fixtures/readme), outside the user-facing README examples.

The installed-format checks compile `.mts` and `.cts` consumers and run the resulting native ESM and CommonJS programs. Both use real model instances and persistence through the installed package, including default and named ESM imports. They run again after development dependencies are omitted. Generated runtime harnesses resolve emitted files directly; consumers do not need this repository's `@/` mapping.

## Isolated Version Consumers

The v6 smoke installs the artifact with `sequelize@6.37.8`, SQLite, and TypeScript, but without `@sequelize/core` or the v7 dialect package. It checks that the v7 package is absent, compiles the public entry point with `skipLibCheck: false`, and executes real nested association and hook behavior. Successful v6 runtime behavior alone is not sufficient: a leaked v7 declaration import would still break a v6-only application's build.

The v7 consumer also compiles the root declarations and exercises documented factory subclasses without `sequelize` installed, including after development dependencies are removed. Keep both isolated consumers in the same release gate: runtime import isolation and declaration isolation are separate requirements. The [compatibility guide](/docs/architecture/sequelize-compatibility.md) owns model-driven selection and the process for adding a newly qualified release.

The focused v7 declaration check retains ES2020 output and uses ES2022 library types because Sequelize declares native `Error.cause`/`ErrorOptions`. Supported Node.js 22/24 runtimes provide that API. This check uses `skipLibCheck: false` independently of the README's Vitest toolchain.

The repository uses TypeScript 7 for development, while installed-consumer checks retain TypeScript 5.4.5. This separates the build-tool upgrade from the supported declaration syntax. Both conditional declaration entries must compile without the other ORM installed.

Public declaration checks include explicit `associate<Model>(...)` calls, concrete `modelClass` static methods, and native model members on context registrations and their created results. Keep these source-compatible usages when changing the integration types; inferred generator calls alone do not cover the public TypeScript API.

## What These Checks Do Not Prove

A local tarball install does not prove npm publication or installation of a registry release. Follow the separately authorized release procedure for registry artifact identity and fresh-consumer checks. SQLite coverage does not claim a running consuming application or every database dialect was exercised.

`npm run check` combines formatting, type checking, library scenarios, and the consumer smoke. CI runs that gate on Node.js 22 and 24 without path filters. Keep concrete execution results in the pull request or session, not as permanent status assertions in this knowledge base.
