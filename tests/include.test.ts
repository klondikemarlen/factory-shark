import assert from "node:assert/strict"
import { test } from "node:test"

import { createFixture } from "@/tests/support.js"
import { createSequelizeV6Fixture } from "@/tests/sequelize-v6-support.js"
import type {
  CategoryRecord as SequelizeV7Category,
  Fixture,
  ProjectRecord as SequelizeV7Project,
} from "@/tests/support.js"
import type {
  CategoryRecord as SequelizeV6Category,
  ProjectRecord as SequelizeV6Project,
  SequelizeV6Fixture,
} from "@/tests/sequelize-v6-support.js"

import { FactoryShark } from "@/src/index.js"
import type { FactoryInclude } from "@/src/index.js"

type IncludeFixture = Fixture | SequelizeV6Fixture

type HookProject = {
  title: string
  category?: {
    organization?: {
      name: string
    }
  }
}

type HookOrganization = {
  id: number
}

type CategoryTransientParams = {
  prefix: string
}

async function withFixture<F extends IncludeFixture>(
  create: () => F,
  scenario: (fixture: F) => Promise<void>
): Promise<void> {
  const fixture = create()

  try {
    await fixture.sequelize.sync({
      force: true,
    })
    await scenario(fixture)
  } finally {
    await fixture.sequelize.close()
  }
}

function observeQueries(fixture: IncludeFixture): number[] {
  const queries: number[] = []
  const recordQuery = () => {
    queries.push(1)
  }

  if ("User" in fixture) {
    fixture.sequelize.hooks.addListener("beforeQuery", recordQuery)
  } else {
    fixture.sequelize.addHook("beforeQuery", recordQuery)
  }

  return queries
}

async function persistedTitles(fixture: IncludeFixture): Promise<string[]> {
  if ("User" in fixture) {
    const projects = await fixture.Project.findAll()
    return projects.map((project) => project.title)
  }

  const projects = await fixture.Project.findAll()
  return projects.map((project) => project.title)
}

for (const [version, create] of [
  ["Sequelize 6", createSequelizeV6Fixture],
  ["Sequelize 7", createFixture],
] as const) {
  test(`when ${version} includes a nested persisted relationship, create loads its missing graph`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(
      create,
      async ({ organizationFactory, categoryFactory, projectFactory }) => {
        const organization = await organizationFactory.create({
          name: "Persisted organization",
        })
        const category = await categoryFactory.create({
          organizationId: organization.id,
        })
        const configured = projectFactory.include({
          association: "category",
          include: ["organization"],
        })

        // Act
        const project = await configured.create({
          categoryId: category.id,
        })

        // Assert
        assert.equal(project.category?.organization?.name, "Persisted organization")
      }
    )
  })

  test(`when ${version} includes an association string, create performs a joined reload`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async (fixture) => {
      let reloads = 0
      const recordFind = () => {
        reloads += 1
      }
      if ("User" in fixture) {
        fixture.Project.hooks.addListener("afterFind", recordFind)
      } else {
        fixture.Project.addHook("afterFind", recordFind)
      }
      const configured = fixture.projectFactory.include("category")

      // Act
      await configured.create()

      // Assert
      assert.equal(reloads, 1)
    })
  })

  test(`when ${version} replaces include, it does not merge the previous invalid selection`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(
      create,
      async ({ projectFactory, categoryFactory, organizationFactory }) => {
        const organization = await organizationFactory.create({
          name: "Replacement organization",
        })
        const category = await categoryFactory.create({
          organizationId: organization.id,
        })
        const configured = projectFactory.include("missingRelationship").include({
          association: "category",
          include: ["organization"],
        })

        // Act
        const project = await configured.create({
          categoryId: category.id,
        })

        // Assert
        assert.equal(project.category?.organization?.name, "Replacement organization")
      }
    )
  })

  test(`when ${version} configures include, the source factory remains independent`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      projectFactory.include("missingRelationship")

      // Act
      const project = await projectFactory.create()

      // Assert
      assert.equal(project.isNewRecord, false)
    })
  })

  for (const selection of [undefined, []] as (undefined | [])[]) {
    const clearing = JSON.stringify(selection) ?? "undefined"
    test(`when ${version} clears include with ${clearing}, create skips native reload`, async () => {
      // Arrange
      await withFixture<IncludeFixture>(create, async (fixture) => {
        const { organizationFactory } = fixture
        const queries = observeQueries(fixture)
        const configured = organizationFactory.include("missingRelationship").include(selection)

        // Act
        await configured.create()

        // Assert
        assert.equal(queries.length, 1)
      })
    })
  }

  test(`when ${version} has no include, create does not reload`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async (fixture) => {
      const { organizationFactory } = fixture
      const queries = observeQueries(fixture)

      // Act
      await organizationFactory.create()

      // Assert
      assert.equal(queries.length, 1)
    })
  })

  test(`when ${version} clones an evaluated factory with include, its sequence starts independently`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      projectFactory.build()
      const configured = projectFactory.include("category")

      // Act
      const project = await configured.create()

      // Assert
      assert.equal(project.title, "Project 1")
    })
  })

  test(`when ${version} evaluates an include clone, the source sequence does not advance`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      projectFactory.build()
      const configured = projectFactory.include("category")
      await configured.createList(2)

      // Act
      const project = projectFactory.build()

      // Assert
      assert.equal(project.title, "Project 2")
    })
  })

  test(`when ${version} creates a list with include, it retains the selection on every item`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(
      create,
      async ({ categoryFactory, organizationFactory, projectFactory }) => {
        const organization = await organizationFactory.create({
          name: "List organization",
        })
        const category = await categoryFactory.create({
          organizationId: organization.id,
        })
        const configured = projectFactory.include({
          association: "category",
          include: ["organization"],
        })

        // Act
        const projects = await configured.createList(2, {
          categoryId: category.id,
        })

        // Assert
        assert.deepEqual(
          projects.map((project) => project.category?.organization?.name),
          ["List organization", "List organization"]
        )
      }
    )
  })

  test(`when ${version} creates a list with include, sequences and awaited hooks remain sequential`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      const events: string[] = []
      const configured = projectFactory
        .include("category")
        .afterCreate(async (project: HookProject) => {
          events.push(`start ${project.title}`)
          await Promise.resolve()
          events.push(`end ${project.title}`)
        })

      // Act
      await configured.createList(2)

      // Assert
      assert.deepEqual(events, [
        "start Project 1",
        "end Project 1",
        "start Project 2",
        "end Project 2",
      ])
    })
  })

  test(`when ${version} mutates a model in an after hook, include does not discard that unsaved mutation`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      const configured = projectFactory
        .include("category")
        .afterCreate(async (project: HookProject) => {
          project.title = "Unsaved hook title"
        })

      // Act
      const project = await configured.create()

      // Assert
      assert.equal(project.title, "Unsaved hook title")
    })
  })

  test(`when ${version} mutates a model after reload, persistence still has the saved title`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async (fixture) => {
      const { projectFactory } = fixture
      const configured = projectFactory
        .include("category")
        .afterCreate(async (project: HookProject) => {
          project.title = "Unsaved hook title"
        })

      // Act
      await configured.create()

      // Assert
      const titles = await persistedTitles(fixture)
      assert.deepEqual(titles, ["Project 1"])
    })
  })

  for (const operation of ["build", "attributesFor"] as const) {
    test(`when ${version} calls ${operation} with include, evaluation remains synchronous and query-free`, async () => {
      // Arrange
      await withFixture<IncludeFixture>(create, async (fixture) => {
        const { projectFactory } = fixture
        const queries = observeQueries(fixture)
        const configured = projectFactory.include("missingRelationship")

        // Act
        const result = configured[operation]()

        // Assert
        assert.equal(result instanceof Promise, false)
        assert.deepEqual(queries, [])
      })
    })
  }

  test(`when ${version} receives an invalid include, create propagates the native loading error`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      const configured = projectFactory.include("missingRelationship")

      // Act / Assert
      await assert.rejects(configured.create(), /missingRelationship/)
    })
  })

  test(`when ${version} reload fails, the newly saved record remains persisted`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async (fixture) => {
      const { projectFactory } = fixture
      const configured = projectFactory.include("missingRelationship")

      // Act
      await configured.create().catch(() => undefined)

      // Assert
      const titles = await persistedTitles(fixture)
      assert.deepEqual(titles, ["Project 1"])
    })
  })

  test(`when ${version} reload fails, configured after hooks do not run`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      const observedTitles: string[] = []
      const configured = projectFactory
        .include("missingRelationship")
        .afterCreate(async (project: HookProject) => {
          observedTitles.push(project.title)
        })

      // Act
      await configured.create().catch(() => undefined)

      // Assert
      assert.deepEqual(observedTitles, [])
    })
  })

  test(`when ${version} clones params and associations around include, all configured defaults survive`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(
      create,
      async ({ organizationFactory, categoryFactory, projectFactory }) => {
        const organization = await organizationFactory.create({
          name: "Configured organization",
        })
        const category = await categoryFactory.create({
          organizationId: organization.id,
        })
        const configured = projectFactory
          .associations({ category })
          .params({
            title: "Configured title",
          })
          .include({
            association: "category",
            include: ["organization"],
          })
          .params({
            categoryId: category.id,
          })

        // Act
        const project = await configured.create()

        // Assert
        assert.equal(project.category?.organization?.name, "Configured organization")
      }
    )
  })

  test(`when ${version} retains params after include, create uses its configured title`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async ({ projectFactory }) => {
      const configured = projectFactory
        .params({
          title: "Configured title",
        })
        .include("category")

      // Act
      const project = await configured.create()

      // Assert
      assert.equal(project.title, "Configured title")
    })
  })

  test(`when ${version} loads a persisted category, after hooks see a relationship absent from the attached category`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(
      create,
      async ({ organizationFactory, categoryFactory, projectFactory }) => {
        const organization = await organizationFactory.create({
          name: "Loaded before hooks",
        })
        const category = await categoryFactory.create({
          organizationId: organization.id,
        })
        const observedNames: (string | undefined)[] = []
        const configured = projectFactory
          .include({
            association: "category",
            include: ["organization"],
          })
          .afterCreate(async (project: HookProject) => {
            observedNames.push(project.category?.organization?.name)
          })

        // Act
        await configured.create({
          categoryId: category.id,
        })

        // Assert
        assert.deepEqual(observedNames, ["Loaded before hooks"])
      }
    )
  })

  test(`when ${version} after hooks create related rows, include does not pre-load those future rows`, async () => {
    // Arrange
    await withFixture<IncludeFixture>(create, async (fixture) => {
      if ("User" in fixture) {
        fixture.Organization.hasMany(fixture.Category, {
          as: "categories",
          foreignKey: "organizationId",
        })
      } else {
        fixture.Organization.hasMany(fixture.Category, {
          as: "categories",
          foreignKey: "organizationId",
        })
      }
      const configured = fixture.organizationFactory
        .include("categories")
        .afterCreate(async (organization: HookOrganization) => {
          await fixture.categoryFactory.create({
            organizationId: organization.id,
          })
        })

      // Act
      const organization = await configured.create()

      // Assert
      assert.deepEqual(organization.get("categories"), [])
    })
  })
}

// Model and association objects must retain their own ORM's native types rather
// than being widened to a shared cross-version include union.
test("when Sequelize 6 receives a model include, create loads its associated record", async () => {
  // Arrange
  await withFixture(
    createSequelizeV6Fixture,
    async ({ Organization, categoryFactory, organizationFactory }) => {
      const organization = await organizationFactory.create({
        name: "Native model target",
      })
      const configured = categoryFactory.include({
        model: Organization,
        as: "organization",
      })

      // Act
      const category = await configured.create({
        organizationId: organization.id,
      })

      // Assert
      assert.equal(category.get("organization")?.name, "Native model target")
    }
  )
})

test("when Sequelize 7 receives a model include, create loads its associated record", async () => {
  // Arrange
  await withFixture(
    createFixture,
    async ({ Organization, categoryFactory, organizationFactory }) => {
      const organization = await organizationFactory.create({
        name: "Native model target",
      })
      const configured = categoryFactory.include(Organization)

      // Act
      const category = await configured.create({
        organizationId: organization.id,
      })

      // Assert
      assert.equal(category.get("organization")?.name, "Native model target")
    }
  )
})

test("when Sequelize 6 receives a native association include, create loads its nested relationship", async () => {
  // Arrange
  await withFixture(
    createSequelizeV6Fixture,
    async ({ Project, projectFactory, categoryFactory, organizationFactory }) => {
      const organization = await organizationFactory.create({
        name: "Native association target",
      })
      const category = await categoryFactory.create({
        organizationId: organization.id,
      })
      const configured = projectFactory.include({
        association: Project.associations.category,
        include: ["organization"],
      })

      // Act
      const project = await configured.create({
        categoryId: category.id,
      })

      // Assert
      assert.equal(project.get("category")?.get("organization")?.name, "Native association target")
    }
  )
})

test("when Sequelize 7 receives a native association include, create loads its nested relationship", async () => {
  // Arrange
  await withFixture(
    createFixture,
    async ({ Project, projectFactory, categoryFactory, organizationFactory }) => {
      const organization = await organizationFactory.create({
        name: "Native association target",
      })
      const category = await categoryFactory.create({
        organizationId: organization.id,
      })
      const configured = projectFactory.include({
        association: Project.associations.category,
        include: ["organization"],
      })

      // Act
      const project = await configured.create({
        categoryId: category.id,
      })

      // Assert
      assert.equal(project.get("category")?.get("organization")?.name, "Native association target")
    }
  )
})

test("when Sequelize 6 includes a relationship, generator hooks retain transient and before-create configuration", async () => {
  // Arrange
  await withFixture(createSequelizeV6Fixture, async ({ Category, organizationFactory }) => {
    const organization = await organizationFactory.create({
      name: "Loaded for generator hook",
    })
    const observed: (string | undefined)[] = []
    const factory = FactoryShark.define<SequelizeV6Category, CategoryTransientParams>(
      Category,
      ({ sequence, transient, beforeCreate, afterCreate }) => {
        beforeCreate((category) => {
          category.name = `Saved ${category.name}`
        })

        afterCreate(async (category) => {
          observed.push(`${category.name}: ${category.organization?.name}`)
        })

        return {
          name: `${transient.prefix} ${sequence}`,
          organizationId: organization.id,
        }
      }
    )
    const configured = factory
      .transient({
        prefix: "Configured",
      })
      .include("organization")
      .params({})

    // Act
    await configured.create()

    // Assert
    assert.deepEqual(observed, ["Saved Configured 1: Loaded for generator hook"])
  })
})

test("when Sequelize 7 includes a relationship, generator hooks retain transient and before-create configuration", async () => {
  // Arrange
  await withFixture(createFixture, async ({ Category, organizationFactory }) => {
    const organization = await organizationFactory.create({
      name: "Loaded for generator hook",
    })
    const observed: (string | undefined)[] = []
    const factory = FactoryShark.define<SequelizeV7Category, CategoryTransientParams>(
      Category,
      ({ sequence, transient, beforeCreate, afterCreate }) => {
        beforeCreate((category) => {
          category.name = `Saved ${category.name}`
        })

        afterCreate(async (category) => {
          observed.push(`${category.name}: ${category.organization?.name}`)
        })

        return {
          name: `${transient.prefix} ${sequence}`,
          organizationId: organization.id,
        }
      }
    )
    const configured = factory
      .transient({
        prefix: "Configured",
      })
      .include("organization")
      .params({})

    // Act
    await configured.create()

    // Assert
    assert.deepEqual(observed, ["Saved Configured 1: Loaded for generator hook"])
  })
})

export function checkIncludeTypes(v6: SequelizeV6Fixture, v7: Fixture): void {
  const v6Selection: FactoryInclude<SequelizeV6Project> = {
    association: v6.Project.associations.category,
    include: [
      {
        model: v6.Organization,
        as: "organization",
      },
    ],
  }
  const v7Selection: FactoryInclude<SequelizeV7Project> = {
    association: v7.Project.associations.category,
    include: [
      {
        model: v7.Organization,
        as: "organization",
      },
    ],
  }
  v6.projectFactory
    .include(v6Selection)
    .params({
      title: "Typed v6",
    })
    .include(undefined)
  v7.projectFactory
    .include(v7Selection)
    .params({
      title: "Typed v7",
    })
    .include([])

  // @ts-expect-error Include is not a scalar number.
  v6.projectFactory.include(42)
  // @ts-expect-error Include is not a scalar number.
  v7.projectFactory.include(42)
  // @ts-expect-error Native nested includes reject invalid scalar values.
  v6.projectFactory.include({ include: [false] })
  // @ts-expect-error Native nested includes reject invalid scalar values.
  v7.projectFactory.include({ include: [false] })
  // @ts-expect-error Reload options cannot be passed through the include API.
  v6.projectFactory.include({ transaction: null })
  // @ts-expect-error Reload options cannot be passed through the include API.
  v7.projectFactory.include({ transaction: null })

  FactoryShark.define(v6.Organization, () => ({
    name: "Original v6",
  })).include([])
  FactoryShark.define(v7.Organization, () => ({
    name: "Original v7",
  })).include([])
}
