# Factory Evaluation

FactoryShark creates Sequelize test models and their declared `belongsTo` dependencies. A factory definition supplies a model class and an attribute generator. The application owns model initialization, schema setup, database isolation, and cleanup.

## Responsibilities

- [FactoryShark](/src/factory-shark.ts) provides one consumer-facing API for supported Sequelize models, with native assumptions isolated in the [compatibility layer](/src/compatibility/sequelize).
- [FactoryBuilder](/src/factory-builder.ts) owns configuration, sequences, and the build/create lifecycle.
- [AttributeBuilder](/src/attribute-builder.ts) evaluates the generator once per operation and merges its attributes with resolved parameters.
- [FactoryContext](/src/factory-context.ts) records association factories, foreign-key names, and lazy override callbacks during generation.
- [AssociationManager](/src/association-manager.ts) resolves association overrides, creates dependencies, and attaches associated models.

The generator can register hooks and associations conditionally using `params` and `transient`. Transient parameters affect generation and hooks, not database columns.

Sequelize-specific model access belongs to the [compatibility layer](/docs/architecture/sequelize-compatibility.md). The integration supplies the host's model and creation-attribute types and translates runtime operations; evaluation and association ordering remain shared.

## Build and Create

`build()` generates attributes, calls Sequelize's model builder, and attaches association instances without database reads, writes, or create hooks. For registered relationships, a supplied model from `.associations()`, `.params()`, or call-time parameters is reused by identity, including its nested in-memory relationships. Its known `id` fills a missing foreign key; an id-less model remains unsaved with no fabricated identity. A non-null explicit foreign key takes precedence and produces an `id` placeholder instead, without mutating the supplied model. An explicit null foreign key remains null while the supplied model is attached.

`attributesFor(params?)` returns the raw attribute object from one `build(params)` evaluation, typed with the model's creation-attribute shape. It preserves Date values and Buffer bytes without serialization or custom-getter evaluation. It performs no reads, writes, or create hooks. Explicit foreign keys and keys inferred from supplied models remain attributes; association model properties and `id` placeholders are not copied into the result. A supplied model's known ID does not imply that it exists in the database. This is not a recursive JSON payload serializer; consumers choose the fields accepted by their API.

`create()` evaluates the generator, resolves associations in registration order, builds the parent with resolved attributes, and attaches associations. It then awaits before-create hooks, saves the parent, and awaits after-create hooks. Chained hooks precede generator-registered hooks of the same kind. After-create changes need an explicit save when they must persist.

`createList(count, params?)` returns `Promise<T[]>` on the original factory and configured builders. Supply a nonnegative integer count. It awaits `create(params)` on the same builder for each item, preserving configuration, override precedence, hooks, result order, and sequence progression across the list and later calls. Zero returns an empty array without evaluating generators, running hooks, or writing records. The first error rejects the list and prevents later items from starting; earlier persisted records remain. List creation adds no transaction or bulk-insert semantics.

Associations without overrides recursively use their own factories. Register an association before another association whose lazy override needs its foreign key. Override callbacks are evaluated while building the initial associated instance and again with the resolved parent parameters during creation; they must tolerate the earlier unresolved state.

## Overrides and State

Attribute precedence, from lowest to highest, is generated attributes, `.associations()` defaults, `.params()` defaults, then call-time parameters. Repeated `.params()` and `.transient()` calls merge their defaults; repeated `.associations()` calls replace the association defaults.

During creation, a foreign-key override takes precedence over a supplied association instance. FactoryShark loads the referenced record rather than creating another one. Without a foreign-key override, a supplied persisted model provides its ID; otherwise the associated factory creates the record and its ID fills the parent's foreign key.

Configuration methods create independent builders. Each builder starts its own sequence at 1 and advances it once per build, attributesFor, or create evaluation. Each associated factory has its own sequence. A generator runs once per evaluation even when both hook registration and attribute merging need its output.

## Persistence Boundaries

The supported model contract uses `id` primary keys and `belongsTo` associations. Other association types and custom primary-key names are not supported. The package does not create a transaction around an entire association graph. A failed hook or later association can leave earlier records persisted; consumers must isolate and clean test data.

The [behavioral scenarios](/tests/factory.test.ts) cover these observable boundaries. The [consumer verification guide](/docs/qa-scenarios/package-consumer.md) explains the separate installed-artifact coverage.
