import assert from "node:assert/strict"
import { test } from "node:test"

import { createFixture } from "@/tests/support.js"
import { createSequelizeV6Fixture } from "@/tests/sequelize-v6-support.js"
import type { Fixture, OrganizationRecord } from "@/tests/support.js"

import { FactoryShark } from "@/src/index.js"
import type { FactoryInterface } from "@/src/index.js"

async function withFixture(scenario: (fixture: Fixture) => Promise<void>): Promise<void> {
  const fixture = createFixture()

  try {
    await fixture.sequelize.sync({
      force: true,
    })
    await scenario(fixture)
  } finally {
    await fixture.sequelize.close()
  }
}

test("when custom persistence returns an existing model, create returns that exact model", async () => {
  // Arrange
  await withFixture(async ({ Organization, organizationFactory }) => {
    const existing = await Organization.create({
      name: "Existing organization",
    })
    const configured = organizationFactory.onCreate(async () => existing)

    // Act
    const organization = await configured.create()

    // Assert
    assert.equal(organization, existing)
  })
})

test("when custom persistence reuses an existing model, the generated parent is not saved", async () => {
  // Arrange
  await withFixture(async ({ Organization, organizationFactory }) => {
    const existing = await Organization.create({
      name: "Existing organization",
    })
    const configured = organizationFactory.onCreate(async () => existing)

    // Act
    await configured.create()

    // Assert
    const count = await Organization.count()
    assert.equal(count, 1)
  })
})

test("when persistence is configured, the source factory retains default saving", async () => {
  // Arrange
  await withFixture(async ({ Organization, organizationFactory }) => {
    organizationFactory.onCreate(async () => {
      throw new Error("Only the clone uses custom persistence")
    })

    // Act
    await organizationFactory.create({
      name: "Default save",
    })

    // Assert
    const organization = await Organization.findOne({
      rejectOnEmpty: true,
    })
    assert.equal(organization.name, "Default save")
  })
})

test("when persistence is replaced on a clone, its source retains its own callback", async () => {
  // Arrange
  await withFixture(async ({ Organization, organizationFactory }) => {
    const configured = organizationFactory.onCreate(async () =>
      Organization.create({
        name: "Source callback",
      })
    )
    const replaced = configured.onCreate(async () =>
      Organization.create({
        name: "Replacement callback",
      })
    )

    // Act
    await replaced.create()
    await configured.create()

    // Assert
    const organizations = await Organization.findAll({
      attributes: ["name"],
      order: [["id", "ASC"]],
      raw: true,
    })
    assert.deepEqual(organizations, [
      {
        name: "Replacement callback",
      },
      {
        name: "Source callback",
      },
    ])
  })
})

test("when hooks surround custom persistence, chained and generated hooks retain lifecycle order", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const events: string[] = []
    const factory = FactoryShark.define(Organization, ({ beforeCreate, afterCreate }) => {
      beforeCreate((organization) => {
        events.push(`generated before: ${organization.name}`)
        organization.name = "Ready to persist"
      })
      afterCreate(async (organization) => {
        events.push(`generated after: ${organization.name}`)
      })

      return {
        name: "Generated name",
      }
    })
      .beforeCreate((organization) => {
        events.push(`chained before: ${organization.name}`)
        organization.name = "Changed before persistence"
      })
      .onCreate(async (organization) => {
        events.push(`persist: ${organization.name}`)
        return Organization.create({
          name: `${organization.name}, saved separately`,
        })
      })
      .afterCreate(async (organization) => {
        events.push(`chained after: ${organization.name}`)
      })

    // Act
    await factory.create()

    // Assert
    assert.deepEqual(events, [
      "chained before: Generated name",
      "generated before: Changed before persistence",
      "persist: Ready to persist",
      "chained after: Ready to persist, saved separately",
      "generated after: Ready to persist, saved separately",
    ])
  })
})

test("when configuration is composed after onCreate, every clone preserves custom persistence", async () => {
  // Arrange
  await withFixture(async ({ Organization }) => {
    const source = FactoryShark.define<OrganizationRecord, { prefix?: string }>(
      Organization,
      ({ transient }) => ({
        name: `${transient.prefix} generated`,
      })
    ).onCreate(async (organization) =>
      Organization.create({
        name: `${organization.name}, custom`,
      })
    )
    const configured = source
      .transient({
        prefix: "Transient",
      })
      .associations({})
      .params({
        name: "Configured",
      })
      .include([])
      .beforeCreate((organization) => {
        organization.name += ", before"
      })
      .afterCreate(async (organization) => {
        organization.name += ", after"
      })

    // Act
    const organization = await configured.create()

    // Assert
    assert.equal(organization.name, "Configured, before, custom, after")
  })
})

for (const operation of ["build", "attributesFor"] as const) {
  test(`when ${operation} uses a configured factory, custom persistence is ignored`, async () => {
    // Arrange
    await withFixture(async ({ organizationFactory }) => {
      const configured = organizationFactory.onCreate(async () => {
        throw new Error("Persistence must not run")
      })

      // Act
      const result = configured[operation]({
        name: "Built without saving",
      })

      // Assert
      assert.equal(result.name, "Built without saving")
    })
  })
}

for (const operation of ["createList", "createMany"] as const) {
  test(`when ${operation} uses custom persistence, every record uses its callback`, async () => {
    // Arrange
    await withFixture(async ({ Organization, organizationFactory }) => {
      const configured = organizationFactory.onCreate(async (organization) =>
        Organization.create({
          name: `${organization.name}, custom`,
        })
      )

      // Act
      if (operation === "createList") {
        await configured.createList(2)
      } else {
        await configured.createMany([{}, {}])
      }

      // Assert
      const organizations = await Organization.findAll({
        attributes: ["name"],
        order: [["id", "ASC"]],
        raw: true,
      })
      assert.deepEqual(organizations, [
        {
          name: "Organization 1, custom",
        },
        {
          name: "Organization 2, custom",
        },
      ])
    })
  })
}

test("when an associated factory configures persistence, its callback creates the dependency", async () => {
  // Arrange
  await withFixture(async ({ Organization, Category, organizationFactory }) => {
    const associated = organizationFactory
      .params({
        name: "Associated organization",
      })
      .onCreate(async (organization) =>
        Organization.create({
          name: `${organization.name}, associated callback`,
        })
      )
    const factory = FactoryShark.define(Category, ({ associate }) => {
      associate("organization", associated)

      return {
        name: "Category",
      }
    })

    // Act
    await factory.create()

    // Assert
    const organization = await Organization.findOne({
      rejectOnEmpty: true,
    })
    assert.equal(organization.name, "Associated organization, associated callback")
  })
})

test("when a parent configures persistence, its callback does not replace dependency persistence", async () => {
  // Arrange
  await withFixture(async ({ Organization, Category, organizationFactory }) => {
    const factory = FactoryShark.define(Category, ({ associate }) => {
      associate("organization", organizationFactory, {
        name: "Native organization",
      })

      return {
        name: "Generated category",
      }
    })
    const configured = factory.onCreate(async (category) => {
      category.name = "Custom category"
      return category.save()
    })

    // Act
    await configured.create()

    // Assert
    const organization = await Organization.findOne({
      rejectOnEmpty: true,
    })
    assert.equal(organization.name, "Native organization")
  })
})

test("when custom persistence completes, supplied children persist before afterCreate", async () => {
  // Arrange
  await withFixture(async ({ Project, projectFactory, organizationFactory }) => {
    const child = projectFactory.build()
    const childTitles: string[] = []
    const configured = organizationFactory
      .onCreate(async (organization) => {
        organization.name = "Custom parent"
        return organization.save()
      })
      .associations({
        projects: [child],
      })
      .afterCreate(async (organization) => {
        const projects = await Project.findAll({
          where: {
            organizationId: organization.id,
          },
        })
        childTitles.push(...projects.map((project) => project.title))
      })

    // Act
    await configured.create()

    // Assert
    assert.deepEqual(childTitles, ["Project 1"])
  })
})

test("when custom persistence returns a different model, include reloads that model before afterCreate", async () => {
  // Arrange
  await withFixture(async ({ Category, categoryFactory, organizationFactory }) => {
    const organization = await organizationFactory.create({
      name: "Included organization",
    })
    const observedNames: string[] = []
    const configured = categoryFactory
      .onCreate(async (category) =>
        Category.create({
          name: "Saved separately",
          organizationId: category.organizationId,
        })
      )
      .include(["organization"])
      .afterCreate(async (category) => {
        observedNames.push(category.organization!.name)
      })

    // Act
    await configured.create({
      organization,
    })

    // Assert
    assert.deepEqual(observedNames, ["Included organization"])
  })
})

test("when custom persistence rejects, create propagates its original error", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const failure = new Error("Custom persistence failed")
    const configured = organizationFactory.onCreate(async () => {
      throw failure
    })

    // Act
    const creation = configured.create()

    // Assert
    await assert.rejects(creation, (error) => error === failure)
  })
})

test("when custom persistence rejects, supplied-child saves, include loading, and afterCreate are skipped", async () => {
  // Arrange
  await withFixture(async ({ Organization, Project, organizationFactory, projectFactory }) => {
    const child = projectFactory.build()
    const laterEvents: string[] = []
    Project.hooks.addListener("beforeSave", () => {
      laterEvents.push("child save")
    })
    Organization.hooks.addListener("beforeFind", () => {
      laterEvents.push("include reload")
    })

    const configured = organizationFactory
      .associations({
        projects: [child],
      })
      .onCreate(async () => {
        throw new Error("Custom persistence failed")
      })
      .include(["projects"])
      .afterCreate(async () => {
        laterEvents.push("after create")
      })

    // Act
    await configured.create().catch(() => undefined)

    // Assert
    assert.deepEqual(laterEvents, [])
  })
})

test("when a beforeCreate hook rejects, custom persistence does not run", async () => {
  // Arrange
  await withFixture(async ({ organizationFactory }) => {
    const events: string[] = []
    const configured = organizationFactory
      .beforeCreate(() => {
        throw new Error("Before create failed")
      })
      .onCreate(async (organization) => {
        events.push("persist")
        return organization.save()
      })

    // Act
    await configured.create().catch(() => undefined)

    // Assert
    assert.deepEqual(events, [])
  })
})

test("when Sequelize 6 uses custom persistence, the callback replaces default parent saving", async () => {
  // Arrange
  const fixture = createSequelizeV6Fixture()

  try {
    await fixture.sequelize.sync({
      force: true,
    })
    const existing = await fixture.Organization.create({
      name: "Existing Sequelize 6 organization",
    })
    const configured = fixture.organizationFactory.onCreate(async () => existing)

    // Act
    await configured.create()

    // Assert
    const count = await fixture.Organization.count()
    assert.equal(count, 1)
  } finally {
    await fixture.sequelize.close()
  }
})

// Compile-only scenarios preserve callback input, result, and configured-factory types.
export function checkCustomPersistenceTypes({ Organization, organizationFactory }: Fixture): void {
  const direct = FactoryShark.define(Organization, () => ({
    name: "Typed organization",
  }))
  const configured: FactoryInterface<OrganizationRecord> = direct.onCreate(async (organization) => {
    const name: string = organization.name
    void name
    return organization.save()
  })
  const result: Promise<OrganizationRecord> = configured.create()
  void result

  organizationFactory.onCreate(async (organization) => organization.save())

  // @ts-expect-error Persistence must return a model, not creation attributes.
  direct.onCreate(async () => ({ name: "Not a Sequelize model" }))

  // @ts-expect-error Persistence must be asynchronous.
  configured.onCreate((organization) => organization)

  // @ts-expect-error Persistence cannot return void.
  configured.onCreate(async () => {})
}
