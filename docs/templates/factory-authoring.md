# Portable Factory Authoring

Use these patterns to author test factories with FactoryShark 2.2.2. They cover direct definitions, `belongsTo` dependencies, opt-in subclass helpers, lifecycle hooks, and list creation without prescribing application business rules. The examples use Sequelize 7; the same public FactoryShark imports support the documented Sequelize 6 integration.

## Choose the Matching Guide

Read the installed version from `node_modules/factory-shark/package.json` (for example, `node -p 'require("factory-shark/package.json").version'`). Open `https://github.com/klondikemarlen/factory-shark/blob/v<VERSION>/docs/templates/factory-authoring.md`, replacing `<VERSION>` with that exact version. For this release, use the [v2.2.2 guide](https://github.com/klondikemarlen/factory-shark/blob/v2.2.2/docs/templates/factory-authoring.md). Do not use the moving `main` branch to infer the contract of an installed release. If an older release has no guide at its tag, consult that release's README instead.

This canonical source is maintained alongside the public API in the same release. The npm artifact links here rather than shipping a separate template copy.

## Application-Owned Setup

Your application owns model names, import paths, export conventions, domain traits, model initialization, migrations, and test isolation. Keep a small local overlay explaining those choices; adapt these patterns instead of copying unrelated application behavior. The `@/` imports below are illustrative application-root aliases configured in both TypeScript and Vitest. Default factory exports are illustrative, not required by FactoryShark.

The executable examples assume `@/models` exports initialized `Organization` and `Project` model classes with this contract:

- `Organization` has `id: CreationOptional<number>` and `name: string`.
- `Project` has `id: CreationOptional<number>`, `title: string`, `note: string | null`, `organizationId: ForeignKey<OrganizationRecord["id"]>`, and `organization?: NonAttribute<OrganizationRecord>`, where `OrganizationRecord` is the instance type of `Organization`.
- Both models use `timestamps: false`. `note` is nullable. `Project.belongsTo(Organization, { as: "organization", foreignKey: "organizationId" })` is registered before factory evaluation.

The model annotations above are Sequelize types, not new FactoryShark requirements. The supported association contract is `belongsTo` with an `id` primary key; other association types and custom primary-key names are not supported. The consumer verification fixtures supply real SQLite persistence. Shared Vitest setup resets the database before each test and enables global `describe`, `test`, and `expect`. Factory counters need not reset: assertions use explicit overrides rather than depending on a particular sequence position.

## Factory Templates

### `factories/organization-factory.ts`

```typescript
import FactoryShark from "factory-shark"

import { Organization } from "@/models"
import type { Organization as OrganizationRecord } from "@/models"

const organizationFactory = FactoryShark.define<OrganizationRecord>(
  Organization,
  ({ sequence }) => {
    return {
      name: `Organization ${sequence}`,
    }
  }
)

export default organizationFactory
```

### `factories/project-factory.ts`

```typescript
import FactoryShark from "factory-shark"
import type { FactoryInterface, GeneratorFn } from "factory-shark"

import { Project } from "@/models"
import type { Project as ProjectRecord } from "@/models"

import organizationFactory from "@/factories/organization-factory"

type ProjectTransientParams = {
  titlePrefix?: string
  noteAfterCreate?: string
}

class ProjectFactory extends FactoryShark<ProjectRecord, ProjectTransientParams> {
  constructor(generator: GeneratorFn<ProjectRecord, ProjectTransientParams>) {
    super(Project, generator, {})
  }

  withNote(note: string): FactoryInterface<ProjectRecord, ProjectTransientParams> {
    return this.params({
      note,
    })
  }
}

const projectFactory = new ProjectFactory(
  ({ sequence, associate, beforeCreate, afterCreate, transient }) => {
    associate("organization", organizationFactory)

    beforeCreate((project) => {
      project.title = project.title.trim()
    })

    afterCreate(async (project) => {
      if (typeof transient.noteAfterCreate === "string") {
        project.note = transient.noteAfterCreate
        await project.save()
      }
    })

    const titlePrefix = transient.titlePrefix ?? "Project"

    return {
      title: `${titlePrefix} ${sequence}`,
      note: null,
    }
  }
)

export default projectFactory
```

`withNote` is opt-in configuration, not a model requirement. It returns the public `FactoryInterface<ProjectRecord, ProjectTransientParams>` from `this.params`. Call custom methods on the original subclass instance first. The resulting configured builders retain the public factory API, including `transient`, hooks, and `createList`, but do not expose subclass methods such as `withNote`.

Transient parameters steer generation and hooks; they are not model columns. The empty constructor defaults make both transient options optional. Each original factory or configured clone owns a sequence starting at 1; each evaluation advances that builder's sequence once. A generator runs once per `build`, `attributesFor`, or `create` evaluation. Sequence-derived values are convenient defaults, not a database-wide uniqueness guarantee.

Attribute precedence is generated values < `.associations()` defaults < `.params()` defaults < call-time parameters. Repeated `.params()` and `.transient()` calls merge defaults; repeated `.associations()` calls replace association defaults. Configuration returns independent builders rather than mutating the original factory.

## Focused Consumer Tests

### `project-factory.test.ts`

```typescript
import { Organization, Project } from "@/models"

import organizationFactory from "@/factories/organization-factory"

import projectFactory from "@/factories/project-factory"

describe("factories/project-factory.ts", () => {
  describe("#build", () => {
    test("when built without saving, returns an unsaved project", () => {
      // Arrange
      const attributes = {
        title: "Draft review",
      }

      // Act
      const project = projectFactory.build(attributes)

      // Assert
      expect(project.isNewRecord).toBe(true)
    })

    test("when built with an association, writes no organization", async () => {
      // Arrange
      const attributes = {
        title: "Draft review",
      }

      // Act
      projectFactory.build(attributes)

      // Assert
      const organizations = await Organization.findAll()
      expect(organizations).toEqual([])
    })

    test("when a prefix is configured, uses it in the generated title", () => {
      // Arrange
      const configuredFactory = projectFactory.transient({
        titlePrefix: "Preview",
      })

      // Act
      const project = configuredFactory.build()

      // Assert
      expect(project.title).toMatch(/^Preview \d+$/)
    })
  })

  describe("#create", () => {
    test("when attributes are supplied, persists the explicit title", async () => {
      // Arrange
      const attributes = {
        title: "Budget review",
      }

      // Act
      await projectFactory.create(attributes)

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          title: "Budget review",
        }),
      ])
    })

    test("when a foreign key is supplied, reuses the existing organization", async () => {
      // Arrange
      const organization = await organizationFactory.create({
        name: "Existing organization",
      })
      const attributes = {
        title: "Existing parent review",
        organizationId: organization.id,
      }

      // Act
      await projectFactory.create(attributes)

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          organizationId: organization.id,
        }),
      ])
    })

    test("when an association is configured, creates no additional organization", async () => {
      // Arrange
      const organization = await organizationFactory.create({
        name: "Shared organization",
      })
      const configuredFactory = projectFactory.associations({
        organization,
      })

      // Act
      await configuredFactory.create({
        title: "Shared parent review",
      })

      // Assert
      const organizations = await Organization.findAll()
      expect(organizations).toEqual([
        expect.objectContaining({
          id: organization.id,
        }),
      ])
    })

    test("when a title has surrounding spaces, saves the before-hook result", async () => {
      // Arrange
      const attributes = {
        title: "  Trimmed review  ",
      }

      // Act
      await projectFactory.create(attributes)

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          title: "Trimmed review",
        }),
      ])
    })

    test("when an after-create note is requested, explicitly saves it", async () => {
      // Arrange
      const configuredFactory = projectFactory.transient({
        noteAfterCreate: "Saved by the after-create hook",
      })

      // Act
      await configuredFactory.create({
        title: "Annotated review",
      })

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          note: "Saved by the after-create hook",
        }),
      ])
    })

    test("when an after-create hook does not save, leaves the stored note unchanged", async () => {
      // Arrange
      const configuredFactory = projectFactory.afterCreate(async (project) => {
        project.note = "In-memory change only"
      })

      // Act
      await configuredFactory.create({
        title: "Unsaved annotation review",
      })

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          note: null,
        }),
      ])
    })
  })

  describe("#withNote", () => {
    test("when the helper is requested, persists its configured note", async () => {
      // Arrange
      const configuredFactory = projectFactory.withNote("Opt-in annotation")

      // Act
      await configuredFactory.create({
        title: "Opt-in review",
      })

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          note: "Opt-in annotation",
        }),
      ])
    })
  })

  describe("#createList", () => {
    test("when called on the root factory, persists each project", async () => {
      // Arrange
      const attributes = {
        title: "Batch review",
      }

      // Act
      await projectFactory.createList(2, attributes)

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          title: "Batch review",
        }),
        expect.objectContaining({
          title: "Batch review",
        }),
      ])
    })

    test("when called after an opt-in helper, preserves the configured note", async () => {
      // Arrange
      const configuredFactory = projectFactory.withNote("Batch annotation")
      const attributes = {
        title: "Annotated batch review",
      }

      // Act
      await configuredFactory.createList(2, attributes)

      // Assert
      const projects = await Project.findAll()
      expect(projects).toEqual([
        expect.objectContaining({
          note: "Batch annotation",
        }),
        expect.objectContaining({
          note: "Batch annotation",
        }),
      ])
    })
  })

  describe("#attributesFor", () => {
    test("when a foreign key is supplied, returns request attributes", () => {
      // Arrange
      const configuredFactory = projectFactory.params({
        title: "Request review",
      })
      const attributes = {
        organizationId: 42,
      }

      // Act
      const payload = configuredFactory.attributesFor(attributes)

      // Assert
      expect(payload).toEqual(
        expect.objectContaining({
          title: "Request review",
          note: null,
          organizationId: 42,
        })
      )
    })

    test("when an unsaved association is generated, excludes its model property", () => {
      // Arrange
      const attributes = {
        title: "Unsaved payload review",
      }

      // Act
      const payload = projectFactory.attributesFor(attributes)

      // Assert
      expect(payload).not.toHaveProperty("organization")
    })
  })
})
```

## Persistence and Evaluation Boundaries

`build` creates an unsaved parent and attaches unsaved association instances without writing or running create hooks. A supplied foreign key creates an association `id` placeholder in build mode; a supplied association instance alone is not reused in that mode. To reuse a persisted parent during `create`, pass its foreign key or configure `.associations({ organization })`. If both are supplied, the foreign key wins and FactoryShark loads that record. Without overrides, the registered organization factory creates and saves the dependency before the project is saved.

`create` resolves associations in registration order, builds the parent, awaits before-create hooks, saves the parent, then awaits after-create hooks. Chained hooks run before generator-registered hooks of the same kind. A before-create mutation participates in the parent save; an after-create mutation needs its own explicit `await project.save()` to persist. The trimming and optional annotation above only illustrate those boundaries: adapt or remove them according to your application's needs.

`createList(count, params?)` is available on both the root factory and configured builders. It awaits each `create` sequentially on the same builder, preserving configuration, sequence progression, hook behavior, and result order. Supply a nonnegative integer; zero returns an empty array without evaluation or writes. The first error rejects the list and stops later items, but earlier writes remain. Neither list creation nor association-graph creation adds a transaction; the application owns isolation and cleanup.

Since 2.2.0, `attributesFor(params?)` returns the raw attributes from one unsaved build, typed as the model's creation attributes. It runs no create hooks and writes nothing. It preserves Date values and Buffer bytes without serialization or custom-getter evaluation. Association model properties attached outside raw `dataValues` are excluded, including unsaved generated associations and foreign-key placeholders; unsaved associations do not produce persisted foreign keys. Explicit foreign keys remain in the payload. This is not recursive JSON serialization: choose the fields your endpoint accepts rather than assuming every raw model attribute is an API input.
