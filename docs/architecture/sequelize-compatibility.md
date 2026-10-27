# Sequelize Compatibility

FactoryShark separates factory evaluation from Sequelize integration. Consumers import one public API from `factory-shark`; the model supplied to `FactoryShark.define()` determines its integration. The shared engine owns generation, association ordering, parameter precedence, sequences, and hooks.

## Supported Models

| Sequelize family | Consumer package  | Peer range       | Verified release |
| ---------------- | ----------------- | ---------------- | ---------------- |
| Sequelize 6      | `sequelize`       | `^6.37.8`        | `6.37.8`         |
| Sequelize 7      | `@sequelize/core` | `7.0.0-alpha.48` | `7.0.0-alpha.48` |

Your application supplies its ORM and dialect. Both peers remain optional, so a v6-only project does not need v7 installed, and vice versa. A process may contain both families: selection follows the supplied model, not whichever package happens to be found first. Keep related models in the same association graph on one Sequelize installation.

The unified root API is an Unreleased source change. Published `1.1.0` has the earlier explicit v6/v7 entry points. Migrating to this source build removes those versioned subpaths: import factories and factory types from `factory-shark` instead. Root-import v7 callers keep their import.

## Trying the Source Build

In a FactoryShark checkout, run `npm ci` followed by `npm pack --json`. The pack output identifies the `.tgz` filename. Install that artifact from your application's checkout with `npm install --save-dev <tarball-path>`, replacing `<tarball-path>` with its actual path. Both families use the root `factory-shark` import.

A local build can differ from the registry artifact of the same version. Use its file path and recorded integrity to identify it rather than treating a successful source install as registry-release evidence.

## Boundary and Ownership

The engine depends on the operations it needs, not on either package's complete model class. The compatibility layer supplies model construction and persistence, instance access, association metadata, and target lookup. Sequelize-specific runtime and type assumptions live together under `src/compatibility/sequelize/`; the unified factory facade remains separate from factory evaluation. The public declaration graph must not import either optional ORM, while retaining the supplied model's instance and static types.

The shared association contract exposes foreign-key metadata, not Sequelize's association target or its lookup methods. Only the Sequelize adapter interprets the native association object. An upstream change to target lookup therefore belongs in that implementation, not in the factory engine's types or association lifecycle.

For the currently supported releases, the structural type mapping reads Sequelize's declared `_creationAttributes` type to retain the model's native creation-attribute information without importing either ORM. This is type-only metadata, never a runtime property read. Sequelize marks that property as deprecated, so its eventual replacement must be handled in the compatibility type mapping when qualifying a new contract; it is not a guarantee that every future Sequelize type definition will work unchanged.

This follows the dependency-inversion approach illustrated by [Umzug's Sequelize storage](https://github.com/sequelize/umzug/blob/main/src/storage/sequelize.ts): a small structural contract isolates an ORM integration from the library's main workflow. FactoryShark keeps its own strict model-specific attribute and association types rather than copying Umzug's broad storage types.

Organize adapters by real API differences, not one directory per patch number. Reuse an operation when both families implement the same protocol; isolate differences at the boundary instead of adding version checks to the generator or association lifecycle. There is one factory engine, not a separate implementation for each supported release.

## Evolving Within an API Family

The public entry point identifies the factory API, not a separate implementation for every Sequelize release. Internal compatibility implementations follow API contracts, which can change within a major version. Group integration code by that responsibility; add a subdirectory only when a contract has multiple cohesive implementation pieces.

For a release such as `7.0.0-alpha.49`:

- If its runtime protocol and public types remain compatible, reuse the existing adapter and facade. After qualification, extend the supported peer range explicitly; do not add a release-specific module.
- If a runtime operation changes, keep both supported contracts behind `FactoryAdapter`. Add only the changed protocol implementation and select it inside the Sequelize integration for its declared compatible version range. Share unchanged operations; do not copy factory evaluation, association ordering, hooks, or sequencing. Reuse the selected adapter rather than allocating one for every factory or evaluation.
- If native TypeScript contracts change, adapt the integration's type mapping separately from runtime selection. Preserve the unified public API and precise inferred attributes; do not require both optional ORM packages merely to type-check one application.

Version matching belongs inside the integration, never in generators or the association lifecycle. Preserve the implementation for older supported contracts when adding a new one. Do not silently select the closest older version or assume an unknown prerelease implements the same protocol. Resolve from the supplied model and reuse the integration rather than scanning installed packages.

The supported v6 and v7 releases share one runtime protocol implementation. Their native type assumptions still need explicit maintenance when upstream changes; automatic model selection does not make unknown releases compatible. The `alpha.49` example describes where a real future difference belongs, not a support claim for that release.

## Qualifying Another Version

1. Inspect the upstream release's public model, association, persistence, and TypeScript contracts. A matching method name alone is not proof of compatibility.
2. Run real model and association scenarios against that release: unsaved build, nested foreign-key propagation, persisted overrides, hooks, and subclass/transient usage. Preserve the existing supported versions in the same gate.
3. Install the packed artifact into a separate consumer containing only that family's Sequelize package. Compile positive and rejected-input cases with declaration checking enabled, then run the model/association smoke through the root import. Neither the parent checkout nor the other ORM package may supply missing declarations.
4. If the release fits the existing adapter, extend its tested scope and peer range deliberately. If the public protocol differs, add a small internal compatibility implementation and reuse the engine and public factory API.
5. Update this table, the README's selection guidance, and the consumer verification guide in the same reviewed delivery. Registry publication needs its own observed artifact and installation evidence.

The stable v6 peer range allows compatible minor and patch releases, while the development and smoke dependencies pin the release actually checked. The v7 alpha remains exact because prerelease APIs can change without the stability guarantees of a final major release. Future versions are candidates for qualification, not automatic compatibility promises.

The model contract still uses `id` primary keys and `belongsTo` associations. Version compatibility does not add association kinds or change transaction and failure semantics; see [factory evaluation](/docs/architecture/factory-evaluation.md).
