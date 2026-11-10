import assert from "node:assert/strict"
import { test } from "node:test"

import type { InferCreationAttributes, ModelStatic } from "sequelize"

import { createFixture } from "@/tests/support.js"
import { createSequelizeV6Fixture } from "@/tests/sequelize-v6-support.js"
import type { Fixture as SequelizeV7Fixture } from "@/tests/support.js"
import type {
  OrganizationRecord,
  ProjectRecord,
  SequelizeV6Fixture,
} from "@/tests/sequelize-v6-support.js"

import { FactoryContext, FactoryShark } from "@/src/index.js"
import type { FactoryInterface, FactoryParams } from "@/src/index.js"

type FixtureScenario = (fixture: SequelizeV6Fixture) => Promise<void>

async function withFixture(runScenario: FixtureScenario): Promise<void> {
  const fixture = createSequelizeV6Fixture()

  try {
    await fixture.sequelize.sync({
      force: true,
    })
    await runScenario(fixture)
  } finally {
    await fixture.sequelize.close()
  }
}

async function withMixedFixtures(
  runScenario: (sequelizeV6: SequelizeV6Fixture, sequelizeV7: SequelizeV7Fixture) => Promise<void>
): Promise<void> {
  const sequelizeV6 = createSequelizeV6Fixture()
  const sequelizeV7 = createFixture()

  try {
    await sequelizeV6.sequelize.sync({
      force: true,
    })
    await sequelizeV7.sequelize.sync({
      force: true,
    })
    await runScenario(sequelizeV6, sequelizeV7)
  } finally {
    await sequelizeV6.sequelize.close()
    await sequelizeV7.sequelize.close()
  }
}

test("when build is called, it returns an unsaved Sequelize 6 model", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    // Act
    const project = projectFactory.build()

    // Assert
    assert.equal(project.isNewRecord, true)
  })
})

test("when Sequelize 6 build receives a supplied association, it preserves model identity", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = await organizationFactory.create()
    const configuredFactory = projectFactory.associations({ organization })

    // Act
    const project = configuredFactory.build()

    // Assert
    assert.equal(project.organization, organization)
  })
})

test("when Sequelize 6 build receives a supplied nested association, it preserves the nested graph", async () => {
  // Arrange
  await withFixture(async ({ categoryFactory, projectFactory }) => {
    const category = categoryFactory.build()

    // Act
    const project = projectFactory.build({ category })

    // Assert
    assert.equal(project.category?.organization, category.organization)
  })
})

test("when Sequelize 6 build receives a supplied association with an ID, it fills the scalar foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const project = projectFactory.build({ organization, organizationId: undefined })

    // Assert
    assert.equal(project.get("organizationId"), organization.id)
  })
})

test("when Sequelize 6 build receives a supplied association without an ID, it does not invent a foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()

    // Act
    const project = projectFactory.build({ organization })

    // Assert
    assert.equal(project.organizationId, undefined)
  })
})

test("when Sequelize 6 build receives an unsaved supplied association, it leaves that model unsaved", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()

    // Act
    projectFactory.build({ organization })

    // Assert
    assert.equal(organization.isNewRecord, true)
  })
})

test("when Sequelize 6 build receives a supplied association and an explicit foreign key, it attaches an ID placeholder", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })
    const organizationId = 0

    // Act
    const project = projectFactory.build({ organization, organizationId })

    // Assert
    assert.deepEqual(project.organization, { id: organizationId })
  })
})

test("when Sequelize 6 build receives a supplied association and an explicit foreign key, it leaves the supplied ID unchanged", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })
    const organizationId = 99

    // Act
    projectFactory.build({ organization, organizationId })

    // Assert
    assert.equal(organization.id, 42)
  })
})

test("when Sequelize 6 build receives an explicit null foreign key, it still attaches the supplied association", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const project = projectFactory.build({
      organization,
      // @ts-expect-error JavaScript consumers can explicitly retain a null foreign key.
      organizationId: null,
    })

    // Assert
    assert.equal(project.organization, organization)
  })
})

test("when Sequelize 6 build receives an explicit null foreign key, it does not replace it with the supplied ID", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const project = projectFactory.build({
      organization,
      // @ts-expect-error JavaScript consumers can explicitly retain a null foreign key.
      organizationId: null,
    })

    // Assert
    assert.equal(project.organizationId, null)
  })
})

test("when Sequelize 6 params supplies an association, it overrides association defaults in build", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const associationDefault = organizationFactory.build()
    const organization = organizationFactory.build()
    const configuredFactory = projectFactory
      .associations({ organization: associationDefault })
      .params({ organization })

    // Act
    const project = configuredFactory.build()

    // Assert
    assert.equal(project.organization, organization)
  })
})

test("when Sequelize 6 build receives an association parameter, it overrides configured defaults", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const associationDefault = organizationFactory.build()
    const paramsDefault = organizationFactory.build()
    const organization = organizationFactory.build()
    const configuredFactory = projectFactory
      .associations({ organization: associationDefault })
      .params({ organization: paramsDefault })

    // Act
    const project = configuredFactory.build({ organization })

    // Assert
    assert.equal(project.organization, organization)
  })
})

test("when Sequelize 6 attributesFor receives a supplied association, it includes its inferred scalar foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const attributes = projectFactory.attributesFor({ organization })

    // Assert
    assert.equal(attributes.organizationId, organization.id)
  })
})

test("when Sequelize 6 attributesFor receives a supplied association, it excludes the association model property", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const attributes = projectFactory.attributesFor({ organization })

    // Assert
    assert.equal("organization" in attributes, false)
  })
})

test("when Sequelize 6 build receives an invalid supplied association, it preserves the model validation error", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const organization = { id: 42 }

    // Act / Assert
    assert.throws(
      () =>
        projectFactory.build({
          // @ts-expect-error Invalid JavaScript consumers still receive a useful runtime error.
          organization,
        }),
      /Invalid association instance provided for "organization"\. Expected Model instance\./
    )
  })
})

test("when Sequelize 6 build receives a supplied association, its ID overrides a generated foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, Category }) => {
    const organization = organizationFactory.build({ id: 42 })
    const generatedCategoryFactory = FactoryShark.define(Category, ({ associate }) => {
      associate("organization", organizationFactory)

      return {
        name: "Generated category",
        organizationId: 99,
      }
    }).associations({ organization })

    // Act
    const category = generatedCategoryFactory.build()

    // Assert
    assert.equal(category.organizationId, organization.id)
  })
})

test("when Sequelize 6 build receives a supplied association, it does not fabricate an ID on that model", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()

    // Act
    projectFactory.build({ organization })

    // Assert
    assert.equal(organization.get("id"), null)
  })
})

test("when Sequelize 6 build receives a supplied association, it performs no database queries", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, sequelize }) => {
    const organization = organizationFactory.build({ id: 42 })
    let queryCount = 0
    sequelize.addHook("beforeQuery", () => {
      queryCount += 1
    })

    // Act
    projectFactory.build({ organization })

    // Assert
    assert.equal(queryCount, 0)
  })
})

test("when Sequelize 6 attributesFor receives a supplied association, it performs no database queries", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, sequelize }) => {
    const organization = organizationFactory.build({ id: 42 })
    let queryCount = 0
    sequelize.addHook("beforeQuery", () => {
      queryCount += 1
    })

    // Act
    projectFactory.attributesFor({ organization })

    // Assert
    assert.equal(queryCount, 0)
  })
})

test("when Sequelize 6 build receives a supplied association, it runs no create hooks", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()
    const hookEvents: string[] = []
    const configuredFactory = projectFactory
      .beforeCreate(() => {
        hookEvents.push("before")
      })
      .afterCreate(async () => {
        hookEvents.push("after")
      })

    // Act
    configuredFactory.build({ organization })

    // Assert
    assert.deepEqual(hookEvents, [])
  })
})

test("when Sequelize 6 attributesFor receives a supplied association, it runs no create hooks", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()
    const hookEvents: string[] = []
    const configuredFactory = projectFactory
      .beforeCreate(() => {
        hookEvents.push("before")
      })
      .afterCreate(async () => {
        hookEvents.push("after")
      })

    // Act
    configuredFactory.attributesFor({ organization })

    // Assert
    assert.deepEqual(hookEvents, [])
  })
})

test("when attributesFor receives a Sequelize 6 Date, it preserves the Date value", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const observedAt = new Date("2026-11-09T12:34:56.789Z")

    // Act
    const attributes = organizationFactory.attributesFor({ observedAt })

    // Assert
    assert.deepEqual(attributes.observedAt, observedAt)
  })
})

test("when attributesFor receives Sequelize 6 binary data, it preserves bytes without invoking the custom getter", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const payload = Buffer.from([0, 127, 128, 255, 195, 40])

    // Act
    const attributes = organizationFactory.attributesFor({ payload })

    // Assert
    assert.deepEqual(attributes.payload, payload)
  })
})

test("when attributesFor evaluates Sequelize 6 associations, it does not persist the parent", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    // Act
    projectFactory.attributesFor()

    // Assert
    const projectCount = await Project.count()
    assert.equal(projectCount, 0)
  })
})

test("when attributesFor evaluates Sequelize 6 associations, it does not persist their organizations", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization }) => {
    // Act
    projectFactory.attributesFor()

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 0)
  })
})

test("when attributesFor receives a Sequelize 6 foreign key, model-property association placeholders are excluded", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const organizationId = 42

    // Act
    const attributes = projectFactory.attributesFor({ organizationId })

    // Assert
    assert.equal("organization" in attributes, false)
  })
})

test("when both Sequelize installations are loaded, the root API selects each supplied model's ORM", async () => {
  // Arrange
  await withMixedFixtures(async (sequelizeV6, sequelizeV7) => {
    // Act
    const v6Project = FactoryShark.define(sequelizeV6.Project, () => ({
      title: "Root API v6 project",
      nullableNote: null,
      metadata: {
        source: "root API v6",
      },
    })).build()
    const v7Project = FactoryShark.define(sequelizeV7.Project, () => ({
      title: "Root API v7 project",
    })).build()

    // Assert
    assert.equal(v6Project instanceof sequelizeV6.Project, true)
    assert.equal(v7Project instanceof sequelizeV7.Project, true)
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

test("when nested belongsTo associations are created, the lazy override receives the resolved foreign key", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Category }) => {
    // Act
    const project = await projectFactory.create()

    // Assert
    const category = await Category.findByPk(project.categoryId)
    assert.equal(category?.organizationId, project.organizationId)
  })
})

test("when a persisted foreign key is supplied, create does not duplicate its organization", async () => {
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

test("when a persisted association instance is supplied, create uses its foreign key", async () => {
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

test("when a persisted association instance is supplied, create does not duplicate it", async () => {
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

test("when createList is called with Sequelize 6, it persists the requested projects", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    const count = 2

    // Act
    await projectFactory.createList(count)

    // Assert
    const persistedProjects = await Project.findAll({
      attributes: ["title"],
      order: [["id", "ASC"]],
      raw: true,
    })
    assert.deepEqual(persistedProjects, [{ title: "Project 1" }, { title: "Project 2" }])
  })
})

test("when a Sequelize 6 list has a configured organization, every persisted project retains that relationship", async () => {
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

test("when a Sequelize 6 list has a configured organization, it does not replace that organization", async () => {
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

test("when a generator registers associations, it runs once", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, Project }) => {
    let generatorEvaluations = 0
    const projectFactory = FactoryShark.define(Project, ({ sequence, associate }) => {
      generatorEvaluations += 1
      associate("organization", organizationFactory)

      return {
        title: `Generated project ${sequence}`,
        nullableNote: null,
        metadata: {
          source: "generator",
        },
      }
    })

    // Act
    projectFactory.build()

    // Assert
    assert.equal(generatorEvaluations, 1)
  })
})

test("when a configured factory clone is used, each builder keeps an independent sequence", async () => {
  // Arrange
  await withFixture(async ({ Project }) => {
    type TitleOptions = {
      prefix: string
    }

    const titleFactory = FactoryShark.define<ProjectRecord, TitleOptions>(
      Project,
      ({ sequence, transient }) => ({
        title: `${transient.prefix}${sequence}`,
        nullableNote: null,
        metadata: {
          source: "transient",
        },
      })
    )
    const baseFactory = titleFactory.transient({
      prefix: "Base ",
    })
    const clonedFactory = baseFactory.transient({
      prefix: "Clone ",
    })

    // Act
    baseFactory.build()
    clonedFactory.build()
    const nextBaseProject = baseFactory.build()

    // Assert
    assert.equal(nextBaseProject.title, "Base 2")
  })
})

test("when create hooks run, beforeCreate sees the resolved model and afterCreate sees the saved model", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const hookEvents: string[] = []
    const observedFactory = projectFactory
      .beforeCreate((project) => {
        hookEvents.push(`before:${project.isNewRecord}:${project.organizationId}`)
      })
      .afterCreate(async (project) => {
        hookEvents.push(`after:${project.isNewRecord}:${project.id}`)
      })

    // Act
    const project = await observedFactory.create()

    // Assert
    assert.deepEqual(hookEvents, [
      `before:true:${project.organizationId}`,
      `after:false:${project.id}`,
    ])
  })
})

test("when a beforeCreate hook throws, create propagates its error", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    const hookError = new Error("Sequelize 6 before hook failed")
    const failingFactory = projectFactory.beforeCreate(() => {
      throw hookError
    })

    // Act / Assert
    await assert.rejects(failingFactory.create(), (error) => error === hookError)
  })
})

// These compile-only scenarios never run; tsc fails if invalid input becomes accepted.
export function checkSequelizeV6FactoryTypes({ Project, Organization }: SequelizeV6Fixture) {
  const projectFactory = FactoryShark.define(Project, () => ({
    title: "Typed project",
    nullableNote: null,
    metadata: {
      source: "typed",
    },
  }))
  const builtProject: ProjectRecord = projectFactory.build({
    nullableNote: null,
  })
  const modelClass: ModelStatic<ProjectRecord> = projectFactory.modelClass
  const directModelRows: Promise<ProjectRecord[]> = projectFactory.modelClass.findAll()
  const configuredModelRows: Promise<ProjectRecord[]> = projectFactory
    .params({
      title: "Configured project",
    })
    .modelClass.findAll()
  const chainedModelClass: ModelStatic<ProjectRecord> = projectFactory.beforeCreate((project) => {
    project.title = "Changed by typed hook"
  }).modelClass
  const factoryContract: FactoryInterface<ProjectRecord> = projectFactory
  void builtProject
  void modelClass
  void chainedModelClass
  void factoryContract
  void directModelRows
  void configuredModelRows

  const directList: Promise<ProjectRecord[]> = projectFactory.createList(2, {
    nullableNote: null,
    metadata: {
      source: "typed list",
    },
  })
  const configuredFactory = projectFactory.params({
    title: "Configured list",
  })
  const configuredList: Promise<ProjectRecord[]> = configuredFactory.createList(2)
  const contractList: Promise<ProjectRecord[]> = factoryContract.createList(2)
  void directList
  void configuredList
  void contractList

  const directAttributes: InferCreationAttributes<ProjectRecord> = projectFactory.attributesFor({
    nullableNote: null,
    metadata: {
      source: "typed attributes",
    },
  })
  const configuredAttributes: InferCreationAttributes<ProjectRecord> =
    configuredFactory.attributesFor()
  const contractAttributes: InferCreationAttributes<ProjectRecord> = factoryContract.attributesFor()
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
  projectFactory.attributesFor({ unknownAttribute: true })

  // @ts-expect-error Configured attribute overrides preserve non-nullable types.
  configuredFactory.attributesFor({ title: null })

  // @ts-expect-error Attribute association overrides require a model instance.
  configuredFactory.attributesFor({ organization: "not an organization" })

  // @ts-expect-error Attribute results are not model instances.
  projectFactory.attributesFor().save()

  // @ts-expect-error List counts must be numbers.
  projectFactory.createList("2")

  // @ts-expect-error List parameters reject unknown attributes.
  projectFactory.createList(2, { unknownAttribute: true })

  // @ts-expect-error Configured lists preserve non-nullable attribute types.
  configuredFactory.createList(2, { title: null })

  // @ts-expect-error List associations require Sequelize model instances.
  configuredFactory.createList(2, { organization: "not an organization" })

  const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
    name: `Typed organization ${sequence}`,
  }))
  const factoryContext = new FactoryContext(Project)
  factoryContext.associate<OrganizationRecord>("organization", organizationFactory)
  const registration = factoryContext.registrations[0]
  registration.instance.get("id")
  const isNewRecord: boolean = registration.instance.isNewRecord
  void isNewRecord
  void registration.create({}).then((model) => model.get("id"))

  const validAssociationFactory = FactoryShark.define(Project, ({ associate }) => {
    associate<OrganizationRecord>("organization", organizationFactory)

    return {
      title: "Associated typed project",
      nullableNote: null,
      metadata: {
        source: "typed association",
      },
    }
  })
  void validAssociationFactory

  FactoryShark.define(Project, () => ({
    // @ts-expect-error Non-nullable attributes reject null.
    title: null,
    nullableNote: null,
  }))

  // @ts-expect-error Factory parameters reject unknown attribute names.
  projectFactory.create({ unknownAttribute: true })

  // @ts-expect-error Association parameters require a Sequelize model instance.
  projectFactory.create({ organization: "not an organization" })

  FactoryShark.define(Project, () => ({
    title: "Valid generator result",
    nullableNote: null,
    metadata: {
      source: "typed generator",
    },
    // @ts-expect-error Generator results reject unknown attribute names.
    unknownAttribute: true,
  }))

  FactoryShark.define(Project, ({ associate }) => {
    // @ts-expect-error Association registration rejects unknown association names.
    associate("notAnAssociation", organizationFactory)

    // @ts-expect-error Scalar attributes cannot be association names.
    associate("title", organizationFactory)

    // @ts-expect-error JSON attributes cannot be association names.
    associate("metadata", organizationFactory)

    return {
      title: "Invalid association typing",
      nullableNote: null,
      metadata: {
        source: "invalid association",
      },
    }
  })

  const nullableParams: FactoryParams<ProjectRecord> = {
    nullableNote: null,
  }
  const optionalParams: FactoryParams<ProjectRecord> = {
    title: "Only an explicit override",
  }
  projectFactory.build(nullableParams)
  projectFactory.build(optionalParams)

  const invalidFactoryParams: FactoryParams<ProjectRecord> = {
    // @ts-expect-error Factory parameters preserve non-nullable attribute types.
    title: null,
  }
  void invalidFactoryParams
}
