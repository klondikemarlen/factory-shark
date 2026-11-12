import assert from "node:assert/strict"
import { setImmediate } from "node:timers/promises"
import { test } from "node:test"

import { createFixture } from "@/tests/support.js"
import { createSequelizeV6Fixture } from "@/tests/sequelize-v6-support.js"
import type {
  Fixture,
  OrganizationRecord as SequelizeV7Organization,
  ProjectRecord as SequelizeV7Project,
} from "@/tests/support.js"
import type {
  OrganizationRecord as SequelizeV6Organization,
  ProjectRecord as SequelizeV6Project,
  SequelizeV6Fixture,
} from "@/tests/sequelize-v6-support.js"

import { FactoryShark } from "@/src/index.js"
import type { FactoryInterface, FactoryParams } from "@/src/index.js"

type ManyFixture = Fixture | SequelizeV6Fixture

type NameOptions = {
  prefix?: string
}

type HookOrganization = {
  name: string
  isNewRecord: boolean
}

type HookProject = {
  category?: {
    name: string
  }
}

type NameContext = {
  sequence: number
  transient: NameOptions
  beforeCreate: (hook: (model: HookOrganization) => Promise<void>) => void
  afterCreate: (hook: (model: HookOrganization) => Promise<void>) => void
}

type OrganizationAttributes = {
  name: string
}

async function withFixture<F extends ManyFixture>(
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

function defineOrganization(
  fixture: ManyFixture,
  generator: (context: NameContext) => OrganizationAttributes
) {
  if ("User" in fixture) {
    return FactoryShark.define<SequelizeV7Organization, NameOptions>(
      fixture.Organization,
      generator
    )
  }

  return FactoryShark.define<SequelizeV6Organization, NameOptions>(fixture.Organization, generator)
}

async function persistedNames(fixture: ManyFixture): Promise<string[]> {
  if ("User" in fixture) {
    const organizations = await fixture.Organization.findAll({
      order: [["id", "ASC"]],
    })
    return organizations.map((organization) => organization.name)
  }

  const organizations = await fixture.Organization.findAll({
    order: [["id", "ASC"]],
  })
  return organizations.map((organization) => organization.name)
}

for (const [version, create] of [
  ["Sequelize 6", createSequelizeV6Fixture],
  ["Sequelize 7", createFixture],
] as const) {
  test(`when ${version} creates many on the original factory, results follow input order`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async ({ organizationFactory }) => {
      const paramsList = [
        {
          name: "Second alphabetically",
        },
        {
          name: "First alphabetically",
        },
      ]

      // Act
      const organizations = await organizationFactory.createMany(paramsList)

      // Assert
      assert.deepEqual(
        organizations.map((organization) => organization.name),
        ["Second alphabetically", "First alphabetically"]
      )
    })
  })

  test(`when ${version} creates many, every input persists its own attributes`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const paramsList = [
        {
          name: "First saved",
        },
        {
          name: "Second saved",
        },
      ]

      // Act
      await fixture.organizationFactory.createMany(paramsList)

      // Assert
      const names = await persistedNames(fixture)
      assert.deepEqual(names, ["First saved", "Second saved"])
    })
  })

  test(`when ${version} creates many on a configured factory, each input overrides only its own defaults`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async ({ organizationFactory }) => {
      const configured = organizationFactory.params({
        name: "Configured default",
      })
      const paramsList = [
        {},
        {
          name: "Explicit override",
        },
        {},
      ]

      // Act
      const organizations = await configured.createMany(paramsList)

      // Assert
      assert.deepEqual(
        organizations.map((organization) => organization.name),
        ["Configured default", "Explicit override", "Configured default"]
      )
    })
  })

  test(`when ${version} creates many with transient options, every evaluation retains the configuration`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const factory = defineOrganization(fixture, ({ sequence, transient }) => ({
        name: `${transient.prefix}${sequence}`,
      }))
      const configured = factory.transient({
        prefix: "Team ",
      })

      // Act
      const organizations = await configured.createMany([{}, {}])

      // Assert
      assert.deepEqual(
        organizations.map((organization) => organization.name),
        ["Team 1", "Team 2"]
      )
    })
  })

  test(`when ${version} interleaves createMany with existing operations, the same builder continues its sequence`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async ({ organizationFactory }) => {
      const configured = organizationFactory.include([])

      // Act
      const first = configured.build()
      const organizations = await configured.createMany([{}, {}])
      const next = await configured.create()

      // Assert
      assert.deepEqual(
        [first, ...organizations, next].map((organization) => organization.name),
        ["Organization 1", "Organization 2", "Organization 3", "Organization 4"]
      )
    })
  })

  test(`when ${version} creates many, each full asynchronous hook lifecycle finishes before the next evaluation`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const events: string[] = []
      const factory = defineOrganization(fixture, ({ sequence, beforeCreate, afterCreate }) => {
        events.push(`generate ${sequence}`)
        beforeCreate(async (organization) => {
          events.push(`generator before ${organization.name} ${organization.isNewRecord}`)
          await setImmediate()
          events.push(`generator before finished ${sequence}`)
        })
        afterCreate(async (organization) => {
          events.push(`generator after ${organization.name} ${organization.isNewRecord}`)
          await setImmediate()
          events.push(`generator after finished ${sequence}`)
        })
        return {
          name: `Organization ${sequence}`,
        }
      })
      const configured = factory
        .beforeCreate(async (organization: HookOrganization) => {
          await setImmediate()
          events.push(`configured before ${organization.name}`)
        })
        .afterCreate(async (organization: HookOrganization) => {
          await setImmediate()
          events.push(`configured after ${organization.name}`)
        })

      // Act
      await configured.createMany([{}, {}])

      // Assert
      assert.deepEqual(events, [
        "generate 1",
        "configured before Organization 1",
        "generator before Organization 1 true",
        "generator before finished 1",
        "configured after Organization 1",
        "generator after Organization 1 false",
        "generator after finished 1",
        "generate 2",
        "configured before Organization 2",
        "generator before Organization 2 true",
        "generator before finished 2",
        "configured after Organization 2",
        "generator after Organization 2 false",
        "generator after finished 2",
      ])
    })
  })

  test(`when ${version} creates many with includes, every after hook sees its own loaded relationship`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const { organizationFactory, categoryFactory, projectFactory } = fixture
      const organization = await organizationFactory.create()
      const firstCategory = await categoryFactory.create({
        name: "First category",
        organizationId: organization.id,
      })
      const secondCategory = await categoryFactory.create({
        name: "Second category",
        organizationId: organization.id,
      })
      const loadedNames: (string | undefined)[] = []
      const configured = projectFactory
        .include("category")
        .afterCreate(async (project: HookProject) => {
          loadedNames.push(project.category?.name)
        })
      const paramsList = [
        {
          categoryId: secondCategory.id,
        },
        {
          categoryId: firstCategory.id,
        },
      ]

      // Act
      await configured.createMany(paramsList)

      // Assert
      assert.deepEqual(loadedNames, ["Second category", "First category"])
    })
  })

  test(`when ${version} creates many with includes, results retain each loaded relationship`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const { organizationFactory, categoryFactory, projectFactory } = fixture
      const organization = await organizationFactory.create()
      const category = await categoryFactory.create({
        name: "Loaded category",
        organizationId: organization.id,
      })
      const configured = projectFactory.include("category")
      const paramsList = [
        {
          categoryId: category.id,
        },
        {
          categoryId: category.id,
        },
      ]

      // Act
      const projects = await configured.createMany(paramsList)

      // Assert
      assert.deepEqual(
        projects.map((project) => project.category?.name),
        ["Loaded category", "Loaded category"]
      )
    })
  })

  test(`when ${version} creates many from an empty input, it returns an empty array`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async ({ organizationFactory }) => {
      // Act
      const organizations = await organizationFactory.createMany([])

      // Assert
      assert.deepEqual(organizations, [])
    })
  })

  test(`when ${version} creates many from an empty input, it does not evaluate hooks or consume a sequence`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const events: string[] = []
      const factory = defineOrganization(fixture, ({ sequence }) => {
        events.push(`generate ${sequence}`)
        return {
          name: `Organization ${sequence}`,
        }
      })
      const configured = factory
        .beforeCreate(async () => {
          events.push("before")
        })
        .afterCreate(async () => {
          events.push("after")
        })

      // Act
      await configured.createMany([])
      await configured.create()

      // Assert
      assert.deepEqual(events, ["generate 1", "before", "after"])
    })
  })

  test(`when ${version} creates many from an empty input, includes perform no database work`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const configured = fixture.projectFactory.include("category")
      const queries: string[] = []
      const recordQuery = () => {
        queries.push("query")
      }
      if ("User" in fixture) {
        fixture.sequelize.hooks.addListener("beforeQuery", recordQuery)
      } else {
        fixture.sequelize.addHook("beforeQuery", recordQuery)
      }

      // Act
      await configured.createMany([])

      // Assert
      assert.deepEqual(queries, [])
    })
  })

  test(`when ${version} rejects a createMany item, the original error reaches the caller`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async ({ organizationFactory }) => {
      const failure = new Error("Second item failed")
      const configured = organizationFactory.beforeCreate((organization: HookOrganization) => {
        if (organization.name === "Fail") {
          throw failure
        }
      })
      const paramsList = [
        {
          name: "Saved",
        },
        {
          name: "Fail",
        },
        {
          name: "Never attempted",
        },
      ]

      // Act
      const result = configured.createMany(paramsList)

      // Assert
      await assert.rejects(result, (error: unknown) => error === failure)
    })
  })

  test(`when ${version} rejects a createMany item, earlier writes remain without a batch rollback`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const factory = defineOrganization(fixture, ({ sequence }) => {
        if (sequence === 2) {
          throw new Error("Second item failed")
        }
        return {
          name: `Organization ${sequence}`,
        }
      })

      // Act
      await factory.createMany([{}, {}, {}]).catch(() => undefined)

      // Assert
      const names = await persistedNames(fixture)
      assert.deepEqual(names, ["Organization 1"])
    })
  })

  test(`when ${version} rejects a createMany item, subsequent inputs are never evaluated`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async (fixture) => {
      const evaluatedSequences: number[] = []
      const factory = defineOrganization(fixture, ({ sequence }) => {
        evaluatedSequences.push(sequence)
        return {
          name: `Organization ${sequence}`,
        }
      })
      const configured = factory.afterCreate(async (organization: HookOrganization) => {
        if (organization.name === "Organization 2") {
          await setImmediate()
          throw new Error("Second item hook failed")
        }
      })

      // Act
      await configured.createMany([{}, {}, {}]).catch(() => undefined)

      // Assert
      assert.deepEqual(evaluatedSequences, [1, 2])
    })
  })

  test(`when ${version} creates many from frozen inputs, neither the array nor its parameter objects change`, async () => {
    // Arrange
    await withFixture<ManyFixture>(create, async ({ organizationFactory }) => {
      const paramsList = Object.freeze([
        Object.freeze({
          name: "First unchanged",
        }),
        Object.freeze({
          name: "Second unchanged",
        }),
      ])

      // Act
      await organizationFactory.createMany(paramsList)

      // Assert
      assert.deepEqual(paramsList, [
        {
          name: "First unchanged",
        },
        {
          name: "Second unchanged",
        },
      ])
    })
  })
}

for (const version of [6, 7] as const) {
  test(`when Sequelize ${version} creates many with configured associations, only explicit item associations override them`, async () => {
    // Arrange
    if (version === 6) {
      await withFixture(createSequelizeV6Fixture, async (fixture) => {
        const { organizationFactory, projectFactory } = fixture
        const configuredOrganization = await organizationFactory.create()
        const suppliedOrganization = await organizationFactory.create()
        const configured = projectFactory.associations({
          organization: configuredOrganization,
        })
        const paramsList = [
          {},
          {
            organization: suppliedOrganization,
          },
          {},
        ]

        // Act
        const projects = await configured.createMany(paramsList)

        // Assert
        assert.deepEqual(
          projects.map((project) => project.organizationId),
          [configuredOrganization.id, suppliedOrganization.id, configuredOrganization.id]
        )
      })
    } else {
      await withFixture(createFixture, async (fixture) => {
        const { organizationFactory, projectFactory } = fixture
        const configuredOrganization = await organizationFactory.create()
        const suppliedOrganization = await organizationFactory.create()
        const configured = projectFactory.associations({
          organization: configuredOrganization,
        })
        const paramsList = [
          {},
          {
            organization: suppliedOrganization,
          },
          {},
        ]

        // Act
        const projects = await configured.createMany(paramsList)

        // Assert
        assert.deepEqual(
          projects.map((project) => project.organizationId),
          [configuredOrganization.id, suppliedOrganization.id, configuredOrganization.id]
        )
      })
    }
  })
}

// These scenarios are compile-only; invalid calls must remain rejected by TypeScript.
export function checkCreateManyTypes(v6: SequelizeV6Fixture, v7: Fixture): void {
  const originalV6 = FactoryShark.define(v6.Project, () => ({
    title: "Typed v6",
  }))
  const originalV7 = FactoryShark.define(v7.Project, () => ({
    title: "Typed v7",
  }))
  const configuredV6: FactoryInterface<SequelizeV6Project> = originalV6.params({
    title: "Configured v6",
  })
  const configuredV7: FactoryInterface<SequelizeV7Project> = originalV7.params({
    title: "Configured v7",
  })
  const mutableV6: FactoryParams<SequelizeV6Project>[] = [
    {
      title: "Mutable v6",
    },
  ]
  const mutableV7: FactoryParams<SequelizeV7Project>[] = [
    {
      title: "Mutable v7",
    },
  ]
  const readonlyV6: readonly FactoryParams<SequelizeV6Project>[] = mutableV6
  const readonlyV7: readonly FactoryParams<SequelizeV7Project>[] = mutableV7
  const originalV6Result: Promise<SequelizeV6Project[]> = originalV6.createMany(mutableV6)
  const originalV7Result: Promise<SequelizeV7Project[]> = originalV7.createMany(mutableV7)
  const configuredV6Result: Promise<SequelizeV6Project[]> = configuredV6.createMany(readonlyV6)
  const configuredV7Result: Promise<SequelizeV7Project[]> = configuredV7.createMany(readonlyV7)
  void originalV6Result
  void originalV7Result
  void configuredV6Result
  void configuredV7Result
  const readonlyOriginalV6: Promise<SequelizeV6Project[]> = originalV6.createMany(readonlyV6)
  const readonlyOriginalV7: Promise<SequelizeV7Project[]> = originalV7.createMany(readonlyV7)
  const mutableConfiguredV6: Promise<SequelizeV6Project[]> = configuredV6.createMany(mutableV6)
  const mutableConfiguredV7: Promise<SequelizeV7Project[]> = configuredV7.createMany(mutableV7)
  void readonlyOriginalV6
  void readonlyOriginalV7
  void mutableConfiguredV6
  void mutableConfiguredV7

  // @ts-expect-error createMany requires a parameter array.
  originalV6.createMany()
  // @ts-expect-error createMany requires a parameter array.
  originalV7.createMany()
  // @ts-expect-error createMany does not accept a list count.
  originalV6.createMany(2)
  // @ts-expect-error createMany does not accept a list count.
  originalV7.createMany(2)
  // @ts-expect-error Like create, createMany rejects unknown attributes.
  originalV6.createMany([{ unknown: true }])
  // @ts-expect-error Like create, createMany rejects unknown attributes.
  originalV7.createMany([{ unknown: true }])
  // @ts-expect-error Like create, configured createMany retains attribute types.
  configuredV6.createMany([{ title: 42 }])
  // @ts-expect-error Like create, configured createMany retains attribute types.
  configuredV7.createMany([{ title: 42 }])
  // @ts-expect-error Like create, associations must be model instances.
  configuredV6.createMany([{ organization: "not a model" }])
  // @ts-expect-error Like create, associations must be model instances.
  configuredV7.createMany([{ organization: "not a model" }])
  // @ts-expect-error createMany returns a promise, not a synchronous array.
  const synchronousV6: SequelizeV6Project[] = originalV6.createMany([])
  // @ts-expect-error createMany returns a promise, not a synchronous array.
  const synchronousV7: SequelizeV7Project[] = originalV7.createMany([])
  void synchronousV6
  void synchronousV7
}
