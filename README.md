# FactoryShark

TypeScript test factories for Sequelize with declarative `belongsTo` associations. Inspired by [factory_bot](https://github.com/thoughtbot/factory_bot) and [Fishery](https://github.com/thoughtbot/fishery), but implemented independently: Fishery is neither a dependency nor a wrapper beneath this library.

## Install and Compatibility

The package is prepared for npm publication but has not yet been published. Until publication, run `npm ci && npm pack` in a clone and install the resulting `factory-shark-0.1.0.tgz` in your application alongside `@sequelize/core@7.0.0-alpha.48` and your matching Sequelize dialect.

The supported runtime is Node.js 22 or 24, with **exactly Sequelize 7.0.0-alpha.48**. Sequelize 6 and other alpha revisions are not supported. The artifact is CommonJS with TypeScript declarations; use TypeScript's Node16 module resolution and `esModuleInterop`, or CommonJS `require("factory-shark").FactoryShark`. There is no separate native ESM build. The standalone API retains the original WRAP behavior, including its `id` primary-key convention; custom primary-key names and non-`belongsTo` associations are outside the supported contract.

The intended registry name is the unscoped `factory-shark`: the registry returned 404 during extraction. This is an availability observation, not a reservation or proof of publishing rights. No npm organization scope is assumed; the maintainer must authenticate and recheck name availability before the first publish.

## Define, Build, and Create

This complete example uses SQLite only to make the persistence boundary runnable. Applications can use their own supported Sequelize dialect. Install the matching SQLite dialect and driver in the consumer to run it: `npm install @sequelize/sqlite3@7.0.0-alpha.48 sqlite3`.

```typescript
import assert from "node:assert/strict"
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from "@sequelize/core"
import { SqliteDialect } from "@sequelize/sqlite3"
import { FactoryShark, type FactoryParams } from "factory-shark"

class Organization extends Model<InferAttributes<Organization>, InferCreationAttributes<Organization>> {
  declare id: CreationOptional<number>
  declare name: string
}

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>
  declare name: string
  declare organizationId: number
  declare organization?: NonAttribute<Organization>
}

async function main() {
  const sequelize = new Sequelize({
    dialect: SqliteDialect,
    storage: ":memory:",
    logging: false,
    pool: { max: 1, idle: Infinity, maxUses: Infinity },
  })

  try {
    Organization.init({
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
    }, { sequelize, timestamps: false })
    User.init({
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      organizationId: { type: DataTypes.INTEGER, allowNull: false },
    }, { sequelize, timestamps: false })
    User.belongsTo(Organization, { as: "organization", foreignKey: "organizationId" })
    await sequelize.sync({ force: true })

    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
      name: `Organization ${sequence}`,
    }))
    const userFactory = FactoryShark.define<User, { prefix?: string }>(
      User,
      ({ sequence, associate, transient, beforeCreate, afterCreate }) => {
        associate("organization", organizationFactory)
        beforeCreate((user) => {
          assert.ok(user.organizationId)
          assert.equal(user.isNewRecord, true)
        })
        afterCreate(async (user) => {
          assert.equal(user.isNewRecord, false)
        })
        return { name: `${transient.prefix ?? "User"} ${sequence}` }
      }
    )

    // build is synchronous: both model and associated model stay unsaved.
    const built = userFactory.build()
    assert.equal(built.isNewRecord, true)
    assert.equal(built.organization?.isNewRecord, true)
    assert.equal(await User.count(), 0)
    assert.equal(await Organization.count(), 0)

    // create persists the association, resolves its FK, runs hooks, and saves.
    const saved = await userFactory.transient({ prefix: "Member" }).create()
    assert.equal(saved.name, "Member 1")
    const reloaded = await User.findByPk(saved.id, { include: ["organization"] })
    assert.equal(reloaded?.organization?.name, saved.organization?.name)
    assert.equal(await Organization.count(), 1)

    // Existing FK or persisted instance overrides do not create extra parents.
    const overrides: FactoryParams<User> = { organizationId: saved.organizationId }
    await userFactory.create(overrides)
    await userFactory.associations({ organization: saved.organization! }).create()
    assert.equal(await Organization.count(), 1)

    // Call-time parameters override chained defaults and generator attributes.
    const named = userFactory.params({ name: "Default" }).build({ name: "Override" })
    assert.equal(named.name, "Override")
    console.log("Packed consumer PASS: typed build, persisted association, overrides, transient, hooks")
  } finally {
    await sequelize.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
```

## Associations and Overrides

Register associations with `associate("organization", organizationFactory)` inside the generator. Registration returns a built associated instance; `create()` later persists associations in registration order. An override callback, such as `associate("category", categoryFactory, ({ organizationId }) => ({ organizationId }))`, receives resolved parent parameters at creation time and can reuse a previously resolved foreign key. Register the dependency first. Conditional `associate()` calls are supported: read `params` or `transient` in the generator and register only the relationships needed for that evaluation.

Use call-time `{ organizationId: existing.id }`, `{ organization: existing }`, or `.associations({ organization: existing })` to reuse an existing parent. Use persisted instances for `create()` overrides. A foreign-key override takes precedence over a competing association instance; `create()` loads that existing association, while `build()` attaches an `{ id }` placeholder. Without an FK override, `build()` attaches unsaved association instances and never writes to the database. An instance supplied to `build()` remains unsaved as supplied.

Parameter precedence, from low to high, is generator attributes, `.associations()` defaults, `.params()` defaults, and call-time parameters. Repeated `.params()` calls merge; repeated `.associations()` calls replace their defaults. `.transient()` merges generator-only parameters, not database columns. Configuration methods return independent builders and do not mutate the original factory. Each new builder starts its own sequence at 1; a builder advances its sequence on each build/create evaluation. A generator runs once per evaluation. Associated factories have their own evaluations and sequences.

## Hooks and Errors

Register `beforeCreate` and `afterCreate` in the generator, or chain `.beforeCreate()` / `.afterCreate()` on the factory. Chained hooks run before generator-registered hooks of the same kind. Hooks run sequentially and are awaited. Before-create hooks see resolved association foreign keys before the parent is saved; after-create hooks see the persisted parent. Neither runs for `build()`. An after-create mutation needs an explicit save if it must persist.

Invalid association registrations raise `AssociationNotFoundError` or `ForeignKeyNotFoundError`. Invalid instance overrides and database validation/constraint failures propagate. FactoryShark does not open a graph-wide transaction: a failure may leave already-created associated records or a saved parent after an after-create failure. Use disposable test persistence and clean it between scenarios.

## Public Entry Points

Import from `factory-shark` only; internal deep imports are not exported. The default TypeScript export is `FactoryShark`. Named runtime exports retained from WRAP are `FactoryShark`, `FactoryContext`, `AssociationManager`, `AttributeBuilder`, `CreateStrategy`, `AssociationNotFoundError`, `ForeignKeyNotFoundError`, `isModel`, and `PRIMARY_KEY`. Root type exports are `BeforeCreateFn`, `FactoryInterface`, `FactoryParams`, and `GeneratorFn`. The helper classes remain available for existing consumers; normal usage needs only `FactoryShark` and the factory types. `factory-shark/package.json` exposes package metadata.

## Contribute and Release

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, isolated tests, and release commands. `npm run check` type-checks the library/tests, runs real SQLite scenarios, then packs and installs the artifact into a temporary external consumer, compiling and executing the example above. CI runs this command on Node 22 and 24.

## License and Provenance

New original infrastructure and documentation are [MIT licensed](LICENSE). The implementation extracted from [WRAP at 24ce6097a1f2c4d87a09dddcec88e33b8859782b](https://github.com/icefoganalytics/wrap/tree/24ce6097a1f2c4d87a09dddcec88e33b8859782b/api/src/lib/factory-shark) and adapted behavioral coverage retain [Apache-2.0 terms](LICENSE-APACHE). See [NOTICE](NOTICE) for provenance and the upstream metadata conflict. Both licenses and attribution are included in the tarball; the extracted material is not relicensed MIT-only.
