# Changelog

## Unreleased

- **Breaking:** use one model-driven `factory-shark` API for Sequelize 6 and 7; remove the `factory-shark/sequelize-v6` and `factory-shark/sequelize-v7` subpaths. Replace versioned factory imports with the package root.
- Group Sequelize runtime and type integration code under `src/compatibility/sequelize/`, without duplicating the factory engine or requiring the unused ORM package.
- Keep native Sequelize association lookup details behind the compatibility boundary; document how API-contract changes within a major version reuse the shared factory engine.

## 1.1.0

- Remove unused internal type parameters from attribute evaluation while preserving public factory typing and runtime behavior.
- Isolate Sequelize-specific model types and operations behind a shared-engine compatibility layer; retain existing v7 root imports and provide explicit v6/v7 entry points.
- Support Sequelize 6.37.8 alongside @sequelize/core 7.0.0-alpha.48, with optional peers and isolated installed-consumer runtime and declaration checks.
- Rewrite the README around factory usage, the Sequelize association design, and the robotic-shark name; remove inaccessible private-source links.
- Standardize the project and new original work on Apache-2.0; previously published releases retain their original terms.
- Add a project knowledge base with durable architecture, decision, and QA guidance.
- Use WRAP's root application imports throughout README examples and supporting factory fixtures; resolve the aliases in both TypeScript and the executable packed-consumer smoke.

## 1.0.0

- Stabilize the extracted WRAP factory API without changing runtime behavior, public exports, association precedence, or hook ordering.
- Verify documented factory usage with WRAP's TypeScript 5.4.5, ES2020 target, and Node16 module resolution.
- Exercise CommonJS factory builds with consumer development dependencies omitted; clarify test-only versus runtime dependency placement and the embedded-library import cutover.

## 0.1.0

- Extract FactoryShark from WRAP, retaining its factory, association, hook, and root-export contracts.
- Package CommonJS runtime code and TypeScript declarations for Node.js 22/24 and Sequelize 7.0.0-alpha.48.
- Add isolated SQLite behavior/type checks, a packed-consumer smoke using the README example, and CI.
- Apply the project coding conventions to library code, README examples, tests, and package verification; enforce formatting through the normal checks.
- Show WRAP-shaped factory modules and focused Vitest usage in the README, compiling and running every documented TypeScript example against the packed artifact.
- Separate returned-model state, association state, and per-table persistence expectations into focused behavioral tests.
- Preserve Apache-2.0 attribution for extracted material alongside MIT terms for new original work.

Install this version with `npm install --save-dev factory-shark@0.1.0`.
