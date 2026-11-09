import assert from "node:assert/strict"
import { test } from "node:test"

import isUndefined from "lodash/isUndefined.js"
import type { InferCreationAttributes } from "@sequelize/core"

import { createFixture } from "@/tests/support.js"
import type { Fixture, OrganizationRecord, ProjectRecord } from "@/tests/support.js"

import {
  AssociationManager,
  AssociationNotFoundError,
  AttributeBuilder,
  FactoryContext,
  FactoryShark,
} from "@/src/index.js"
import type { FactoryInterface } from "@/src/index.js"

type FixtureScenario = (fixture: Fixture) => Promise<void>

type ProjectOptions = {
  prefix?: string
  suffix?: string
}

async function withFixture(runScenario: FixtureScenario) {
  const fixture = createFixture()

  try {
    await fixture.sequelize.sync({
      force: true,
    })
    await runScenario(fixture)
  } finally {
    await fixture.sequelize.close()
  }
}

test("when build is called, it returns an unsaved model", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    // Act
    const project = projectFactory.build()

    // Assert
    assert.equal(project.isNewRecord, true)
  })
})

test("when attributesFor receives a Date, it preserves the Date value", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const observedAt = new Date("2026-11-09T12:34:56.789Z")

    // Act
    const attributes = organizationFactory.attributesFor({ observedAt })

    // Assert
    assert.deepEqual(attributes.observedAt, observedAt)
  })
})

test("when attributesFor receives binary data, it preserves bytes without invoking the custom getter", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const payload = Buffer.from([0, 127, 128, 255, 195, 40])

    // Act
    const attributes = organizationFactory.attributesFor({ payload })

    // Assert
    assert.deepEqual(attributes.payload, payload)
  })
})

test("when attributesFor follows build and precedes create, each operation evaluates the same sequence once", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const evaluatedSequences: number[] = []
    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => {
      evaluatedSequences.push(sequence)

      return {
        name: `Organization ${sequence}`,
      }
    })

    // Act
    organizationFactory.build()
    organizationFactory.attributesFor()
    await organizationFactory.create()

    // Assert
    assert.deepEqual(evaluatedSequences, [1, 2, 3])
  })
})

test("when attributesFor uses a configured factory, its sequence is shared with its own build and create calls", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
      name: `Organization ${sequence}`,
    }))
    organizationFactory.build()
    const configuredFactory = organizationFactory.params({})

    // Act
    const first = configuredFactory.attributesFor()
    const second = configuredFactory.build()
    const third = await configuredFactory.create()
    const source = organizationFactory.attributesFor()

    // Assert
    assert.deepEqual(
      [first.name, second.name, third.name, source.name],
      ["Organization 1", "Organization 2", "Organization 3", "Organization 2"]
    )
  })
})

test("when attributesFor uses transient and parameter defaults, call parameters retain precedence", async () => {
  // Arrange
  await withFixture(async ({ Project }) => {
    const projectFactory = FactoryShark.define<ProjectRecord, ProjectOptions>(
      Project,
      ({ transient, params }) => ({
        title: `${transient.prefix}${params.title}`,
      })
    )
    const configuredFactory = projectFactory
      .transient({ prefix: "Generated " })
      .params({ title: "Configured" })
    const params = {
      title: "Call override",
    }

    // Act
    const attributes = configuredFactory.attributesFor(params)

    // Assert
    assert.equal(attributes.title, "Call override")
  })
})

test("when attributesFor registers create hooks, neither configured nor generator hooks run", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const hookEvents: string[] = []
    const organizationFactory = FactoryShark.define(
      Organization,
      ({ beforeCreate, afterCreate }) => {
        beforeCreate(() => {
          hookEvents.push("generator before")
        })
        afterCreate(async () => {
          hookEvents.push("generator after")
        })

        return {
          name: "Unsaved organization",
        }
      }
    )
    const configuredFactory = organizationFactory
      .beforeCreate(() => {
        hookEvents.push("configured before")
      })
      .afterCreate(async () => {
        hookEvents.push("configured after")
      })

    // Act
    configuredFactory.attributesFor()

    // Assert
    assert.deepEqual(hookEvents, [])
  })
})

test("when attributesFor evaluates associations, it does not persist the parent", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    // Act
    projectFactory.attributesFor()

    // Assert
    const projectCount = await Project.count()
    assert.equal(projectCount, 0)
  })
})

test("when attributesFor evaluates associations, it does not persist their organizations", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization }) => {
    // Act
    projectFactory.attributesFor()

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 0)
  })
})

test("when attributesFor generates unsaved associations, it does not invent their foreign keys", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    // Act
    const attributes = projectFactory.attributesFor()

    // Assert
    assert.equal(attributes.organizationId, undefined)
  })
})

test("when attributesFor receives an explicit foreign key, it retains the scalar value", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const organizationId = 42

    // Act
    const attributes = projectFactory.attributesFor({ organizationId })

    // Assert
    assert.equal(attributes.organizationId, organizationId)
  })
})

test("when attributesFor receives a foreign key, model-property association placeholders are excluded", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const organizationId = 42

    // Act
    const attributes = projectFactory.attributesFor({ organizationId })

    // Assert
    assert.equal("organization" in attributes, false)
  })
})

test("when build evaluates associations, the associated organization remains unsaved", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    // Act
    const project = projectFactory.build()

    // Assert
    assert.equal(project.organization?.isNewRecord, true)
  })
})

test("when build is called, it does not persist the parent record", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    // Act
    projectFactory.build()

    // Assert
    const projectCount = await Project.count()
    assert.equal(projectCount, 0)
  })
})

test("when build evaluates associations, it does not persist organizations", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization }) => {
    // Act
    projectFactory.build()

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 0)
  })
})

test("when build evaluates associations, it does not persist categories", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Category }) => {
    // Act
    projectFactory.build()

    // Assert
    const categoryCount = await Category.count()
    assert.equal(categoryCount, 0)
  })
})

test("when build evaluates associations, it does not persist users", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, User }) => {
    // Act
    projectFactory.build()

    // Assert
    const userCount = await User.count()
    assert.equal(userCount, 0)
  })
})

test("when create is called, it returns a saved model", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    // Act
    const project = await projectFactory.create()

    // Assert
    assert.equal(project.isNewRecord, false)
  })
})

test("when create is called, the parent record is persisted", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    // Act
    const project = await projectFactory.create()

    // Assert
    const persistedProject = await Project.findByPk(project.id)
    assert.equal(persistedProject?.title, "Project 1")
  })
})

test("when create evaluates associations, it persists the organization", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization }) => {
    // Act
    await projectFactory.create()

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 1)
  })
})

test("when create evaluates associations, it persists the category", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Category }) => {
    // Act
    await projectFactory.create()

    // Assert
    const categoryCount = await Category.count()
    assert.equal(categoryCount, 1)
  })
})

test("when create evaluates associations, it persists the user", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, User }) => {
    // Act
    await projectFactory.create()

    // Assert
    const userCount = await User.count()
    assert.equal(userCount, 1)
  })
})

test("when createList is called, it persists the requested projects", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    const count = 3

    // Act
    await projectFactory.createList(count)

    // Assert
    const persistedProjects = await Project.findAll({
      attributes: ["title"],
      order: [["id", "ASC"]],
      raw: true,
    })
    assert.deepEqual(persistedProjects, [
      { title: "Project 1" },
      { title: "Project 2" },
      { title: "Project 3" },
    ])
  })
})

test("when createList has a configured persisted organization, every project retains its relationship", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, Project }) => {
    const organization = await organizationFactory.create()
    const configuredFactory = projectFactory.associations({
      organization,
    })

    // Act
    await configuredFactory.createList(2)

    // Assert
    const projects = await Project.findAll({
      attributes: ["organizationId"],
      raw: true,
    })
    assert.deepEqual(projects, [
      { organizationId: organization.id },
      { organizationId: organization.id },
    ])
  })
})

test("when createList has a configured persisted organization, it does not replace that organization", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, Organization }) => {
    const organization = await organizationFactory.create()
    const configuredFactory = projectFactory.associations({
      organization,
    })

    // Act
    await configuredFactory.createList(2)

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 1)
  })
})

test("when create follows createList, the same factory sequence continues in order", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const count = 3

    // Act
    const organizations = await organizationFactory.createList(count)
    const nextOrganization = await organizationFactory.create()

    // Assert
    assert.deepEqual(
      [...organizations, nextOrganization].map((organization) => organization.name),
      ["Organization 1", "Organization 2", "Organization 3", "Organization 4"]
    )
  })
})

test("when a configured clone creates a list, the original factory sequence remains independent", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const configuredFactory = organizationFactory.params({})

    // Act
    await configuredFactory.createList(2)
    const organization = await organizationFactory.create()

    // Assert
    assert.equal(organization.name, "Organization 1")
  })
})

test("when createList receives zero, it returns an empty list", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const count = 0

    // Act
    const projects = await projectFactory.createList(count)

    // Assert
    assert.deepEqual(projects, [])
  })
})

test("when createList receives zero, it does not evaluate or advance the generator", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const evaluatedSequences: number[] = []
    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => {
      evaluatedSequences.push(sequence)

      return {
        name: `Organization ${sequence}`,
      }
    })

    // Act
    await organizationFactory.createList(0)
    await organizationFactory.create()

    // Assert
    assert.deepEqual(evaluatedSequences, [1])
  })
})

test("when createList receives zero, it runs no create hooks", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const hookEvents: string[] = []
    const observedFactory = projectFactory
      .beforeCreate(() => {
        hookEvents.push("before")
      })
      .afterCreate(async () => {
        hookEvents.push("after")
      })

    // Act
    await observedFactory.createList(0)

    // Assert
    assert.deepEqual(hookEvents, [])
  })
})

test("when createList receives zero, it persists no association records", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization }) => {
    const count = 0

    // Act
    await projectFactory.createList(count)

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 0)
  })
})

test("when a list item hook rejects, createList propagates the same error", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const hookError = new Error("second item failed")
    const failingFactory = organizationFactory.beforeCreate((organization) => {
      if (organization.name === "Organization 2") throw hookError
    })

    // Act / Assert
    await assert.rejects(failingFactory.createList(3), (error) => error === hookError)
  })
})

test("when a list item hook rejects, earlier items remain persisted and later items are not created", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, Organization }) => {
    const hookError = new Error("second item failed")
    const failingFactory = organizationFactory.beforeCreate((organization) => {
      if (organization.name === "Organization 2") throw hookError
    })

    // Act
    try {
      await failingFactory.createList(3)
    } catch (error) {
      if (error !== hookError) throw error
    }

    // Assert
    const organizations = await Organization.findAll({
      attributes: ["name"],
      raw: true,
    })
    assert.deepEqual(organizations, [{ name: "Organization 1" }])
  })
})

test("when createList uses transient configuration, each item completes its async hooks before the next", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const hookEvents: string[] = []
    const organizationFactory = FactoryShark.define<OrganizationRecord, ProjectOptions>(
      Organization,
      ({ sequence, transient, beforeCreate, afterCreate }) => {
        beforeCreate(async (organization) => {
          await Promise.resolve()
          hookEvents.push(`before:${organization.name}:${organization.isNewRecord}`)
        })
        afterCreate(async (organization) => {
          await Promise.resolve()
          hookEvents.push(`after:${organization.name}:${organization.isNewRecord}`)
        })

        return {
          name: `${transient.prefix}${sequence}`,
        }
      }
    ).transient({
      prefix: "Team ",
    })

    // Act
    await organizationFactory.createList(2)

    // Assert
    assert.deepEqual(hookEvents, [
      "before:Team 1:true",
      "after:Team 1:false",
      "before:Team 2:true",
      "after:Team 2:false",
    ])
  })
})

test("when createList call parameters conflict with defaults, every persisted item uses the call override", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    const configuredFactory = projectFactory.params({
      title: "Factory default",
    })
    const params = {
      title: "Call override",
    }

    // Act
    await configuredFactory.createList(2, params)

    // Assert
    const projects = await Project.findAll({
      attributes: ["title"],
      raw: true,
    })
    assert.deepEqual(projects, [{ title: "Call override" }, { title: "Call override" }])
  })
})

test("when a foreign key is supplied, create assigns it to the parent", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = await organizationFactory.create()

    // Act
    const project = await projectFactory.create({
      organizationId: organization.id,
    })

    // Assert
    assert.equal(project.organizationId, organization.id)
  })
})

test("when a foreign key is supplied, create does not duplicate that association", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, Organization }) => {
    const organization = await organizationFactory.create()

    // Act
    await projectFactory.create({
      organizationId: organization.id,
    })

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 1)
  })
})

test("when a foreign key is supplied, create still persists the category", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, Category }) => {
    const organization = await organizationFactory.create()

    // Act
    await projectFactory.create({
      organizationId: organization.id,
    })

    // Assert
    const categoryCount = await Category.count()
    assert.equal(categoryCount, 1)
  })
})

test("when a foreign key is supplied, create still persists the user", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, User }) => {
    const organization = await organizationFactory.create()

    // Act
    await projectFactory.create({
      organizationId: organization.id,
    })

    // Assert
    const userCount = await User.count()
    assert.equal(userCount, 1)
  })
})

test("when a persisted association is supplied, create uses its foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = await organizationFactory.create()
    const existingOrganizationFactory = projectFactory.associations({
      organization,
    })

    // Act
    const project = await existingOrganizationFactory.create()

    // Assert
    assert.equal(project.organizationId, organization.id)
  })
})

test("when a persisted association is supplied, create does not replace it", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, Organization }) => {
    const organization = await organizationFactory.create()
    const existingOrganizationFactory = projectFactory.associations({
      organization,
    })

    // Act
    await existingOrganizationFactory.create()

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 1)
  })
})

test("when an association callback reads an earlier foreign key, dependent records share it", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Category }) => {
    // Act
    const project = await projectFactory.create()

    // Assert
    const category = await Category.findByPk(project.categoryId)
    assert.equal(category?.organizationId, project.organizationId)
  })
})

test("when association registration is conditional on a supplied foreign key, create reuses the existing record", async () => {
  // Arrange
  await withFixture(
    async ({ organizationFactory, categoryFactory, userFactory, Project, Organization }) => {
      const organization = await organizationFactory.create()
      const conditionalProjectFactory = FactoryShark.define(
        Project,
        ({ associate, sequence, params }) => {
          if (isUndefined(params.organizationId)) {
            associate("organization", organizationFactory)
          }

          associate("category", categoryFactory, {
            organizationId: organization.id,
          })
          associate("creator", userFactory)

          return {
            title: `Conditional ${sequence}`,
          }
        }
      )

      // Act
      await conditionalProjectFactory.create({
        organizationId: organization.id,
      })

      // Assert
      const organizationCount = await Organization.count()
      assert.equal(organizationCount, 1)
    }
  )
})

test("when call parameters conflict with factory defaults, call parameters take precedence", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const defaultTitleFactory = projectFactory.params({
      title: "Factory default",
    })

    // Act
    const project = await defaultTitleFactory.create({
      title: "Call override",
    })

    // Assert
    assert.equal(project.title, "Call override")
  })
})

test("when transient defaults are chained, both defaults affect generated attributes", async () => {
  // Arrange
  await withFixture(async ({ Project }) => {
    const projectFactory = FactoryShark.define<ProjectRecord, ProjectOptions>(
      Project,
      ({ sequence, transient }) => {
        const prefix = transient.prefix ?? ""
        const suffix = transient.suffix ?? ""

        return {
          title: `${prefix}Project ${sequence}${suffix}`,
        }
      }
    )
    const prefixedFactory = projectFactory.transient({
      prefix: "[",
    })
    const bracketedFactory = prefixedFactory.transient({
      suffix: "]",
    })

    // Act
    const project = bracketedFactory.build()

    // Assert
    assert.equal(project.title, "[Project 1]")
  })
})

test("when build is called, its generated name uses the first sequence value", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
      name: `Organization ${sequence}`,
    }))

    // Act
    const organization = organizationFactory.build()

    // Assert
    assert.equal(organization.name, "Organization 1")
  })
})

test("when create follows a build, its generated name uses the next sequence value", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
      name: `Organization ${sequence}`,
    }))
    organizationFactory.build()

    // Act
    const organization = await organizationFactory.create()

    // Assert
    assert.equal(organization.name, "Organization 2")
  })
})

test("when build registers associations, the parent generator runs once", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, categoryFactory, userFactory, Project }) => {
    let generatorEvaluations = 0
    const projectFactory = FactoryShark.define(Project, ({ sequence, associate }) => {
      generatorEvaluations += 1
      associate("organization", organizationFactory)
      associate("category", categoryFactory, ({ organizationId }) => ({
        organizationId,
      }))
      associate("creator", userFactory)

      return {
        title: `Project ${sequence}`,
      }
    })

    // Act
    projectFactory.build()

    // Assert
    assert.equal(generatorEvaluations, 1)
  })
})

test("when create registers associations, the parent generator runs once", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, categoryFactory, userFactory, Project }) => {
    let generatorEvaluations = 0
    const projectFactory = FactoryShark.define(Project, ({ sequence, associate }) => {
      generatorEvaluations += 1
      associate("organization", organizationFactory)
      associate("category", categoryFactory, ({ organizationId }) => ({
        organizationId,
      }))
      associate("creator", userFactory)

      return {
        title: `Project ${sequence}`,
      }
    })

    // Act
    await projectFactory.create()

    // Assert
    assert.equal(generatorEvaluations, 1)
  })
})

test("when beforeCreate runs, it receives the resolved foreign key", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    let observedOrganizationId: number | undefined
    const observedFactory = projectFactory.beforeCreate((project) => {
      observedOrganizationId = project.organizationId
    })

    // Act
    const project = await observedFactory.create()

    // Assert
    assert.equal(observedOrganizationId, project.organizationId)
  })
})

test("when beforeCreate changes an attribute, the changed value is persisted", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    const renamedFactory = projectFactory.beforeCreate((project) => {
      project.title = "Changed before saving"
    })

    // Act
    const project = await renamedFactory.create()

    // Assert
    const persistedProject = await Project.findByPk(project.id)
    assert.equal(persistedProject?.title, "Changed before saving")
  })
})

test("when beforeCreate throws, create propagates the hook error", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const failingFactory = projectFactory.beforeCreate(() => {
      throw new Error("before hook failed")
    })

    // Act / Assert
    await assert.rejects(failingFactory.create(), /before hook failed/)
  })
})

test("when beforeCreate throws, create does not persist the parent record", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    const hookError = new Error("before hook failed")
    const failingFactory = projectFactory.beforeCreate(() => {
      throw hookError
    })

    // Act
    try {
      await failingFactory.create()
    } catch (error) {
      if (error !== hookError) throw error
    }

    // Assert
    const projectCount = await Project.count()
    assert.equal(projectCount, 0)
  })
})

test("when create runs hooks, beforeCreate sees an unsaved model and afterCreate sees a saved model", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const hookEvents: string[] = []
    const observedFactory = projectFactory
      .beforeCreate((project) => {
        hookEvents.push(`before:${project.isNewRecord}`)
      })
      .afterCreate(async (project) => {
        hookEvents.push(`after:${project.isNewRecord}:${project.id}`)
      })

    // Act
    const project = await observedFactory.create()

    // Assert
    assert.deepEqual(hookEvents, ["before:true", `after:false:${project.id}`])
  })
})

test("when build is called, create hooks do not run", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    let hookCalls = 0
    const observedFactory = projectFactory
      .beforeCreate(() => {
        hookCalls += 1
      })
      .afterCreate(async () => {
        hookCalls += 1
      })

    // Act
    observedFactory.build()

    // Assert
    assert.equal(hookCalls, 0)
  })
})

test("when an unknown association is registered, build raises AssociationNotFoundError", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, Project }) => {
    const invalidFactory = FactoryShark.define(Project, ({ associate }) => {
      // @ts-expect-error Invalid JavaScript consumers still receive a useful runtime error.
      associate("missing", organizationFactory)

      return {
        title: "Invalid association test",
      }
    })

    // Act / Assert
    assert.throws(() => invalidFactory.build(), AssociationNotFoundError)
  })
})

// These compile-only scenarios never run; tsc fails if invalid inputs become accepted.
export function checkFactoryTypes({ Project, User, organizationFactory }: Fixture) {
  const projectFactory = FactoryShark.define(Project, () => ({
    title: "Typed project",
  }))
  const directModelRows: Promise<ProjectRecord[]> = projectFactory.modelClass.findAll()
  const configuredModelRows: Promise<ProjectRecord[]> = projectFactory
    .params({
      title: "Configured project",
    })
    .modelClass.findAll()
  void directModelRows
  void configuredModelRows

  const directList: Promise<ProjectRecord[]> = projectFactory.createList(2, {
    title: "Typed list",
    organizationId: 1,
  })
  const configuredFactory = projectFactory.params({
    title: "Configured list",
  })
  const configuredList: Promise<ProjectRecord[]> = configuredFactory.createList(2)
  void directList
  void configuredList

  const directAttributes: InferCreationAttributes<ProjectRecord> = projectFactory.attributesFor({
    organizationId: 1,
  })
  const configuredAttributes: InferCreationAttributes<ProjectRecord> =
    configuredFactory.attributesFor({ title: "Typed attributes" })
  const contractFactory: FactoryInterface<ProjectRecord> = projectFactory
  const contractAttributes: InferCreationAttributes<ProjectRecord> = contractFactory.attributesFor()
  const attributeTitle: string = configuredFactory.attributesFor().title
  void directAttributes
  void configuredAttributes
  void contractAttributes
  void attributeTitle

  const attributesForProject = (factory: FactoryInterface<ProjectRecord>) => factory.attributesFor()
  const helperAttributes: InferCreationAttributes<ProjectRecord> =
    attributesForProject(configuredFactory)
  void helperAttributes

  // @ts-expect-error Attribute overrides reject unknown keys.
  projectFactory.attributesFor({ unknown: true })

  // @ts-expect-error Configured attribute overrides preserve field types.
  configuredFactory.attributesFor({ title: 42 })

  // @ts-expect-error Attribute association overrides require a model instance.
  configuredFactory.attributesFor({ organization: "not an organization" })

  // @ts-expect-error Attribute results are not model instances.
  projectFactory.attributesFor().save()

  // @ts-expect-error List counts must be numbers.
  projectFactory.createList("2")

  // @ts-expect-error Lists require a count.
  projectFactory.createList()

  // @ts-expect-error List parameters reject unknown attribute names.
  projectFactory.createList(2, { unknown: true })

  // @ts-expect-error Configured list parameters preserve attribute types.
  configuredFactory.createList(2, { title: 42 })

  // @ts-expect-error List association parameters require a model instance.
  configuredFactory.createList(2, { organization: "not an organization" })

  const factoryContext = new FactoryContext(Project)
  factoryContext.associate<OrganizationRecord>("organization", organizationFactory)
  const registration = factoryContext.registrations[0]
  registration.instance.get("id")
  const isNewRecord: boolean = registration.instance.isNewRecord
  void isNewRecord
  void registration.create({}).then((model) => model.get("id"))

  FactoryShark.define(Project, ({ associate }) => {
    const organization = associate<OrganizationRecord>("organization", organizationFactory)

    return {
      title: organization.name,
    }
  })

  const associationManager = new AssociationManager(Project, [], {})
  const attributeBuilder = new AttributeBuilder<ProjectRecord>({
    generator: ({ sequence }) => ({
      title: `Builder project ${sequence}`,
    }),
    sequence: 1,
    transientParams: {},
    associate: factoryContext.associate,
    params: {},
  })
  void factoryContext
  void associationManager
  void attributeBuilder

  projectFactory.create({
    title: "Allowed",
    organizationId: 1,
  })

  // @ts-expect-error Unknown factory parameter keys are rejected.
  projectFactory.create({ unknown: true })

  // @ts-expect-error Association parameters require a model instance.
  projectFactory.create({ organization: "not an organization" })

  FactoryShark.define(Project, () => ({
    title: "Valid generator result",
    // @ts-expect-error Excess generator properties are rejected.
    notAProjectField: true,
  }))

  const userFactory = FactoryShark.define(User, () => ({
    name: "Typed user",
  }))

  FactoryShark.define(Project, ({ associate }) => {
    // @ts-expect-error Non-association names are rejected.
    associate("notAnAssociation", userFactory)

    return {
      title: "Typed association",
    }
  })
}
