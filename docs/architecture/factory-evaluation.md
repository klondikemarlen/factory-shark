# Factory Evaluation

FactoryShark creates Sequelize test models, their declared `belongsTo` dependencies, and supplied `hasMany` children. A factory definition supplies a model class and an attribute generator. The application owns model initialization, schema setup, database isolation, and cleanup.

## Responsibilities

- [FactoryShark](/src/factory-shark.ts) provides one consumer-facing API for supported Sequelize models, with native assumptions isolated in the [compatibility layer](/src/compatibility/sequelize).
- [FactoryBuilder](/src/factory-builder.ts) owns configuration, sequences, and the build/create lifecycle.
- [AttributeBuilder](/src/attribute-builder.ts) evaluates the generator once per operation and merges its attributes with resolved parameters.
- [FactoryContext](/src/factory-context.ts) records association factories, foreign-key names, and lazy override callbacks during generation.
- [AssociationManager](/src/association-manager.ts) resolves association overrides, creates dependencies, and attaches associated models.
- [Public helper adapters](/src/compatibility/sequelize/public-helpers.ts) supply Sequelize-facing constructors and types for the root-exported helpers; the core classes above retain evaluation and association behavior.

The generator can register hooks and associations conditionally using `params` and `transient`. Transient parameters affect generation and hooks, not database columns.

Sequelize-specific model access belongs to the [compatibility layer](/docs/architecture/sequelize-compatibility.md). The integration supplies the host's model and creation-attribute types and translates runtime operations; evaluation and association ordering remain shared.

## Build and Create

`build()` generates attributes, calls Sequelize's model builder, and attaches association instances without database reads, writes, or create hooks. For registered relationships, a supplied model from `.associations()`, `.params()`, or call-time parameters is reused by identity, including its nested in-memory relationships. Its known `id` fills a missing foreign key; an id-less model remains unsaved with no fabricated identity. A non-null explicit foreign key takes precedence and produces an `id` placeholder instead, without mutating the supplied model. An explicit null foreign key remains null while the supplied model is attached.

`attributesFor(params?)` returns the raw attribute object from one `build(params)` evaluation, typed with the model's creation-attribute shape. It preserves Date values and Buffer bytes without serialization or custom-getter evaluation. It performs no reads, writes, or create hooks. Explicit foreign keys and keys inferred from supplied models remain attributes; association model properties and `id` placeholders are not copied into the result. A supplied model's known ID does not imply that it exists in the database. This is not a recursive JSON payload serializer; consumers choose the fields accepted by their API.

`buildList(count, params?)` returns `T[]` synchronously on original and configured factories. Supply a nonnegative integer count. Each item uses `build(params)` on the same builder, preserving configuration, supplied association identity, override precedence, and sequence progression across the list and later calls. Zero returns an empty array without evaluating the generator. The first error throws immediately and prevents later items from starting. Like `build`, it performs no database access or create hooks and ignores eager-loading configuration.

`create()` evaluates the generator, resolves associations in registration order, builds the parent with resolved attributes, and attaches associations. It then awaits before-create hooks, saves the parent, persists supplied children, reloads requested includes, and awaits after-create hooks. Chained hooks precede generator-registered hooks of the same kind. After-create changes need an explicit save when they must persist.

`createList(count, params?)` returns `Promise<T[]>` on the original factory and configured builders. Supply a nonnegative integer count. It awaits `create(params)` on the same builder for each item, preserving configuration, override precedence, hooks, result order, and sequence progression across the list and later calls. Zero returns an empty array without evaluating generators, running hooks, or writing records. The first error rejects the list and prevents later items from starting; earlier persisted records remain. List creation adds no transaction or bulk-insert semantics.

`createMany(paramsList)` returns `Promise<T[]>` on original and configured factories when each record needs distinct literal attributes; use `createList(count, params?)` when all records share the same call-time overrides. It accepts a readonly array of model-specific parameter objects without mutating the array or its objects. Each item awaits `create(params)` on the same builder in input order, retaining association and parameter precedence, transient settings, includes, hooks, and the shared sequence used by later calls. Each complete lifecycle finishes before the next starts. An empty array returns an empty result without generator evaluations, hooks, or database work. The first failure rejects the operation and prevents later items from starting; earlier writes, and any writes from the failing item's lifecycle, remain. This is sequential creation, not concurrent creation, bulk insertion, or an implicit transaction.

`.include(selection)` configures eager loading independently from attributes and transient parameters. The compatibility adapter performs native `reload({ include: selection })` after save and before after-create hooks, so hooks see loaded relationships without losing their later in-memory changes. Loading selects existing rows rather than constructing a nested association graph. Rows created by later hooks need an explicit reload. No selection, `undefined`, or an empty array means no additional reload; synchronous `build` and `attributesFor` ignore this configuration.

Associations without overrides recursively use their own factories. Register an association before another association whose lazy override needs its foreign key. Override callbacks are evaluated while building the initial associated instance and again with the resolved parent parameters during creation; they must tolerate the earlier unresolved state.

## Supplied Child Collections

Supply declared `hasMany` collections through `.associations()`, `.params()`, or call-time parameters. These reuse the supplied model instances rather than generating replacement children. Builds attach the collection without saving children or changing their foreign keys; attribute extraction excludes the collection.

Creation saves the parent first, then each supplied child, before include loading or parent after-create hooks. Unsaved children receive the parent's actual `id`, replacing any stale parent foreign key or attached parent placeholder. Other attached `belongsTo` dependencies are saved when their foreign keys are missing; explicit foreign keys remain authoritative. Child attributes are preserved. Saving these already-built instances runs native model save hooks, not their original factory generators or factory create hooks.

Empty collections perform no child writes. An already-persisted child is reused only when its foreign key already matches this parent; reparenting is rejected. Reusing one collection across `createList` therefore does not clone its children for each parent. A child failure rejects creation and skips parent after-create hooks, but does not roll back the saved parent, dependencies, or earlier children.

## Overrides and State

Attribute precedence, from lowest to highest, is generated attributes, `.associations()` defaults, `.params()` defaults, then call-time parameters. Repeated `.params()` and `.transient()` calls merge their defaults; repeated `.associations()` and `.include()` calls replace their respective configuration. `.include(undefined)` or `.include([])` clears loading on the new builder, not its source. Selection objects should not be mutated after configuration.

During creation, a foreign-key override takes precedence over a supplied association instance. FactoryShark loads the referenced record rather than creating another one. Without a foreign-key override, a supplied persisted model provides its ID; otherwise the associated factory creates the record and its ID fills the parent's foreign key.

Configuration methods create independent builders. Each builder starts its own sequence at 1 and advances it once per build, attributesFor, or create evaluation. Each associated factory has its own sequence. A generator runs once per evaluation even when both hook registration and attribute merging need its output.

## Persistence Boundaries

Factory-generated dependencies use `id` primary keys and `belongsTo` associations. Supplied `hasMany` collections are also supported; `hasOne`, through associations, and custom primary-key names are not supported for construction. Eager loading is separate: Sequelize resolves requested existing relationships. The package does not create a transaction around an entire association graph. A failed hook, later association, child save, or include reload can leave earlier records persisted; consumers must isolate and clean test data. Failures propagate to the caller and skip subsequent lifecycle steps.

The [behavioral scenarios](/tests/factory.test.ts) cover these observable boundaries. The [consumer verification guide](/docs/qa-scenarios/package-consumer.md) explains the separate installed-artifact coverage.
