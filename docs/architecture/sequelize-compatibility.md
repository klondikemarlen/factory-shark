# Sequelize Compatibility

FactoryShark separates factory evaluation from the Sequelize integration. A project chooses an integration for its installed Sequelize API family; the shared engine owns generation, association ordering, parameter precedence, sequences, and hooks.

## Choosing an Integration

| Integration | Consumer package  | Peer range       | Verified release | Import                                          |
| ----------- | ----------------- | ---------------- | ---------------- | ----------------------------------------------- |
| Sequelize 6 | `sequelize`       | `^6.37.8`        | `6.37.8`         | `factory-shark/sequelize-v6`                    |
| Sequelize 7 | `@sequelize/core` | `7.0.0-alpha.48` | `7.0.0-alpha.48` | `factory-shark` or `factory-shark/sequelize-v7` |

The root entry point remains the v7 integration so existing projects do not need an import migration. A v6 consumer imports its factory and type helpers from `factory-shark/sequelize-v6`. Keep factories in one association graph on the same integration and Sequelize installation. Both peers are optional in package metadata so choosing one does not install the other. The consuming application supplies its ORM and dialect.

The compatibility entry points are available in the source build. Published npm version 1.0.0 predates the v6 integration; a local packed artifact is not proof that a newer registry release exists. Follow the authorized release procedure in [CONTRIBUTING.md](/CONTRIBUTING.md) before documenting a new published version.

## Trying the Source Build

In a FactoryShark checkout, run `npm ci` followed by `npm pack --json`. The pack output identifies the `.tgz` filename. Install that artifact from your application's checkout with `npm install --save-dev <tarball-path>`, replacing `<tarball-path>` with its actual path, and import the integration matching your application's Sequelize package.

The artifact retains the source package version until a versioned release is prepared. Use its file path and recorded integrity to identify a local build; do not confuse it with the existing registry artifact of the same version.

## Boundary and Ownership

The engine depends on the operations it needs, not on either package's complete model class. The compatibility layer supplies model construction and persistence, instance access, association metadata, and target lookup. Version-specific public types preserve the application's model and creation-attribute types. The v6 declarations must not import v7 declarations transitively, and the v7 entry point must preserve existing factory subclasses and static model-class typing.

This follows the dependency-inversion approach illustrated by [Umzug's Sequelize storage](https://github.com/sequelize/umzug/blob/main/src/storage/sequelize.ts): a small structural contract isolates an ORM integration from the library's main workflow. FactoryShark keeps its own strict model-specific attribute and association types rather than copying Umzug's broad storage types.

Organize adapters by real API differences, not one directory per patch number. Reuse an operation when both families implement the same protocol; isolate differences at the boundary instead of adding version checks to the generator or association lifecycle. There is one factory engine, not a separate implementation for each supported release.

## Qualifying Another Version

1. Inspect the upstream release's public model, association, persistence, and TypeScript contracts. A matching method name alone is not proof of compatibility.
2. Run real model and association scenarios against that release: unsaved build, nested foreign-key propagation, persisted overrides, hooks, and subclass/transient usage. Preserve the existing supported versions in the same gate.
3. Install the packed artifact into a separate consumer containing only that integration's Sequelize package. Compile positive and rejected-input cases with declaration checking enabled, then run the model/association smoke. Neither the parent checkout nor the other ORM package may supply missing declarations.
4. If the release fits the existing adapter, extend its tested scope and peer range deliberately. If the public protocol differs, add a small integration implementation and reuse the engine. Publish a new entry point only when consumers need to select a distinct contract.
5. Update this table, the README's selection guidance, and the consumer verification guide in the same reviewed delivery. Registry publication needs its own observed artifact and installation evidence.

The stable v6 peer range allows compatible minor and patch releases, while the development and smoke dependencies pin the release actually checked. The v7 alpha remains exact because prerelease APIs can change without the stability guarantees of a final major release. Future versions are candidates for qualification, not automatic compatibility promises.

The model contract still uses `id` primary keys and `belongsTo` associations. Version compatibility does not add association kinds or change transaction and failure semantics; see [factory evaluation](/docs/architecture/factory-evaluation.md).
