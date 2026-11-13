# Sequelize Compatibility

FactoryShark separates factory evaluation from Sequelize integration. Consumers import one public API from `factory-shark`; the model supplied to `FactoryShark.define()` determines its integration. The shared engine owns generation, association ordering, parameter precedence, sequences, and hooks.

## Supported Models

| Sequelize family | Consumer package  | Peer range       | Verified release |
| ---------------- | ----------------- | ---------------- | ---------------- |
| Sequelize 6      | `sequelize`       | `^6.37.8`        | `6.37.8`         |
| Sequelize 7      | `@sequelize/core` | `7.0.0-alpha.48` | `7.0.0-alpha.48` |

Your application supplies its ORM and dialect. Both peers remain optional, so a v6-only project does not need v7 installed, and vice versa. A process may contain both families: selection follows the supplied model, not whichever package happens to be found first. Keep related models in the same association graph on one Sequelize installation.

FactoryShark 2 uses the root API for both families. When upgrading from 1.x, replace `factory-shark/sequelize-v6` and `factory-shark/sequelize-v7` imports with `factory-shark`; the versioned subpaths are no longer exported. Existing v7 root imports stay the same.

## Local Package Builds

In a FactoryShark checkout, run `npm ci` followed by `npm pack --json`. The pack output identifies the `.tgz` filename. Install that artifact from your application's checkout with `npm install --save-dev <tarball-path>`, replacing `<tarball-path>` with its actual path. Both families use the root `factory-shark` import.

A local build can differ from the registry artifact of the same version. Use its file path and recorded integrity to identify it rather than treating a successful source install as registry-release evidence.

## Boundary and Ownership

The engine depends on the operations it needs, not on either package's complete model class. The compatibility layer supplies model construction and persistence, instance access, association metadata, and target lookup. Sequelize-specific runtime and type assumptions live together under `src/compatibility/sequelize/`; the unified factory facade remains separate from factory evaluation. The public declaration graph must not import either optional ORM, while retaining the supplied model's instance and static types.

The Sequelize adapter owns class-shape validation, supported-instance recognition, and the single shared adapter instance; factories and public helpers reuse it without per-factory or per-evaluation allocation. Class shape is checked when a factory or association is registered, while initialization and supported-version checks remain at model use.

The [public helper adapters](/src/compatibility/sequelize/public-helpers.ts) adapt `FactoryContext`, `AssociationManager`, and `AttributeBuilder` to the consumer's Sequelize model types and constructors. Change those wrappers for helper integration; change the main facade for factory-facing configuration. The [root entry point](/src/index.ts) exports each public symbol from its owner, so helpers, errors, and constants do not depend on facade re-exports. Helper references to factory types are type-only and introduce no runtime dependency on the facade.

The shared association contract exposes foreign-key metadata, not Sequelize's association target or its lookup methods. Only the Sequelize adapter interprets the native association object. An upstream change to target lookup therefore belongs in that implementation, not in the factory engine's types or association lifecycle.

For the currently supported releases, the structural type mapping reads Sequelize's declared `_creationAttributes` type to retain the model's native creation-attribute information without importing either ORM. This is type-only metadata, never a runtime property read. Sequelize marks that property as deprecated, so its eventual replacement must be handled in the compatibility type mapping when qualifying a new contract; it is not a guarantee that every future Sequelize type definition will work unchanged.

Include selection types come from the concrete model's native `reload` options, so each consumer gets its installed Sequelize family's accepted string, model, association, object, and nested include forms without a dependency on the other ORM. Only the compatibility adapter calls native reload; the shared builder controls when it runs in the create lifecycle.

Supplied `hasMany` collection handling also belongs to the compatibility layer: it interprets native association kinds, validates child model membership, and persists children and their attached `belongsTo` dependencies. The shared builder owns when attachment and persistence occur, without inspecting Sequelize association objects.

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

Factory-generated dependencies use `belongsTo` metadata, including primary or unique `targetKey` attributes other than `id`. Supplied `hasMany` model arrays retain their `id`-key construction contract. Native eager loading through `.include()` queries existing relationships rather than generating more records. `.onCreate()` can replace one factory's persistence step without replacing the shared lifecycle. Version compatibility does not change transaction and failure semantics; see [factory evaluation](/docs/architecture/factory-evaluation.md).

## Existing SQL Server `datetime` Columns

With `@sequelize/core` and `@sequelize/mssql` **7.0.0-alpha.48**, `DataTypes.DATE` represents SQL Server `datetimeoffset`, not legacy `datetime`. Binding a JavaScript `Date` produces a value such as `2026-11-13 14:15:16.120 +00:00`. An existing `datetime` column rejects that string with error **241**, `Conversion failed when converting date and/or time from character string.` Native Sequelize creation and standard FactoryShark creation encounter the same model-to-column mismatch; changing the factory adapter does not fix its owner.

For an existing `datetime` column whose values represent **UTC**, configure a model-local datatype through Sequelize's documented [custom datatype extension API](https://sequelize.org/docs/v7/other-topics/extending-data-types/). This example accepts JavaScript `Date` values and serializes their UTC components as an offset-free ISO timestamp:

```typescript
import { DataTypes } from "@sequelize/core"

export class UtcSqlServerDateTime extends DataTypes.DATE {
  toSql(): string {
    return "DATETIME"
  }

  toBindableValue(value: Date): string {
    // datetime has no offset; the column's application contract is UTC.
    return value.toISOString().slice(0, -1)
  }
}
```

Import that application-owned class in the model and use it for the affected attributes instead of `DataTypes.DATE`. Keep the existing model attribute names and database column mappings; for example, include this attribute in the definitions passed to `Model.init`:

```typescript
const sourceAttributes = {
  occurredAt: {
    type: UtcSqlServerDateTime,
    columnName: "OccurredAt",
    allowNull: false,
  },
}
```

For decorator-based models, use the same options in `@Attribute({ type: UtcSqlServerDateTime, columnName: "OccurredAt", allowNull: false })` and retain `declare occurredAt: Date`. Nullable columns keep `allowNull: true` and `Date | null`. The matching MSSQL dialect uses Tedious's default UTC interpretation when reading dates; `useUTC` is not an accepted Sequelize connection option in this release. This datatype intentionally uses UTC rather than the process timezone or Sequelize's formatting timezone; do not use it for a source whose values represent local wall-clock time without first establishing that source's timezone contract.

Factories continue to generate ordinary `Date` attributes and call `.create()` without `.onCreate()`. Sequelize owns column mapping, validation, native save hooks, and persisted model state; FactoryShark retains its association resolution and before/after-create hooks. The datatype is application model configuration, not an export from FactoryShark, a global `DATE` prototype patch, or a replacement persistence writer.

### Migrating Away from a Custom Writer

1. Confirm the existing column really is `datetime` and establish whether its values represent UTC. Apply the custom type only to those attributes; leave `datetimeoffset` attributes on `DataTypes.DATE`.
2. In an isolated copy of the schema, compare a native Sequelize save and an ordinary factory create using explicit `Date` fixtures. Read both records back from SQL Server, including nullable fields, and exercise the factory's hooks and associations.
3. Remove the factory's `.onCreate()` writer and its manual attribute-to-column mapping only after those checks pass. Retain the model's native `columnName` metadata. Do not call `sync({ alter: true })`, change the external schema, disable validation/hooks, or mark records saved by hand.
4. Preserve SQL Server's actual `datetime` precision: it rounds to increments of approximately 3.33 milliseconds. An input ending in `.120Z` round-trips exactly; `.001Z` rounds to `.000Z`. Arbitrary millisecond precision cannot be recovered without changing the column type. Assert explicit schema-representable values rather than truncating dates or weakening precision assertions.

This configuration path is verified with the published FactoryShark **2.8.0**, Sequelize core/MSSQL **7.0.0-alpha.48**, Tedious **19.2.2**, and SQL Server **2019 CU28 (15.0.4385.2)**. It does not qualify every SQL Server type, Sequelize 6 custom datatype API, or future v7 alpha. The ordinary package smoke uses SQLite and does not establish MSSQL coverage.

Sequelize's [existing datatype discussion](https://github.com/sequelize/sequelize/issues/7930#issuecomment-1398223270) distinguishes this legacy-column case from its supported `datetimeoffset` mapping. A built-in legacy datatype would be an upstream capability; no FactoryShark runtime workaround is required for the model-local path above.
