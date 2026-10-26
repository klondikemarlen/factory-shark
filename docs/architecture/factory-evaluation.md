# Factory Evaluation

FactoryShark creates Sequelize test models and their declared `belongsTo` dependencies. A factory definition supplies a model class and an attribute generator. The application owns model initialization, schema setup, database isolation, and cleanup.

## Responsibilities

- The [v7](/src/sequelize-v7.ts) and [v6](/src/sequelize-v6.ts) `FactoryShark` facades provide the consumer-facing API with each integration's model types.
- [FactoryBuilder](/src/factory-builder.ts) owns configuration, sequences, and the build/create lifecycle.
- [AttributeBuilder](/src/attribute-builder.ts) evaluates the generator once per operation and merges its attributes with resolved parameters.
- [FactoryContext](/src/factory-context.ts) records association factories, foreign-key names, and lazy override callbacks during generation.
- [AssociationManager](/src/association-manager.ts) resolves association overrides, creates dependencies, and attaches associated models.

The generator can register hooks and associations conditionally using `params` and `transient`. Transient parameters affect generation and hooks, not database columns.

Sequelize-specific model access belongs to the [compatibility layer](/docs/architecture/sequelize-compatibility.md). The integration supplies the host's model and creation-attribute types and translates runtime operations; evaluation and association ordering remain shared.

## Build and Create

`build()` generates attributes, calls Sequelize's model builder, and attaches unsaved association instances. It performs no persistence and runs no create hooks. A supplied foreign key produces an `id` placeholder for that association. A supplied association instance without a foreign-key override is not reused in build mode.

`create()` evaluates the generator, resolves associations in registration order, builds the parent with resolved attributes, and attaches associations. It then awaits before-create hooks, saves the parent, and awaits after-create hooks. Chained hooks precede generator-registered hooks of the same kind. After-create changes need an explicit save when they must persist.

Associations without overrides recursively use their own factories. Register an association before another association whose lazy override needs its foreign key. Override callbacks are evaluated while building the initial associated instance and again with the resolved parent parameters during creation; they must tolerate the earlier unresolved state.

## Overrides and State

Attribute precedence, from lowest to highest, is generated attributes, `.associations()` defaults, `.params()` defaults, then call-time parameters. Repeated `.params()` and `.transient()` calls merge their defaults; repeated `.associations()` calls replace the association defaults.

During creation, a foreign-key override takes precedence over a supplied association instance. FactoryShark loads the referenced record rather than creating another one. Without a foreign-key override, a supplied persisted model provides its ID; otherwise the associated factory creates the record and its ID fills the parent's foreign key.

Configuration methods create independent builders. Each builder starts its own sequence at 1 and advances it once per build/create evaluation. Each associated factory has its own sequence. A generator runs once per evaluation even when both hook registration and attribute merging need its output.

## Persistence Boundaries

The supported model contract uses `id` primary keys and `belongsTo` associations. Other association types and custom primary-key names are not supported. The package does not create a transaction around an entire association graph. A failed hook or later association can leave earlier records persisted; consumers must isolate and clean test data.

The [behavioral scenarios](/tests/factory.test.ts) cover these observable boundaries. The [consumer verification guide](/docs/qa-scenarios/package-consumer.md) explains the separate installed-artifact coverage.
