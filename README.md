# FactoryShark

TypeScript factories for Sequelize tests. Define sensible defaults once, override only what a test cares about, and build unsaved models or create records with their associations.

FactoryShark grew out of using [Fishery](https://github.com/thoughtbot/fishery) with Sequelize. Its factory interface stays familiar, with nested association creation inspired by Rails' [factory_bot](https://github.com/thoughtbot/factory_bot).

## Install

```sh
npm install --save-dev factory-shark@2.6.2
```

Use your application's Sequelize models and dialect. FactoryShark supports Node.js 22/24, Sequelize 6.37.8 (`sequelize`) and Sequelize 7.0.0-alpha.48 (`@sequelize/core`). You only need the ORM version your application uses. ESM and CommonJS are supported; TypeScript projects should use Node16 or NodeNext module resolution.

## Define a Factory

These examples use initialized `Organization` and `Project` models from your application. `Organization` has an auto-generated `id` and a `name`. `Project` has an auto-generated `id`, `title`, nullable `note`, and `organizationId`. Use your own model import path instead of `@/models`.

```typescript
import FactoryShark from "factory-shark"

import { Organization, Project } from "@/models"

const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => {
  return {
    name: `Organization ${sequence}`,
  }
})
```

`sequence` starts at 1 and increases each time that factory evaluates its generator. FactoryShark infers the model's attribute and return types.

## Build or Create

Use `build()` when a test only needs a model instance. Pass attributes to override the defaults:

```typescript
const organization = organizationFactory.build()
organization.name // "Organization 1"
organization.isNewRecord // true

const namedOrganization = organizationFactory.build({
  name: "Northern Research",
})
namedOrganization.name // "Northern Research"
```

Use `create()` when the code under test queries the database:

```typescript
const savedOrganization = await organizationFactory.create({
  name: "Northern Research",
})
savedOrganization.isNewRecord // false

const foundOrganization = await Organization.findByPk(savedOrganization.id)
foundOrganization?.name // "Northern Research"
```

`build()` is synchronous and makes no database queries. `create()` returns a promise. Your test setup owns model initialization, migrations, and database cleanup. Always use an isolated test database: `create()` writes real records.

## Create Associations

Suppose `Project` belongs to `Organization` through the `organization` association. Register that relationship in Sequelize, then use `associate()` to give projects a default organization:

```typescript
const projectFactory = FactoryShark.define(Project, ({ sequence, associate }) => {
  associate("organization", organizationFactory)

  return {
    title: `Project ${sequence}`,
    note: null,
  }
})

const project = await projectFactory.create({
  title: "Habitat survey",
})
project.organization?.isNewRecord // false
project.organizationId === project.organization?.id // true
```

`create()` saves the organization first and assigns its ID to the project. `build()` instead attaches an unsaved organization without saving either record.

To reuse an existing organization, pass its model instance or foreign key:

```typescript
const sharedProject = await projectFactory.create({
  organization: savedOrganization,
})
sharedProject.organizationId === savedOrganization.id // true

const anotherProject = await projectFactory.create({
  organizationId: savedOrganization.id,
})
anotherProject.organizationId === savedOrganization.id // true
```

The existing row is reused without creating another organization. `build()` preserves a supplied model's identity and uses its known ID to fill a missing foreign key; explicit foreign keys take precedence. `create()` may load a fresh instance of that row. Generated dependencies currently support `belongsTo` associations with an `id` primary key.

## Reuse Configuration

Configure a factory for a group of tests without changing the original:

```typescript
const surveyFactory = projectFactory
  .associations({
    organization: savedOrganization,
  })
  .params({
    title: "Survey",
    note: "Awaiting review",
  })

const survey = surveyFactory.build({
  title: "Winter survey",
})
survey.title // "Winter survey"
survey.note // "Awaiting review"
survey.organization === savedOrganization // true
```

Call-time attributes win over `.params()` defaults, which win over `.associations()` defaults and generated attributes. Repeated `.params()` calls merge; repeated `.associations()` calls replace association defaults.

Each configured factory has its own sequence starting at 1. Keep and reuse a configured factory when you want its sequence to continue. Sequences are convenient defaults, not database-wide unique IDs.

## Build or Create Lists

```typescript
const drafts = surveyFactory.buildList(3)
drafts.every((draft) => draft.isNewRecord) // true

const savedProjects = await surveyFactory.createList(2, {
  title: "Published survey",
})
savedProjects.every((savedProject) => !savedProject.isNewRecord) // true
```

`buildList()` returns distinct unsaved instances synchronously. `createList()` saves items sequentially and returns a promise. Both retain the configured factory's associations, overrides, and sequence progression. Supply a nonnegative integer count; zero returns an empty array without evaluating the generator.

## Get Attributes Without a Model

Use `attributesFor()` when the code under test accepts plain attributes instead of a Sequelize instance:

```typescript
const attributes = organizationFactory.attributesFor({
  name: "Field team",
})
attributes.name // "Field team"
```

It follows build-time defaults and overrides without database access or create hooks. Association model properties are omitted; scalar foreign keys remain. It is not a recursive JSON serializer.

## Supply Child Records

For a Sequelize `Organization.hasMany(Project, { as: "projects", ... })` relationship, pass an array of built children:

```typescript
const children = projectFactory.buildList(2)
const parent = await organizationFactory.create({
  name: "Field office",
  projects: children,
})
children.every((child) => child.organizationId === parent.id) // true
children.every((child) => !child.isNewRecord) // true
```

FactoryShark saves the parent, assigns its foreign key to each unsaved child, and saves the children. Supplied child instances retain their identity. Already-persisted children cannot be moved to another parent. With `build()`, the same array is attached but no records are saved.

Declare collection properties as Sequelize `NonAttribute<Project[]>` on your model so TypeScript can check the supplied children. `hasOne`, through associations, and custom primary-key names are not supported for constructing these graphs.

## Transient Parameters

Use transient parameters to control generation without adding database columns:

```typescript
type ProjectOptions = {
  titlePrefix?: string
}

const prefixedProjectFactory = FactoryShark.define<Project, ProjectOptions>(
  Project,
  ({ sequence, transient, associate }) => {
    associate("organization", organizationFactory)

    return {
      title: `${transient.titlePrefix ?? "Project"} ${sequence}`,
      note: null,
    }
  }
)

const previewFactory = prefixedProjectFactory.transient({
  titlePrefix: "Preview",
})
const preview = previewFactory.build()
preview.title // "Preview 1"
```

## Create Hooks

Use `beforeCreate` to change the model before it is saved. Use an async `afterCreate` hook for work that needs a persisted record:

```typescript
const reviewedFactory = projectFactory
  .beforeCreate((record) => {
    record.title = record.title.trim()
  })
  .afterCreate(async (record) => {
    record.note = "Reviewed"
    await record.save()
  })

const reviewedProject = await reviewedFactory.create({
  title: "  Field review  ",
})
reviewedProject.title // "Field review"
reviewedProject.note // "Reviewed"
```

You can also register hooks inside the generator using its `beforeCreate` and `afterCreate` arguments. Chained hooks run before generator-registered hooks of the same kind. Hooks run on `create()` and `createList()`, not on builds or attribute extraction. After-create changes need an explicit `save()` if they should persist.

## Load Relationships

Use `.include()` when the code under test needs relationships loaded from the database:

```typescript
const loadedParent = await organizationFactory.include("projects").create({
  projects: projectFactory.buildList(2),
})
loadedParent.projects?.length // 2
```

Selections use your model's native Sequelize include options, including nested includes. Loading happens after parent and child saves, before after-create hooks. Builds ignore `.include()` and remain database-free. A later `.include()` replaces the selection; `.include(undefined)` clears it.

## Use in a Test

For example, with Vitest and your usual database setup/cleanup:

```typescript
import { expect, test } from "vitest"

test("finds an organization by its name", async () => {
  await organizationFactory.create({
    name: "Field office",
  })

  const found = await Organization.findOne({
    where: {
      name: "Field office",
    },
  })

  expect(found?.name).toBe("Field office")
})
```

## Failure and Cleanup

FactoryShark does not wrap a graph or list in a transaction. A failed save, hook, or reload stops subsequent work and propagates the error, but earlier writes remain. Reset or clean your test database between tests.

For complete test-file examples and optional subclass builders, see the [factory-authoring guide](https://github.com/klondikemarlen/factory-shark/blob/v2.6.2/docs/templates/factory-authoring.md). See the [changelog](https://github.com/klondikemarlen/factory-shark/blob/v2.6.2/CHANGELOG.md) for release history and [compatibility notes](https://github.com/klondikemarlen/factory-shark/blob/v2.6.2/docs/architecture/sequelize-compatibility.md) for supported Sequelize ranges.

## Contribute

See [CONTRIBUTING.md](https://github.com/klondikemarlen/factory-shark/blob/v2.6.2/CONTRIBUTING.md) for development setup and checks, and the [project knowledge base](https://github.com/klondikemarlen/factory-shark/blob/v2.6.2/docs/README.md) for architecture.

## Name

If a robotic shark produced by FactoryBot came and gobbled up the Fishery library, it would become FactoryShark.

## License

FactoryShark is licensed under the [MIT License](LICENSE).
