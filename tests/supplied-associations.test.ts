import assert from "node:assert/strict"
import { test } from "node:test"

import { createFixture } from "@/tests/support.js"
import type { Fixture } from "@/tests/support.js"

import { FactoryShark } from "@/src/index.js"

type FixtureScenario = (fixture: Fixture) => Promise<void>

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

test("when build receives a supplied association, it preserves model identity", async () => {
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

test("when build receives a supplied nested association, it preserves the nested graph", async () => {
  // Arrange
  await withFixture(async ({ categoryFactory, projectFactory }) => {
    const category = categoryFactory.build()

    // Act
    const project = projectFactory.build({ category })

    // Assert
    assert.equal(project.category?.organization, category.organization)
  })
})

test("when build receives a supplied association with an ID, it fills the scalar foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const project = projectFactory.build({ organization, organizationId: undefined })

    // Assert
    assert.equal(project.get("organizationId"), organization.id)
  })
})

test("when build receives a supplied association without an ID, it does not invent a foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()

    // Act
    const project = projectFactory.build({ organization })

    // Assert
    assert.equal(project.organizationId, undefined)
  })
})

test("when build receives an unsaved supplied association, it leaves that model unsaved", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()

    // Act
    projectFactory.build({ organization })

    // Assert
    assert.equal(organization.isNewRecord, true)
  })
})

test("when build receives a supplied association and an explicit foreign key, it attaches an ID placeholder", async () => {
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

test("when build receives a supplied association and an explicit foreign key, it leaves the supplied ID unchanged", async () => {
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

test("when build receives an explicit null foreign key, it still attaches the supplied association", async () => {
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

test("when build receives an explicit null foreign key, it does not replace it with the supplied ID", async () => {
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

test("when params supplies an association, it overrides association defaults in build", async () => {
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

test("when build receives an association parameter, it overrides configured defaults", async () => {
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

test("when attributesFor receives a supplied association, it includes its inferred scalar foreign key", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const attributes = projectFactory.attributesFor({ organization })

    // Assert
    assert.equal(attributes.organizationId, organization.id)
  })
})

test("when attributesFor receives a supplied association, it excludes the association model property", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build({ id: 42 })

    // Act
    const attributes = projectFactory.attributesFor({ organization })

    // Assert
    assert.equal("organization" in attributes, false)
  })
})

test("when build receives an invalid supplied association, it preserves the model validation error", async () => {
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

test("when build receives a supplied association, its ID overrides a generated foreign key", async () => {
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

test("when build receives a supplied association, it does not fabricate an ID on that model", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory }) => {
    const organization = organizationFactory.build()

    // Act
    projectFactory.build({ organization })

    // Assert
    assert.equal(organization.get("id"), null)
  })
})

test("when build receives a supplied association, it performs no database queries", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, sequelize }) => {
    const organization = organizationFactory.build({ id: 42 })
    let queryCount = 0
    sequelize.hooks.addListener("beforeQuery", () => {
      queryCount += 1
    })

    // Act
    projectFactory.build({ organization })

    // Assert
    assert.equal(queryCount, 0)
  })
})

test("when attributesFor receives a supplied association, it performs no database queries", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory, projectFactory, sequelize }) => {
    const organization = organizationFactory.build({ id: 42 })
    let queryCount = 0
    sequelize.hooks.addListener("beforeQuery", () => {
      queryCount += 1
    })

    // Act
    projectFactory.attributesFor({ organization })

    // Assert
    assert.equal(queryCount, 0)
  })
})

test("when build receives a supplied association, it runs no create hooks", async () => {
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

test("when attributesFor receives a supplied association, it runs no create hooks", async () => {
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
