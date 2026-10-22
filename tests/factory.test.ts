// Adapted from upstream FactoryShark acceptance tests at 24ce6097a1f2c4d87a09dddcec88e33b8859782b; scenarios use standalone node:test and real SQLite persistence.
import assert from "node:assert/strict"
import { test } from "node:test"

import { FactoryShark } from "../src/index.js"
import { createFixture, type Fixture, type ProjectRecord } from "./support.js"

async function withFixture(run: (fixture: Fixture) => Promise<void>) {
  const fixture = createFixture()
  try {
    await fixture.sequelize.sync({ force: true })
    await run(fixture)
  } finally {
    await fixture.sequelize.close()
  }
}

test("when build is called, it returns an unsaved model without creating associations", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Organization, Category }) => {
    // Act
    const project = projectFactory.build()

    // Assert
    assert.equal(project.isNewRecord, true)
    assert.equal(await Organization.count(), 0)
    assert.equal(await Category.count(), 0)
  })
})

test("when create is called, it persists the model and independently created associations", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Project, Organization, Category, User }) => {
    // Act
    const project = await projectFactory.create()

    // Assert
    assert.equal(project.isNewRecord, false)
    assert.equal(await Project.count(), 1)
    assert.equal(await Organization.count(), 1)
    assert.equal(await Category.count(), 1)
    assert.equal(await User.count(), 1)
  })
})

test("when a foreign key is overridden, that association is not created but other associations are", async () => {
  await withFixture(async ({ organizationFactory, projectFactory, Organization, Category, User }) => {
    // Arrange
    const organization = await organizationFactory.create()

    // Act
    const project = await projectFactory.create({ organizationId: organization.id })

    // Assert
    assert.equal(project.organizationId, organization.id)
    assert.equal(await Organization.count(), 1)
    assert.equal(await Category.count(), 1)
    assert.equal(await User.count(), 1)
  })
})

test("when a prebuilt association is supplied, create uses it without creating a replacement", async () => {
  await withFixture(async ({ organizationFactory, projectFactory, Organization }) => {
    // Arrange
    const organization = await organizationFactory.create()

    // Act
    const project = await projectFactory.associations({ organization }).create()

    // Assert
    assert.equal(project.organizationId, organization.id)
    assert.equal(await Organization.count(), 1)
  })
})

test("when an association callback uses an earlier association key, dependent records share the key", async () => {
  // Arrange
  await withFixture(async ({ projectFactory, Category, Organization }) => {
    // Act
    const project = await projectFactory.create()

    // Assert
    const category = await Category.findByPk(project.categoryId)
    assert.equal(category?.organizationId, project.organizationId)
    assert.equal(await Organization.count(), 1)
  })
})

test("when an association callback is conditional on a supplied foreign key, it avoids duplicate creation", async () => {
  await withFixture(async ({ organizationFactory, Project, Category, User, Organization }) => {
    // Arrange
    const organization = await organizationFactory.create()
    const conditionalFactory = FactoryShark.define(Project, ({ associate, sequence, params }) => {
      if (params.organizationId === undefined) associate("organization", organizationFactory)
      associate("category", FactoryShark.define(Category, ({ sequence: categorySequence }) => ({
        name: `Category ${categorySequence}`,
        organizationId: organization.id,
      })))
      associate("creator", FactoryShark.define(User, ({ sequence: userSequence }) => ({ name: `User ${userSequence}` })))
      return { title: `Conditional ${sequence}` }
    })

    // Act
    const project = await conditionalFactory.create({ organizationId: organization.id })

    // Assert
    assert.equal(project.organizationId, organization.id)
    assert.equal(await Organization.count(), 1)
  })
})

test("when explicit attributes and factory defaults conflict, call parameters take precedence", async () => {
  await withFixture(async ({ projectFactory }) => {
    // Arrange
    const factory = projectFactory.params({ title: "Factory default" })

    // Act
    const project = await factory.create({ title: "Call override" })

    // Assert
    assert.equal(project.title, "Call override")
  })
})

test("when transient defaults are chained, both defaults affect generated attributes", async () => {
  await withFixture(async ({ Project }) => {
    // Arrange
    type ProjectOptions = { prefix?: string; suffix?: string }
    const factory = FactoryShark.define<ProjectRecord, ProjectOptions>(Project, ({ sequence, transient }) => ({
      title: `${transient.prefix ?? ""}Project ${sequence}${transient.suffix ?? ""}`,
    })).transient({ prefix: "[" }).transient({ suffix: "]" })

    // Act
    const project = factory.build()

    // Assert
    assert.equal(project.title, "[Project 1]")
  })
})

test("when factory sequence values are evaluated, build and create use increasing values", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const sequenceFactory = FactoryShark.define(Organization, ({ sequence }) => ({ name: `Organization ${sequence}` }))

    // Act
    const built = sequenceFactory.build()
    const created = await sequenceFactory.create()

    // Assert
    assert.equal(built.name, "Organization 1")
    assert.equal(created.name, "Organization 2")
    assert.equal(await Organization.count(), 1)
  })
})

test("when a generator registers an association, it is evaluated once per build or create", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, Project, Category, User }) => {
    let evaluations = 0
    const factory = FactoryShark.define(Project, ({ sequence, associate }) => {
      evaluations += 1
      associate("organization", organizationFactory)
      associate("category", FactoryShark.define(Category, ({ sequence: categorySequence }) => ({
        name: `Category ${categorySequence}`,
        organizationId: 1,
      })))
      associate("creator", FactoryShark.define(User, ({ sequence: userSequence }) => ({ name: `User ${userSequence}` })))
      return { title: `Project ${sequence}` }
    })

    // Act
    factory.build()
    await factory.create()

    // Assert
    assert.equal(evaluations, 2)
  })
})

test("when beforeCreate runs, resolved foreign keys are available before persistence", async () => {
  await withFixture(async ({ projectFactory }) => {
    // Arrange
    let resolvedOrganizationId: number | undefined
    const factory = projectFactory.beforeCreate((project) => {
      resolvedOrganizationId = project.organizationId
      project.title = `Organization ${project.organizationId}`
    })

    // Act
    const project = await factory.create()

    // Assert
    assert.equal(resolvedOrganizationId, project.organizationId)
    assert.equal(project.title, `Organization ${project.organizationId}`)
  })
})

test("when beforeCreate throws, create rejects with the hook error", async () => {
  await withFixture(async ({ Project }) => {
    // Arrange
    const factory = FactoryShark.define(Project, ({ sequence }) => ({ title: `Project ${sequence}` }))
      .beforeCreate(() => { throw new Error("before hook failed") })

    // Act / Assert
    await assert.rejects(factory.create(), /before hook failed/)
    assert.equal(await Project.count(), 0)
  })
})

test("when afterCreate runs, it receives the saved model and runs after beforeCreate", async () => {
  await withFixture(async ({ projectFactory }) => {
    // Arrange
    const events: string[] = []
    const factory = projectFactory
      .beforeCreate((project) => { events.push(`before:${project.isNewRecord}`) })
      .afterCreate(async (project) => { events.push(`after:${project.isNewRecord}:${project.id}`) })

    // Act
    const project = await factory.create()

    // Assert
    assert.deepEqual(events, ["before:true", `after:false:${project.id}`])
  })
})

test("when a factory is built, create hooks do not run", async () => {
  await withFixture(async ({ projectFactory }) => {
    // Arrange
    let calls = 0
    const factory = projectFactory.beforeCreate(() => { calls += 1 }).afterCreate(async () => { calls += 1 })

    // Act
    factory.build()

    // Assert
    assert.equal(calls, 0)
  })
})

test("when an invalid association name is configured, build reports the invalid association", async () => {
  await withFixture(async ({ organizationFactory, Project }) => {
    // Arrange
    const factory = FactoryShark.define(Project, ({ associate }) => {
      // @ts-expect-error Runtime behavior is covered for invalid JavaScript consumers.
      associate("missing", organizationFactory)
      return { title: "Invalid association test" }
    })

    // Act / Assert
    assert.throws(() => factory.build(), /missing/i)
    assert.equal(await Project.count(), 0)
  })
})

// Type-only scenarios are compiled with the suite's separate tsc pass.
export function checkFactoryTypes({ Project, User }: Fixture) {
  const typedFactory = FactoryShark.define(Project, () => ({ title: "Typed project" }))
  typedFactory.create({ title: "Allowed", organizationId: 1 })
  // @ts-expect-error Unknown factory parameter keys are rejected.
  typedFactory.create({ unknown: true })
  // @ts-expect-error Association parameters require an instance of the associated model.
  typedFactory.create({ organization: "not an organization" })
  FactoryShark.define(Project, () => ({
    title: "Valid generator result",
    // @ts-expect-error Generator excess properties are rejected.
    notAProjectField: true,
  }))
  FactoryShark.define(Project, ({ associate }) => {
    // @ts-expect-error Non-association names are rejected.
    associate("notAnAssociation", FactoryShark.define(User, () => ({ name: "Typed user" })))
    return { title: "Typed association" }
  })
}
