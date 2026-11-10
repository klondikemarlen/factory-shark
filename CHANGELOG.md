# Changelog

## 2.6.0

- Persist supplied `hasMany` model arrays after saving their parent and before eager loading or after-create hooks. Unsaved children receive the parent's foreign key; persisted children cannot be silently moved between parents. Builds preserve supplied arrays without database access, and failures leave earlier writes intact.

## 2.5.0

- Build unsaved model lists synchronously with `buildList(count, params?)` on original and configured factories. Each item preserves build configuration, overrides, associations, and sequence progression without database access or create hooks; zero builds nothing, and generation stops at the first error.

## 2.4.0

- Request existing associations with typed `.include(selection)` on original and configured factories. `create` and `createList` reload includes after save and before after-create hooks; `build` and `attributesFor` remain synchronous and database-free. Include selections replace independently, support nested Sequelize 6/7 forms, and propagate loading errors without rolling back saved records.

## 2.3.0

- Reuse supplied `belongsTo` models in unsaved builds, preserving their identity and nested relationships. Known parent IDs fill missing foreign keys without database access; explicit foreign-key overrides retain precedence. `attributesFor` includes inferred scalar keys without copying association models.

## 2.2.2

- Keep Sequelize model recognition in the compatibility adapter so changes to native model contracts have one owner. Public APIs, supported versions, and validation behavior are unchanged.

## 2.2.1

- Use canonical, release-versioned factory-authoring templates for definitions, associations, custom builders, hooks, lists, and unsaved payloads. The README links to the matching guide; generic executable examples replace application-specific examples, while model and project conventions remain consumer-owned.

## 2.2.0

- Extract unsaved model attributes with synchronous `attributesFor(params?)` on original and configured factories. It follows build precedence and sequences, preserves Date and Buffer values, and performs no persistence or create hooks.

## 2.1.0

- Create persisted model lists with `createList(count, params?)` on original and configured factories, retaining associations, hooks, overrides, transient parameters, and sequence progression. Items are created sequentially; failures stop the list without rolling back earlier records.
- Check maintained JavaScript and TypeScript with Oxlint correctness rules and zero allowed warnings in the development and CI gate.

## 2.0.0

- **Breaking:** use one model-driven `factory-shark` API for Sequelize 6 and 7. Replace `factory-shark/sequelize-v6` and `factory-shark/sequelize-v7` imports with `factory-shark`; the versioned subpaths are no longer exported. Existing v7 root imports are unchanged.
- Provide native ESM and CommonJS bundles with matching TypeScript declarations.
- Use the MIT License. Previously published releases retain their original terms.

## 1.1.0

- Remove unused internal type parameters from attribute evaluation while preserving public factory typing and runtime behavior.
- Isolate Sequelize-specific model types and operations behind a shared-engine compatibility layer; retain existing v7 root imports and provide explicit v6/v7 entry points.
- Support Sequelize 6.37.8 alongside @sequelize/core 7.0.0-alpha.48, with optional peers and isolated installed-consumer runtime and declaration checks.
- Rewrite the README around factory usage, the Sequelize association design, and the robotic-shark name; remove inaccessible private-source links.
- Consolidate project licensing; previously published releases retain their original terms.
- Add a project knowledge base with durable architecture, decision, and QA guidance.
- Use application-root imports throughout README examples and supporting factory fixtures; resolve the aliases in both TypeScript and the executable packed-consumer smoke.

## 1.0.0

- Stabilize the original factory API without changing runtime behavior, public exports, association precedence, or hook ordering.
- Verify documented factory usage with TypeScript 5.4.5, ES2020 target, and Node16 module resolution.
- Exercise CommonJS factory builds with consumer development dependencies omitted; clarify test-only versus runtime dependency placement and the embedded-library import cutover.

## 0.1.0

- Extract FactoryShark from WRAP, retaining its factory, association, hook, and root-export contracts.
- Package CommonJS runtime code and TypeScript declarations for Node.js 22/24 and Sequelize 7.0.0-alpha.48.
- Add isolated SQLite behavior/type checks, a packed-consumer smoke using the README example, and CI.
- Apply the project coding conventions to library code, README examples, tests, and package verification; enforce formatting through the normal checks.
- Show application-shaped factory modules and focused Vitest usage in the README, compiling and running every documented TypeScript example against the packed artifact.
- Separate returned-model state, association state, and per-table persistence expectations into focused behavioral tests.
- Preserve attribution and licensing terms for extracted material.

Install this version with `npm install --save-dev factory-shark@0.1.0`.
