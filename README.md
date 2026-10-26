# FactoryShark

TypeScript test factories for Sequelize with declarative `belongsTo` associations. Inspired by [factory_bot](https://github.com/thoughtbot/factory_bot) and [Fishery](https://github.com/thoughtbot/fishery). The current implementation does not depend on or wrap Fishery; see [Name and History](#name-and-history) for its Fishery-based origins.

## Install and Compatibility

For application tests, install FactoryShark as a development dependency:

```sh
npm install --save-dev factory-shark@1.0.0
```

If application code calls FactoryShark outside tests, install it as a runtime dependency with `npm install factory-shark@1.0.0` instead. `create()` writes real records; keep fixture persistence isolated from production data. Your application must use `@sequelize/core@7.0.0-alpha.48` and a matching Sequelize dialect.

The supported runtime is Node.js 22 or 24, with **exactly Sequelize 7.0.0-alpha.48**. Sequelize 6 and other alpha revisions are not supported. The artifact is CommonJS with TypeScript declarations; use TypeScript's Node16 module resolution and `esModuleInterop`, or CommonJS `require("factory-shark").FactoryShark`. There is no separate native ESM build. The standalone API retains the original WRAP behavior, including its `id` primary-key convention; custom primary-key names and non-`belongsTo` associations are outside the supported contract.

Version 1 preserves the runtime behavior and public API of 0.1.0, including factory subclasses. When replacing WRAP's embedded copy, change library imports to the `factory-shark` package root, including the former `/factory-shark` and `/types` deep imports. Application-owned factory definitions and support helpers remain in the consuming project. The consumer smoke verifies TypeScript 5.4.5 with ES2020 and Node16 module resolution, as used by WRAP.

## Define Factories Alongside Your Tests

Use your application's existing Sequelize models and shared test setup. Model registration, migrations, and database cleanup belong in that setup—not in each factory or test.

These examples follow [WRAP's factory modules](https://github.com/icefoganalytics/wrap/tree/24ce6097a1f2c4d87a09dddcec88e33b8859782b/api/tests/factories): Faker-generated attributes, default-exported factories, lazy association overrides, transient parameters, and opt-in relationship helpers. Application imports use WRAP's root aliases, including `@/models` and `@/factories`, even for sibling modules and type-only imports. Configure those aliases in both your TypeScript compiler and test runner; they belong to the consuming application, not this package.

The examples assume your application already has the referenced models and supporting organization, category, workflow-player, and workflow-access factories. Faker and Vitest are development dependencies of the consuming application, not FactoryShark runtime dependencies. The package smoke supplies small SQLite models and supporting factories, then compiles and runs the code below unchanged against the installed tarball.

### `factories/user-factory.ts`

Transient roles are opt-in test data. The after-create hook persists them after the user has an ID, then reloads the association for callers that need it.

```typescript
import { faker } from "@faker-js/faker"
import FactoryShark from "factory-shark"

import { Role, User } from "@/models"
import type { RoleTypes } from "@/models/role"

type UserTransientParams = {
  roles?: RoleTypes[]
}

export const userFactory = FactoryShark.define<User, UserTransientParams>(
  User,
  ({ sequence, afterCreate, transient }) => {
    afterCreate(async (user) => {
      if (transient.roles) {
        const rolesAttributes = transient.roles.map((role) => ({
          userId: user.id,
          role,
        }))

        await Role.bulkCreate(rolesAttributes)
        await user.reload({
          include: ["roles"],
        })
      }
    })

    const firstName = `${faker.person.firstName()}-${sequence}`
    const lastName = faker.person.lastName()
    const email = faker.internet.email({
      firstName,
      lastName,
    })

    return {
      authSubject: email,
      email,
      firstName,
      lastName,
    }
  }
)

export default userFactory
```

### `factories/workflow-factory.ts`

The category's lazy override receives the organization's resolved foreign key. The `accessibleBy` helper adds its related records only when a test explicitly asks for them.

```typescript
import { faker } from "@faker-js/faker"
import FactoryShark from "factory-shark"
import type { FactoryInterface, GeneratorFn } from "factory-shark"

import { User, Workflow } from "@/models"

import organizationFactory from "@/factories/organization-factory"
import userFactory from "@/factories/user-factory"
import workflowAccessByUserFactory from "@/factories/workflow-access-by-user-factory"
import workflowCategoryFactory from "@/factories/workflow-category-factory"
import workflowPlayerFactory from "@/factories/workflow-player-factory"

class WorkflowFactory extends FactoryShark<Workflow> {
  constructor(generator: GeneratorFn<Workflow>) {
    super(Workflow, generator, {})
  }

  accessibleBy(user: User): FactoryInterface<Workflow> {
    return this.afterCreate(async (workflow) => {
      const workflowPlayer = await workflowPlayerFactory.create({
        workflowId: workflow.id,
        userId: user.id,
      })

      await workflowAccessByUserFactory.create({
        workflowId: workflow.id,
        userId: user.id,
        workflowPlayerId: workflowPlayer.id,
      })
    })
  }
}

export const workflowFactory = new WorkflowFactory(({ sequence, associate }) => {
  associate("organization", organizationFactory)

  associate("category", workflowCategoryFactory, ({ organizationId }) => ({
    organizationId,
  }))

  associate("creator", userFactory)

  return {
    status: Workflow.Statuses.OPEN,
    title: `${faker.location.country()}-${sequence}`,
  }
})

export default workflowFactory
```

## Use Factories in Focused Tests

As in WRAP, these Vitest examples use global `describe`, `test`, and `expect`, initialized application models, and shared database cleanup between tests. Each test owns its scenario data and one primary expectation. Testing a returned model's state is separate from testing persisted records.

### `workflow-factory.test.ts`

```typescript
import { Workflow, WorkflowAccessByUser } from "@/models"

import organizationFactory from "@/factories/organization-factory"
import userFactory from "@/factories/user-factory"

import workflowFactory from "@/factories/workflow-factory"

describe("factories/workflow-factory.ts", () => {
  describe("WorkflowFactory", () => {
    describe("#build", () => {
      test("when built without saving, returns an unsaved workflow", () => {
        // Arrange
        const workflowAttributes = {
          title: "Draft review",
        }

        // Act
        const workflow = workflowFactory.build(workflowAttributes)

        // Assert
        expect(workflow.isNewRecord).toBe(true)
      })
    })

    describe("#create", () => {
      test("when provided attributes, persists the workflow", async () => {
        // Arrange
        const workflowAttributes = {
          title: "Budget review",
        }

        // Act
        await workflowFactory.create(workflowAttributes)

        // Assert
        const workflows = await Workflow.findAll()
        expect(workflows).toEqual([
          expect.objectContaining({
            title: "Budget review",
          }),
        ])
      })

      test("when creating its category, reuses the workflow organization", async () => {
        // Arrange
        const organization = await organizationFactory.create()

        // Act
        const workflow = await workflowFactory.create({
          organizationId: organization.id,
        })

        // Assert
        expect(workflow.category?.organizationId).toBe(organization.id)
      })
    })

    describe("#accessibleBy", () => {
      test("when access is requested, creates access for the supplied user", async () => {
        // Arrange
        const user1 = await userFactory.create()
        const accessibleWorkflowFactory = workflowFactory.accessibleBy(user1)

        // Act
        const workflow = await accessibleWorkflowFactory.create()

        // Assert
        const workflowAccessByUsers = await WorkflowAccessByUser.findAll()
        expect(workflowAccessByUsers).toEqual([
          expect.objectContaining({
            workflowId: workflow.id,
            userId: user1.id,
          }),
        ])
      })
    })
  })
})
```

### `user-factory.test.ts`

```typescript
import { Role } from "@/models"
import { RoleTypes } from "@/models/role"

import userFactory from "@/factories/user-factory"

describe("factories/user-factory.ts", () => {
  describe("userFactory", () => {
    describe("#transient", () => {
      test("when roles are requested, persists the requested user role", async () => {
        // Arrange
        const administratorFactory = userFactory.transient({
          roles: [RoleTypes.SYSTEM_ADMIN],
        })

        // Act
        const user = await administratorFactory.create()

        // Assert
        const roles = await Role.findAll()
        expect(roles).toEqual([
          expect.objectContaining({
            userId: user.id,
            role: RoleTypes.SYSTEM_ADMIN,
          }),
        ])
      })
    })
  })
})
```

## Associations and Overrides

Register associations with `associate("organization", organizationFactory)` inside the generator. Registration returns a built associated instance; `create()` later persists associations in registration order. An override callback, such as `associate("category", categoryFactory, ({ organizationId }) => ({ organizationId }))`, receives resolved parent parameters at creation time and can reuse a previously resolved foreign key. Register the dependency first. Conditional `associate()` calls are supported: read `params` or `transient` in the generator and register only the relationships needed for that evaluation.

Use call-time `{ organizationId: existing.id }`, `{ organization: existing }`, or `.associations({ organization: existing })` to reuse an existing parent during `create()`. Use persisted instances for these overrides. A foreign-key override takes precedence over a competing association instance; `create()` loads that existing association, while `build()` attaches an `{ id }` placeholder. Without an FK override, `build()` attaches newly generated unsaved association instances and never writes to the database; it does not reuse a supplied association instance. This build-mode limitation is retained from the extracted implementation.

Parameter precedence, from low to high, is generator attributes, `.associations()` defaults, `.params()` defaults, and call-time parameters. Repeated `.params()` calls merge; repeated `.associations()` calls replace their defaults. `.transient()` merges generator-only parameters, not database columns. Configuration methods return independent builders and do not mutate the original factory. Each new builder starts its own sequence at 1; a builder advances its sequence on each build/create evaluation. A generator runs once per evaluation. Associated factories have their own evaluations and sequences.

## Hooks and Errors

Register `beforeCreate` and `afterCreate` in the generator, or chain `.beforeCreate()` / `.afterCreate()` on the factory. Chained hooks run before generator-registered hooks of the same kind. Hooks run sequentially and are awaited. Before-create hooks see resolved association foreign keys before the parent is saved; after-create hooks see the persisted parent. Neither runs for `build()`. An after-create mutation needs an explicit save if it must persist.

Invalid association registrations raise `AssociationNotFoundError` or `ForeignKeyNotFoundError`. Invalid instance overrides and database validation/constraint failures propagate. FactoryShark does not open a graph-wide transaction: a failure may leave already-created associated records or a saved parent after an after-create failure. Use disposable test persistence and clean it between scenarios.

## Public Entry Points

Import from `factory-shark` only; internal deep imports are not exported. The default TypeScript export is `FactoryShark`. Named runtime exports retained from WRAP are `FactoryShark`, `FactoryContext`, `AssociationManager`, `AttributeBuilder`, `CreateStrategy`, `AssociationNotFoundError`, `ForeignKeyNotFoundError`, `isModel`, and `PRIMARY_KEY`. Root type exports are `BeforeCreateFn`, `FactoryInterface`, `FactoryParams`, and `GeneratorFn`. The helper classes remain available for existing consumers; normal usage needs only `FactoryShark` and the factory types. `factory-shark/package.json` exposes package metadata.

## Contribute and Release

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, isolated tests, and release commands. `npm run check` type-checks the library/tests, runs real SQLite scenarios, then packs and installs the artifact into a temporary external consumer. It compiles every TypeScript example above and executes the documented Vitest tests against isolated SQLite models. CI runs this command on Node 22 and 24.

## Name and History

The project began inside WRAP as **fishery-bot**, a companion library that saved Sequelize association trees from Fishery's `onCreate` hook. Its [original README](https://github.com/icefoganalytics/wrap/blob/8f1285b58f55985325d9954eab1dc98fb08ced69/api/src/lib/fishery-bot/README.md) explains the name: **“Fishery + Factory Bot = Fishery Bot.”** [WRAP's workflow factory at that revision](https://github.com/icefoganalytics/wrap/blob/8f1285b58f55985325d9954eab1dc98fb08ced69/api/tests/factories/workflow-factory.ts) imports `Factory` from `fishery` and calls the persistence helper in `onCreate`.

WRAP later [introduced its own `FisheryBotFactory`](https://github.com/icefoganalytics/wrap/commit/1e01afedebf9b81330bc5a9f31349c058fe8a758). The [rename to `factory-shark`](https://github.com/icefoganalytics/wrap/commit/29e96c92aff67ca033e2430abcecddcab941a061) gives the reason: **“Easier to spell and pronounce.”** The [renamed README](https://github.com/icefoganalytics/wrap/blob/29e96c92aff67ca033e2430abcecddcab941a061/api/src/lib/factory-shark/README.md) preserves the wordplay as **“Fishery + FactoryBot = FactoryShark”** and still describes it as “built on top of” Fishery. That historical description is not the dependency relationship of the current standalone package, which uses its own factory implementation.

## License and Provenance

New original infrastructure and documentation prose are [MIT licensed](LICENSE). The implementation extracted from [WRAP at 24ce6097a1f2c4d87a09dddcec88e33b8859782b](https://github.com/icefoganalytics/wrap/tree/24ce6097a1f2c4d87a09dddcec88e33b8859782b/api/src/lib/factory-shark), adapted factory examples, and behavioral coverage retain [Apache-2.0 terms](LICENSE-APACHE). See [NOTICE](NOTICE) for provenance and the upstream metadata conflict. Both licenses and attribution are included in the tarball; the extracted material is not relicensed MIT-only.
