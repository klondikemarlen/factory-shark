import assert from "node:assert/strict"
import { test } from "node:test"

import type { ModelStatic } from "sequelize"

import { createSequelizeV6Fixture } from "./sequelize-v6-support.js"
import { ProjectRecord as SequelizeV7ProjectRecord } from "./support.js"
import type {
  OrganizationRecord,
  ProjectRecord,
  SequelizeV6Fixture,
} from "./sequelize-v6-support.js"

import { FactoryContext, FactoryShark } from "../src/sequelize-v6.js"
import type { FactoryInterface, FactoryParams } from "../src/sequelize-v6.js"

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

test("when build is called, it returns an unsaved Sequelize 6 model", async () => {
  // Arrange
  await withFixture(async ({ projectFactory }) => {
    // Act
    const project = projectFactory.build()

    // Assert
    assert.equal(project.isNewRecord, true)
  })
})

test("when a Sequelize 7 model class is passed to the v6 entry point, define rejects it", () => {
  // Arrange
  const v7ModelClass = SequelizeV7ProjectRecord as unknown as ModelStatic<ProjectRecord>

  // Act / Assert
  assert.throws(
    () =>
      FactoryShark.define(v7ModelClass, () => ({
        title: "Wrong version",
        nullableNote: null,
        metadata: {
          source: "wrong version",
        },
      })),
    /This factory requires a Sequelize v6 Model class\./
  )
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

  const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
    name: `Typed organization ${sequence}`,
  }))
  const factoryContext = new FactoryContext(Project)
  factoryContext.associate<OrganizationRecord>("organization", organizationFactory)
  const registration = factoryContext.registrations[0]
  registration.instance.get("id")
  registration.instance.isNewRecord
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
