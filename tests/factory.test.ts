// Adapted from WRAP FactoryShark acceptance tests at 24ce6097a1f2c4d87a09dddcec88e33b8859782b under Apache-2.0; rewritten as isolated standalone scenarios.
import assert from "node:assert/strict"
import { test } from "node:test"

import { isUndefined } from "lodash"

import { AssociationNotFoundError, FactoryShark } from "../src/index.js"
import { createFixture } from "./support.js"
import type { Fixture, ProjectRecord } from "./support.js"

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

test("when build evaluates an association graph, no records are persisted", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project, Organization, Category, User }) => {
    // Act
    projectFactory.build()

    // Assert
    const projectCount = await Project.count()
    assert.equal(projectCount, 0)

    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 0)

    const categoryCount = await Category.count()
    assert.equal(categoryCount, 0)

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

test("when create evaluates an association graph, all associated records are persisted", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization, Category, User }) => {
    // Act
    await projectFactory.create()

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 1)

    const categoryCount = await Category.count()
    assert.equal(categoryCount, 1)

    const userCount = await User.count()
    assert.equal(userCount, 1)
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

test("when a foreign key is supplied, create still persists the other associations", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, Category, User }) => {
    const organization = await organizationFactory.create()

    // Act
    await projectFactory.create({
      organizationId: organization.id,
    })

    // Assert
    const categoryCount = await Category.count()
    assert.equal(categoryCount, 1)

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

test("when an association callback reuses an earlier foreign key, no extra organization is created", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization }) => {
    // Act
    await projectFactory.create()

    // Assert
    const organizationCount = await Organization.count()
    assert.equal(organizationCount, 1)
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

test("when one factory evaluates build then create, its sequence increases across both", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
      name: `Organization ${sequence}`,
    }))

    // Act
    const builtOrganization = organizationFactory.build()
    const createdOrganization = await organizationFactory.create()

    // Assert
    assert.equal(builtOrganization.name, "Organization 1")
    assert.equal(createdOrganization.name, "Organization 2")
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

test("when beforeCreate throws, the parent record is not saved", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project }) => {
    const failingFactory = projectFactory.beforeCreate(() => {
      throw new Error("before hook failed")
    })

    // Act
    await assert.rejects(failingFactory.create(), /before hook failed/)

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
export function checkFactoryTypes({ Project, User }: Fixture) {
  const projectFactory = FactoryShark.define(Project, () => ({
    title: "Typed project",
  }))

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
