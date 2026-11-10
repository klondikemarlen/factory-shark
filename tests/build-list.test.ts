import assert from "node:assert/strict"
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
import type { FactoryInterface } from "@/src/index.js"

type ListFixture = Fixture | SequelizeV6Fixture

type NameOptions = {
  prefix?: string
}

type NameContext = {
  sequence: number
  transient: NameOptions
  beforeCreate: (hook: () => void) => void
  afterCreate: (hook: () => Promise<void>) => void
}

type OrganizationAttributes = {
  name: string
}

async function withFixture<F extends ListFixture>(
  create: () => F,
  scenario: (fixture: F) => void
): Promise<void> {
  const fixture = create()

  try {
    await fixture.sequelize.sync({
      force: true,
    })
    scenario(fixture)
  } finally {
    await fixture.sequelize.close()
  }
}

function defineOrganization(
  fixture: ListFixture,
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

function observeQueries(fixture: ListFixture): string[] {
  const queries: string[] = []
  const recordQuery = () => {
    queries.push("query")
  }

  if ("User" in fixture) {
    fixture.sequelize.hooks.addListener("beforeQuery", recordQuery)
  } else {
    fixture.sequelize.addHook("beforeQuery", recordQuery)
  }

  return queries
}

const fixtureCases: [string, () => ListFixture][] = [
  ["Sequelize 6", createSequelizeV6Fixture],
  ["Sequelize 7", createFixture],
]

for (const [version, create] of fixtureCases) {
  test(`when ${version} builds a list, it returns the requested distinct unsaved models`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory }) => {
      const count = 3

      // Act
      const organizations = organizationFactory.buildList(count)

      // Assert
      assert.equal(organizations.length, count)
      assert.equal(new Set<object>(organizations).size, count)
      assert.ok(organizations.every((organization) => organization.isNewRecord))
    })
  })

  test(`when ${version} list parameters override configured defaults, every item uses the explicit attributes`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory }) => {
      const configured = organizationFactory.params({
        name: "Configured name",
      })
      const params = {
        name: "Explicit name",
      }

      // Act
      const organizations = configured.buildList(2, params)

      // Assert
      assert.deepEqual(
        organizations.map((organization) => organization.name),
        ["Explicit name", "Explicit name"]
      )
    })
  })

  test(`when ${version} builds after a list, the same builder continues its sequence`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory }) => {
      // Act
      const first = organizationFactory.build()
      const organizations = organizationFactory.buildList(2)
      const next = organizationFactory.build()

      // Assert
      assert.deepEqual(
        [first, ...organizations, next].map((organization) => organization.name),
        ["Organization 1", "Organization 2", "Organization 3", "Organization 4"]
      )
    })
  })

  test(`when ${version} builds lists from independent clones, their sequences do not advance each other`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory }) => {
      const firstClone = organizationFactory.include([])
      const secondClone = organizationFactory.include([])

      // Act
      firstClone.buildList(2)
      const secondList = secondClone.buildList(2)
      const original = organizationFactory.build()

      // Assert
      assert.deepEqual(
        [...secondList, original].map((organization) => organization.name),
        ["Organization 1", "Organization 2", "Organization 1"]
      )
    })
  })

  test(`when ${version} builds a configured list, transient options reach every generator evaluation`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const factory = defineOrganization(fixture, ({ sequence, transient }) => ({
        name: `${transient.prefix}${sequence}`,
      }))
      const configured = factory.transient({
        prefix: "Team ",
      })

      // Act
      const organizations = configured.buildList(2)

      // Assert
      assert.deepEqual(
        organizations.map((organization) => organization.name),
        ["Team 1", "Team 2"]
      )
    })
  })

  test(`when ${version} builds a list with a configured association, every item retains the supplied instance`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory, projectFactory }) => {
      const organization = organizationFactory.build({
        id: 41,
      })
      const configured = projectFactory.associations({
        organization,
      })

      // Act
      const projects = configured.buildList(2)

      // Assert
      for (const project of projects) {
        assert.equal(project.organization, organization)
        assert.equal(project.organizationId, organization.id)
      }
    })
  })

  test(`when ${version} builds zero items, it returns an empty list`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory }) => {
      // Act
      const organizations = organizationFactory.buildList(0)

      // Assert
      assert.deepEqual(organizations, [])
    })
  })

  test(`when ${version} builds zero items, it neither evaluates nor advances the generator`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const evaluatedSequences: number[] = []
      const factory = defineOrganization(fixture, ({ sequence }) => {
        evaluatedSequences.push(sequence)
        return {
          name: `Organization ${sequence}`,
        }
      })

      // Act
      factory.buildList(0)
      factory.build()

      // Assert
      assert.deepEqual(evaluatedSequences, [1])
    })
  })

  test(`when ${version} builds a list with includes, neither models nor associations access the database`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const configured = fixture.projectFactory.include(["organization", "category"])
      const queries = observeQueries(fixture)

      // Act
      configured.buildList(2)

      // Assert
      assert.deepEqual(queries, [])
    })
  })

  test(`when ${version} builds a list, generator and configured create hooks do not run`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const events: string[] = []
      const factory = defineOrganization(fixture, ({ beforeCreate, afterCreate }) => {
        beforeCreate(() => {
          events.push("generator before")
        })
        afterCreate(async () => {
          events.push("generator after")
        })
        return {
          name: "Unchanged",
        }
      })
      const configured = factory
        .beforeCreate(() => {
          events.push("configured before")
        })
        .afterCreate(async () => {
          events.push("configured after")
        })
        .include([])

      // Act
      configured.buildList(2)

      // Assert
      assert.deepEqual(events, [])
    })
  })

  test(`when ${version} builds a list with a Date override, every item retains its timestamp`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory }) => {
      const observedAt = new Date("2026-11-09T12:34:56.789Z")

      // Act
      const organizations = organizationFactory.buildList(2, {
        observedAt,
      })

      // Assert
      assert.deepEqual(
        organizations.map((organization) => organization.getDataValue("observedAt")),
        [observedAt, observedAt]
      )
    })
  })

  test(`when ${version} builds a list with a Buffer override, every item retains its raw bytes`, async () => {
    // Arrange
    await withFixture(create, ({ organizationFactory }) => {
      const payload = Buffer.from([0, 127, 128, 255, 195, 40])

      // Act
      const organizations = organizationFactory.buildList(2, {
        payload,
      })

      // Assert
      assert.deepEqual(
        organizations.map((organization) => organization.getDataValue("payload")),
        [payload, payload]
      )
    })
  })
}

test("when Sequelize 6 list parameters supply an association, it takes precedence over the configured instance", async () => {
  // Arrange
  await withFixture(createSequelizeV6Fixture, ({ organizationFactory, projectFactory }) => {
    const configuredOrganization = organizationFactory.build({
      id: 41,
    })
    const suppliedOrganization = organizationFactory.build({
      id: 42,
    })
    const configured = projectFactory.associations({
      organization: configuredOrganization,
    })

    // Act
    const projects = configured.buildList(2, {
      organization: suppliedOrganization,
    })

    // Assert
    for (const project of projects) {
      assert.equal(project.organization, suppliedOrganization)
      assert.equal(project.organizationId, suppliedOrganization.id)
    }
  })
})

test("when Sequelize 7 list parameters supply an association, it takes precedence over the configured instance", async () => {
  // Arrange
  await withFixture(createFixture, ({ organizationFactory, projectFactory }) => {
    const configuredOrganization = organizationFactory.build({
      id: 41,
    })
    const suppliedOrganization = organizationFactory.build({
      id: 42,
    })
    const configured = projectFactory.associations({
      organization: configuredOrganization,
    })

    // Act
    const projects = configured.buildList(2, {
      organization: suppliedOrganization,
    })

    // Assert
    for (const project of projects) {
      assert.equal(project.organization, suppliedOrganization)
      assert.equal(project.organizationId, suppliedOrganization.id)
    }
  })
})

test("when a Sequelize 6 custom builder configures a list, its custom parameters reach every item", async () => {
  // Arrange
  await withFixture(createSequelizeV6Fixture, (fixture) => {
    class OrganizationFactory extends FactoryShark<SequelizeV6Organization> {
      named(name: string): FactoryInterface<SequelizeV6Organization> {
        return this.params({
          name,
        })
      }
    }
    const factory = new OrganizationFactory(
      fixture.Organization,
      () => ({
        name: "Generated name",
      }),
      {}
    )

    // Act
    const organizations = factory.named("Custom name").buildList(2)

    // Assert
    assert.deepEqual(
      organizations.map((organization) => organization.name),
      ["Custom name", "Custom name"]
    )
  })
})

test("when a Sequelize 7 custom builder configures a list, its custom parameters reach every item", async () => {
  // Arrange
  await withFixture(createFixture, (fixture) => {
    class OrganizationFactory extends FactoryShark<SequelizeV7Organization> {
      named(name: string): FactoryInterface<SequelizeV7Organization> {
        return this.params({
          name,
        })
      }
    }
    const factory = new OrganizationFactory(
      fixture.Organization,
      () => ({
        name: "Generated name",
      }),
      {}
    )

    // Act
    const organizations = factory.named("Custom name").buildList(2)

    // Assert
    assert.deepEqual(
      organizations.map((organization) => organization.name),
      ["Custom name", "Custom name"]
    )
  })
})

// These scenarios are compile-only; invalid calls must remain rejected by TypeScript.
export function checkBuildListTypes(v6: SequelizeV6Fixture, v7: Fixture): void {
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
  const originalV6List: SequelizeV6Project[] = originalV6.buildList(2, {
    title: "Explicit v6",
  })
  const originalV7List: SequelizeV7Project[] = originalV7.buildList(2, {
    title: "Explicit v7",
  })
  const configuredV6List: SequelizeV6Project[] = configuredV6.buildList(2)
  const configuredV7List: SequelizeV7Project[] = configuredV7.buildList(2)
  void originalV6List
  void originalV7List
  void configuredV6List
  void configuredV7List

  // @ts-expect-error List counts must be numbers.
  originalV6.buildList("2")
  // @ts-expect-error List counts must be numbers.
  originalV7.buildList("2")
  // @ts-expect-error Lists require a count.
  originalV6.buildList()
  // @ts-expect-error Lists require a count.
  originalV7.buildList()
  // @ts-expect-error List parameters reject unknown attributes.
  originalV6.buildList(2, { unknown: true })
  // @ts-expect-error List parameters reject unknown attributes.
  originalV7.buildList(2, { unknown: true })
  // @ts-expect-error Configured list parameters retain attribute types.
  configuredV6.buildList(2, { title: 42 })
  // @ts-expect-error Configured list parameters retain attribute types.
  configuredV7.buildList(2, { title: 42 })
  // @ts-expect-error Association overrides must be model instances.
  configuredV6.buildList(2, { organization: "not a model" })
  // @ts-expect-error Association overrides must be model instances.
  configuredV7.buildList(2, { organization: "not a model" })
  // @ts-expect-error Build lists are synchronous, not promises.
  const promisedV6List: Promise<SequelizeV6Project[]> = originalV6.buildList(2)
  // @ts-expect-error Build lists are synchronous, not promises.
  const promisedV7List: Promise<SequelizeV7Project[]> = originalV7.buildList(2)
  void promisedV6List
  void promisedV7List
}
