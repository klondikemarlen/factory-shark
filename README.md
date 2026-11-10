# FactoryShark (🏭🦈)

FactoryShark provides TypeScript factories for Sequelize models. Define reusable attributes, build unsaved model instances, create persisted records, and declare `belongsTo` associations that can be generated and saved with their parent. Its API is inspired by [Fishery](https://github.com/thoughtbot/fishery), and its nested-association use case takes inspiration from Rails' [factory_bot](https://github.com/thoughtbot/factory_bot).

FactoryShark grew out of using Fishery for Sequelize tests. We wanted better handling for nested associations, like factory_bot provides for Rails, so we rebuilt the factory implementation from the ground up while deliberately keeping Fishery's interface familiar wherever possible.

## Install and Compatibility

Install FactoryShark as a development dependency for test factories:

```sh
npm install --save-dev factory-shark@2.2.2
```

If you use it outside tests, install it as a runtime dependency instead. `create()` and `createList()` write real database records, so use isolated test persistence and never point test factories at production data.

FactoryShark supports Node.js 22 and 24. Native ESM and CommonJS bundles include matching TypeScript declarations. Use TypeScript's Node16 or NodeNext module resolution; default and named `FactoryShark` imports are supported, as is `require("factory-shark").FactoryShark`. Your application supplies Sequelize and a matching dialect.

### Supported Sequelize Versions

| Sequelize API          | Verified release |
| ---------------------- | ---------------- |
| v6 (`sequelize`)       | `6.37.8`         |
| v7 (`@sequelize/core`) | `7.0.0-alpha.48` |

Import `FactoryShark` and its factory types from `factory-shark` for either ORM. The supplied model selects its Sequelize integration. Your application does not need the other ORM package installed. Supported models use `id` primary keys and `belongsTo` associations; custom primary-key names and other association types are not supported.

See [Sequelize compatibility](https://github.com/klondikemarlen/factory-shark/blob/v2.2.2/docs/architecture/sequelize-compatibility.md) for supported ranges and how new versions are qualified. See the [changelog](https://github.com/klondikemarlen/factory-shark/blob/v2.2.2/CHANGELOG.md) for release history.

## Factory Authoring Templates

Use the [canonical factory-authoring guide for 2.2.2](https://github.com/klondikemarlen/factory-shark/blob/v2.2.2/docs/templates/factory-authoring.md). It owns the reusable examples previously embedded in this README:

- Basic definitions and attribute generators.
- Parent associations, overrides, and the difference between `build` and `create`.
- Custom builders and opt-in traits.
- Before/after-create hooks and their persistence responsibilities.
- `createList` on original and configured factories, plus unsaved `attributesFor` payloads.

The guide's examples are compiled and run against the package by the existing consumer smoke check. Models, import paths, export conventions, and application-specific traits remain your project's choices; keep those in a small local overlay rather than copying the library's lifecycle guidance.

### Match Your Installed Release

From your consuming project, inspect the installed version:

```sh
node -p 'require("factory-shark/package.json").version'
```

Use that version's README and guide under the matching Git tag: `https://github.com/klondikemarlen/factory-shark/blob/v<VERSION>/README.md`. For releases before 2.2.1, the examples remain in that version's README. Do not use moving `main` documentation to infer APIs available in an older installation. The guide is hosted at the release tag, not shipped as an npm subpath; no generator CLI is required.

## Persistence Boundaries

`build()` returns an unsaved model; `attributesFor()` returns its raw attributes. Neither runs create hooks or persists associations. Use explicit foreign keys for request payloads; attribute extraction is not recursive JSON serialization.

`create()` saves registered associations and the parent, with awaited before/after-create hooks. `createList()` repeats that lifecycle sequentially on the same builder. No transaction wraps the complete graph or list: if a later operation fails, earlier writes remain. The [authoring guide](https://github.com/klondikemarlen/factory-shark/blob/v2.2.2/docs/templates/factory-authoring.md) explains override precedence, sequence ownership, hook ordering, and error handling.

## Public Entry Points

Import from `factory-shark`; internal deep imports are not exported. The default TypeScript export is `FactoryShark`. Named runtime exports are `FactoryShark`, `FactoryContext`, `AssociationManager`, `AttributeBuilder`, `CreateStrategy`, `AssociationNotFoundError`, `ForeignKeyNotFoundError`, `isModel`, and `PRIMARY_KEY`. Root type exports are `BeforeCreateFn`, `FactoryInterface`, `FactoryParams`, and `GeneratorFn`. The helper classes are available for advanced use; most consumers need only `FactoryShark` and the factory types. `factory-shark/package.json` exposes package metadata.

## Contribute

See [CONTRIBUTING.md](https://github.com/klondikemarlen/factory-shark/blob/v2.2.1/CONTRIBUTING.md) for development setup and checks. For maintainers and readers interested in the project's design, see the [project knowledge base](https://github.com/klondikemarlen/factory-shark/blob/v2.2.1/docs/README.md).

## Name

If a robotic shark produced by FactoryBot came and gobbled up the Fishery library, it would become FactoryShark.

## License

FactoryShark is licensed under the [MIT License](LICENSE).
