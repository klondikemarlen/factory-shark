# FactoryShark (🏭🦈)

FactoryShark provides TypeScript factories for Sequelize models. Define reusable attributes, build unsaved model instances, create persisted records, and declare `belongsTo` associations that can be generated and saved with their parent. Its API is inspired by [Fishery](https://github.com/thoughtbot/fishery), and its nested-association use case takes inspiration from Rails' [factory_bot](https://github.com/thoughtbot/factory_bot).

FactoryShark grew out of using Fishery for Sequelize tests. We wanted better handling for nested associations, like factory_bot provides for Rails, so we rebuilt the factory implementation from the ground up while deliberately keeping Fishery's interface familiar wherever possible.

## Install and Compatibility

Install FactoryShark as a development dependency for test factories:

```sh
npm install --save-dev factory-shark@1.1.0
```

If you use it outside tests, install it as a runtime dependency instead. `create()` writes real database records, so use isolated test persistence and never point test factories at production data.

FactoryShark supports Node.js 22 and 24 and ships CommonJS code with TypeScript declarations. Use TypeScript's Node16 module resolution and `esModuleInterop`, or CommonJS `require("factory-shark").FactoryShark`. Your application supplies Sequelize and a matching dialect.

The supported model convention uses `id` as the primary key. Custom primary-key names and associations other than `belongsTo` are not supported.

### Choose Your Sequelize Integration

| Sequelize API          | Verified release | Import                       |
| ---------------------- | ---------------- | ---------------------------- |
| v6 (`sequelize`)       | `6.37.8`         | `factory-shark/sequelize-v6` |
| v7 (`@sequelize/core`) | `7.0.0-alpha.48` | `factory-shark`              |

Import `FactoryShark` and its factory types from the entry point for your Sequelize version. Sequelize 7 also supports the explicit `factory-shark/sequelize-v7` entry point. The examples below use the Sequelize 7 root entry point. Your application supplies its ORM and matching dialect, and does not need the other ORM package installed.

See [Sequelize compatibility](docs/architecture/sequelize-compatibility.md) for supported ranges and how new versions are qualified. See the [changelog](CHANGELOG.md) for release history.

## Define Factories Alongside Your Tests

Use your application's Sequelize models and shared test setup. Register models, run migrations, and arrange database cleanup there, rather than in each factory or test.

The examples below use Faker-generated attributes, default-exported factories, lazy association overrides, transient parameters, and opt-in relationship helpers. Imports beginning with `@/` are application-root aliases: configure them in both your TypeScript compiler and test runner. Your application supplies the referenced models and supporting organization, category, workflow-player, and workflow-access factories. Faker and Vitest are application development dependencies, not FactoryShark runtime dependencies.

### `factories/user-factory.ts`

Transient roles are optional test data. The after-create hook saves them once the user has an ID, then reloads the association for callers that need it.

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

The category association uses a lazy override to reuse the organization's resolved foreign key. `accessibleBy` is an opt-in helper that creates related records for a supplied user.

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

These Vitest examples use global `describe`, `test`, and `expect`, initialized models, and shared database cleanup. Each test owns its scenario data and focuses on one observable outcome; returned model state and persisted records are tested separately.

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

Register an association in the generator with `associate("organization", organizationFactory)`. It builds the associated instance; `create()` later persists registered associations in order. An override callback, such as `associate("category", categoryFactory, ({ organizationId }) => ({ organizationId }))`, runs during the initial build and again during creation, when earlier associations' foreign keys are available. Register dependencies before associations that use their values. You can also register associations conditionally by reading `params` or `transient` in the generator.

For `create()`, pass `{ organizationId: existing.id }`, `{ organization: existing }`, or `.associations({ organization: existing })` to use an existing parent. Use persisted instances for these overrides. A foreign-key override takes precedence if both the foreign key and association instance are supplied: `create()` loads that existing association, while `build()` attaches an `{ id }` placeholder.

Without a foreign-key override, `build()` creates unsaved association instances and does not write to the database. It does not reuse a supplied association instance in this case.

Parameter precedence, from lowest to highest, is generator attributes, `.associations()` defaults, `.params()` defaults, and call-time parameters. Repeated `.params()` calls merge; repeated `.associations()` calls replace their defaults. `.transient()` merges generator-only parameters that are not database columns.

Configuration methods return independent builders and do not mutate the original factory. Each new builder starts its own sequence at 1 and advances it on each `build()` or `create()` evaluation. The generator runs once per evaluation; associated factories have their own evaluations and sequences.

## Hooks and Errors

Register `beforeCreate` and `afterCreate` hooks in the generator, or chain `.beforeCreate()` and `.afterCreate()` on the factory. Chained hooks run before generator-registered hooks of the same kind. Hooks run sequentially and are awaited. Before-create hooks see resolved association foreign keys before the parent is saved; after-create hooks see the persisted parent. Hooks do not run for `build()`. Save any after-create changes explicitly if they must persist.

Invalid association registrations raise `AssociationNotFoundError` or `ForeignKeyNotFoundError`. Invalid instance overrides and database validation or constraint failures propagate. FactoryShark does not wrap the complete association graph in a transaction. If creation fails, previously created associated records may remain; a parent saved before an after-create failure may also remain. Use disposable test persistence and clean it between scenarios.

## Public Entry Points

Import from `factory-shark`; internal deep imports are not exported. The default TypeScript export is `FactoryShark`. Named runtime exports are `FactoryShark`, `FactoryContext`, `AssociationManager`, `AttributeBuilder`, `CreateStrategy`, `AssociationNotFoundError`, `ForeignKeyNotFoundError`, `isModel`, and `PRIMARY_KEY`. Root type exports are `BeforeCreateFn`, `FactoryInterface`, `FactoryParams`, and `GeneratorFn`. The helper classes are available for advanced use; most consumers need only `FactoryShark` and the factory types. `factory-shark/package.json` exposes package metadata.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and checks. For maintainers and readers interested in the project's design, see the [project knowledge base](docs/README.md).

## Name

If a robotic shark produced by FactoryBot came and gobbled up the Fishery library, it would become FactoryShark.

## License

FactoryShark is licensed under the [MIT License](LICENSE).
