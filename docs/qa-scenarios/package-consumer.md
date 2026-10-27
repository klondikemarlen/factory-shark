# Consumer Verification

FactoryShark needs two kinds of evidence: isolated scenarios for factory behavior and an installed consumer for packaging and documented usage. Use the commands and prerequisites in [CONTRIBUTING.md](/CONTRIBUTING.md); this page explains their coverage.

## Library Behavior

`npm test` runs factory scenarios against Sequelize 6.37.8 and @sequelize/core 7.0.0-alpha.48 with real in-memory SQLite models. Both families use the root factory API, including a process containing both ORM packages. Scenarios distinguish returned model state from persisted records and cover unsaved builds, association creation and reuse, override precedence, sequences, conditional registration, and hook timing and failure behavior. Type-safety cases are checked by `npm run typecheck`.

The [v7 SQLite fixture](/tests/support.ts) creates fresh model subclasses for each scenario. Sequelize 7 binds an initialized model class to one database instance; closing that database does not make the class reusable for another initialization. Preserve isolated model classes and databases when adding scenarios for either integration.

## Installed Package and README

`npm run smoke` uses [the package verifier](/scripts/verify-package.mjs) to build and pack the current checkout, inspect the artifact, and install it in a temporary external consumer. It verifies the installed package metadata, compiles every README TypeScript block as its documented file, and runs the README's Vitest scenarios against real SQLite fixtures.

The [build command](/scripts/build.mjs) clears `dist/` before compiling. Preserve this clean cutover when removing or renaming an integration module: TypeScript compilation alone does not delete obsolete emitted files, and a stale module must not remain in a release artifact.

The consumer configures `@/` in both TypeScript and Vitest. README application imports—including sibling and type-only imports—must remain unchanged during extraction. A compiler-only path mapping does not prove runtime alias resolution. Model setup and supporting factories live in [the smoke fixtures](/scripts/fixtures/readme), outside the user-facing README examples.

The final CommonJS smoke omits consumer development dependencies and builds a model through the installed package. Its model-initialization harness intentionally retains a relative runtime import: Node's CommonJS loader does not implement TypeScript path aliases. Application factory examples continue to use root aliases.

## Isolated Version Consumers

The v6 smoke installs the artifact with `sequelize@6.37.8`, SQLite, and TypeScript, but without `@sequelize/core` or the v7 dialect package. It checks that the v7 package is absent, compiles the public entry point with `skipLibCheck: false`, and executes real nested association and hook behavior. Successful v6 runtime behavior alone is not sufficient: a leaked v7 declaration import would still break a v6-only application's build.

The v7 consumer also compiles the root declarations and exercises documented factory subclasses without `sequelize` installed, including after development dependencies are removed. Keep both isolated consumers in the same release gate: runtime import isolation and declaration isolation are separate requirements. The [compatibility guide](/docs/architecture/sequelize-compatibility.md) owns model-driven selection and the process for adding a newly qualified release.

Public declaration checks include explicit `associate<Model>(...)` calls, concrete `modelClass` static methods, and native model members on context registrations and their created results. Keep these source-compatible usages when changing the integration types; inferred generator calls alone do not cover the public TypeScript API.

## What These Checks Do Not Prove

A local tarball install does not prove npm publication or installation of a registry release. Follow the separately authorized release procedure for registry artifact identity and fresh-consumer checks. SQLite coverage does not claim a running WRAP application or every database dialect was exercised.

`npm run check` combines formatting, type checking, library scenarios, and the consumer smoke. CI runs that gate on Node.js 22 and 24 without path filters. Keep concrete execution results in the pull request or session, not as permanent status assertions in this knowledge base.
