import assert from "node:assert/strict"
import { test } from "node:test"

import { createFixture } from "@/tests/support.js"
import { createSequelizeV6Fixture } from "@/tests/sequelize-v6-support.js"
import type {
  Fixture,
  OrganizationRecord as V7Organization,
  ProjectRecord as V7Project,
  CategoryRecord as V7Category,
} from "@/tests/support.js"
import type {
  SequelizeV6Fixture,
  OrganizationRecord as V6Organization,
  ProjectRecord as V6Project,
  CategoryRecord as V6Category,
} from "@/tests/sequelize-v6-support.js"

import { FactoryShark } from "@/src/index.js"
import type { FactoryInterface } from "@/src/index.js"

type CollectionFixture = Fixture | SequelizeV6Fixture

// Keep native instances and static models while giving runtime scenarios one public factory surface.
type CollectionOrganization = Omit<V6Organization | V7Organization, "projects"> & {
  projects?: (V6Project | V7Project)[]
}

type CollectionCategory = Omit<V6Category | V7Category, "projects"> & {
  projects?: (V6Project | V7Project)[]
}

type RuntimeFixture = (
  | Omit<Fixture, "organizationFactory" | "categoryFactory">
  | Omit<SequelizeV6Fixture, "organizationFactory" | "categoryFactory">
) & {
  organizationFactory: FactoryInterface<CollectionOrganization>
  categoryFactory: FactoryInterface<CollectionCategory>
}

type ParentGeneratorContext = {
  beforeCreate: (hook: (model: CollectionOrganization) => void) => void
  afterCreate: (hook: (model: CollectionOrganization) => Promise<void>) => void
}

function defineParent(
  fixture: RuntimeFixture,
  generator: (context: ParentGeneratorContext) => {
    name: string
  }
) {
  return FactoryShark.define<CollectionOrganization>(fixture.Organization, generator)
}

async function withFixture(
  create: () => CollectionFixture,
  scenario: (fixture: RuntimeFixture) => void | Promise<void>
): Promise<void> {
  const fixture: RuntimeFixture = create()
  try {
    await fixture.sequelize.sync({
      force: true,
    })
    await scenario(fixture)
  } finally {
    await fixture.sequelize.close()
  }
}

async function projectRows(fixture: RuntimeFixture) {
  if ("User" in fixture) {
    return fixture.Project.findAll({
      order: [["id", "ASC"]],
    })
  }
  return fixture.Project.findAll({
    order: [["id", "ASC"]],
  })
}

async function organizationCount(fixture: RuntimeFixture) {
  if ("User" in fixture) {
    return fixture.Organization.count()
  }
  return fixture.Organization.count()
}

const fixtureCases: [string, () => CollectionFixture][] = [
  ["Sequelize 6", createSequelizeV6Fixture],
  ["Sequelize 7", createFixture],
]

for (const [version, create] of fixtureCases) {
  test(`when ${version} receives configured children, create preserves their identity`, async () => {
    // Arrange
    await withFixture(create, async ({ organizationFactory, projectFactory }) => {
      const child = projectFactory.build({
        title: "Supplied project",
      })
      const children = [child]

      // Act
      const parent = await organizationFactory
        .associations({
          projects: children,
        })
        .create()

      // Assert
      assert.equal(parent.projects, children)
      assert.equal(parent.projects?.[0], child)
    })
  })

  test(`when ${version} creates supplied children, rows reference the actual parent without duplicates`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const children = fixture.projectFactory.buildList(2)

      // Act
      const parent = await fixture.organizationFactory.create({
        projects: children,
      })

      // Assert
      const rows = await projectRows(fixture)
      assert.deepEqual(
        rows.map((row) => ({
          id: row.id,
          organizationId: row.organizationId,
          title: row.title,
        })),
        children.map((child) => ({
          id: child.id,
          organizationId: parent.id,
          title: child.title,
        }))
      )
    })
  })

  test(`when ${version} creates a child with built belongsTo dependencies, those dependencies persist once`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = fixture.projectFactory.build()
      const category = child.category
      const categoryOrganization = category?.organization

      // Act
      await fixture.organizationFactory
        .params({
          projects: [child],
        })
        .create()

      // Assert
      assert.equal(category?.isNewRecord, false)
      assert.equal(categoryOrganization?.isNewRecord, false)
    })
  })

  test(`when ${version} replaces a built inverse placeholder, it never saves that extra parent`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = fixture.projectFactory.build()

      // Act
      await fixture.organizationFactory.create({
        projects: [child],
      })

      // Assert
      const count = await organizationCount(fixture)
      assert.equal(count, 2)
    })
  })

  test(`when ${version} receives explicit child foreign keys, they override attached dependency placeholders`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const category = await fixture.categoryFactory.create()
      const child = fixture.projectFactory.build({
        categoryId: category.id,
      })

      // Act
      await fixture.organizationFactory.create({
        projects: [child],
      })

      // Assert
      const rows = await projectRows(fixture)
      assert.equal(rows[0]?.categoryId, category.id)
    })
  })

  test(`when ${version} receives a stale unsaved child parent key, the new parent's key wins`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const existingParent = await fixture.organizationFactory.create()
      const child = fixture.projectFactory.build({
        organizationId: existingParent.id,
      })

      // Act
      const parent = await fixture.organizationFactory.create({
        projects: [child],
      })

      // Assert
      const rows = await projectRows(fixture)
      assert.equal(rows[0]?.organizationId, parent.id)
    })
  })

  test(`when ${version} runs parent beforeCreate, the supplied children are already attached`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = fixture.projectFactory.build()
      let observed: unknown
      const factory = defineParent(fixture, ({ beforeCreate }) => {
        beforeCreate((parent) => {
          observed = parent.projects?.[0]
        })
        return {
          name: "Parent",
        }
      })

      // Act
      await factory.create({
        projects: [child],
      })

      // Assert
      assert.equal(observed, child)
    })
  })

  test(`when ${version} reloads nested children in afterCreate, their dependencies are already persisted`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = fixture.projectFactory.build({
        title: "Nested",
      })
      const factory = defineParent(fixture, ({ afterCreate }) => {
        afterCreate(async (parent) => {
          await parent.reload({
            include: [
              {
                association: "projects",
                include: [
                  {
                    association: "category",
                    include: ["organization"],
                  },
                ],
              },
            ],
          })
        })
        return {
          name: "Parent",
        }
      })

      // Act
      const parent = await factory.create({
        projects: [child],
      })

      // Assert
      assert.equal(parent.projects![0].category!.organization!.id, child.category!.organization!.id)
    })
  })

  test(`when ${version} configures include, children exist before that reload`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = fixture.projectFactory.build()

      // Act
      const parent = await fixture.organizationFactory.include(["projects"]).create({
        projects: [child],
      })

      // Assert
      assert.equal(parent.projects![0].id, child.id)
    })
  })

  test(`when ${version} receives an empty collection, create attaches it without creating children`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const children: never[] = []

      // Act
      await fixture.organizationFactory
        .associations({
          projects: children,
        })
        .create()

      // Assert
      const rows = await projectRows(fixture)
      assert.equal(rows.length, 0)
    })
  })

  test(`when ${version} builds collections, build and buildList attach supplied identities`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const children = fixture.projectFactory.buildList(2)
      const factory = fixture.organizationFactory.associations({
        projects: children,
      })

      // Act
      const parent = factory.build()
      const parents = factory.buildList(2)

      // Assert
      assert.equal(parent.projects, children)
      assert.ok(parents.every((item) => item.projects === children))
    })
  })

  test(`when ${version} evaluates unsaved operations, no queries run`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      let queries = 0
      const recordQuery = () => {
        queries++
      }
      if ("User" in fixture) {
        fixture.sequelize.hooks.addListener("beforeQuery", recordQuery)
      } else {
        fixture.sequelize.addHook("beforeQuery", recordQuery)
      }
      const children = fixture.projectFactory.buildList(2)
      const factory = fixture.organizationFactory.params({
        projects: children,
      })

      // Act
      factory.build()
      factory.buildList(2)
      factory.attributesFor()

      // Assert
      assert.equal(queries, 0)
    })
  })

  test(`when ${version} extracts attributes, supplied collections stay outside scalar values`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const children = fixture.projectFactory.buildList(1)

      // Act
      const attributes = fixture.organizationFactory.attributesFor({
        projects: children,
      })

      // Assert
      assert.equal("projects" in attributes, false)
    })
  })

  test(`when ${version} receives conflicting configured collections, call-time parameters win`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const first = fixture.projectFactory.build()
      const second = fixture.projectFactory.build()
      const third = fixture.projectFactory.build()
      const factory = fixture.organizationFactory
        .associations({
          projects: [first],
        })
        .params({
          projects: [second],
        })

      // Act
      const parent = await factory.create({
        projects: [third],
      })

      // Assert
      assert.equal(parent.projects?.[0], third)
    })
  })

  test(`when ${version} reuses a persisted child already referencing the parent, it does not save it again`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const children: (V6Project | V7Project)[] = []
      let saves = 0
      const createChild = async (parent: Pick<V6Organization | V7Organization, "get">) => {
        if (parent.get("name") !== "Reuse parent") return
        const child = await fixture.projectFactory.create({
          organizationId: parent.get("id") as V6Organization["id"],
        })
        children.push(child)
      }
      const recordSave = () => {
        saves++
      }
      if ("User" in fixture) {
        fixture.Organization.hooks.addListener("afterCreate", createChild)
        fixture.Project.hooks.addListener("beforeSave", recordSave)
      } else {
        fixture.Organization.addHook("afterCreate", createChild)
        fixture.Project.addHook("beforeSave", recordSave)
      }
      const factory = fixture.organizationFactory.params({
        name: "Reuse parent",
        projects: children,
      })

      // Act
      await factory.create()

      // Assert
      assert.equal(saves, 1)
    })
  })

  test(`when ${version} receives a persisted child from another parent, it rejects reassignment`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = await fixture.projectFactory.create()
      const originalParentId = child.organizationId

      // Act
      await assert.rejects(
        fixture.organizationFactory.create({
          projects: [child],
        }),
        /Cannot reassign persisted child/
      )

      // Assert
      const rows = await projectRows(fixture)
      assert.equal(rows[0]?.organizationId, originalParentId)
    })
  })

  test(`when ${version} child validation fails, earlier child rows remain saved`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const first = fixture.projectFactory.build({
        title: "Saved first",
      })
      const invalid = fixture.projectFactory.build()
      Object.assign(invalid, {
        title: null,
      })

      // Act
      await assert.rejects(
        fixture.organizationFactory.create({
          projects: [first, invalid],
        })
      )

      // Assert
      const rows = await projectRows(fixture)
      assert.deepEqual(
        rows.map((row) => row.title),
        ["Saved first"]
      )
    })
  })

  test(`when ${version} receives a child of the wrong model, it rejects before persistence`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const wrongChild = fixture.categoryFactory.build()

      // Act
      await assert.rejects(
        fixture.organizationFactory.create({
          // @ts-expect-error Collection members must match the declared child model.
          projects: [wrongChild],
        }),
        /Expected an instance of the associated model/
      )

      // Assert
      assert.equal(await organizationCount(fixture), 0)
    })
  })

  test(`when ${version} receives a non-array hasMany value, it reports the collection requirement`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const child = fixture.projectFactory.build()

      // Act / Assert
      assert.throws(
        () =>
          fixture.organizationFactory.build({
            // @ts-expect-error A hasMany value must be a collection.
            projects: child,
          }),
        /requires an array/
      )
    })
  })

  test(`when ${version} receives a collection for belongsTo, it reports the unsupported kind`, async () => {
    // Arrange
    await withFixture(create, (fixture) => {
      const organization = fixture.organizationFactory.build()

      // Act / Assert
      assert.throws(
        () =>
          fixture.projectFactory
            .associations({
              // @ts-expect-error Singular belongsTo associations cannot accept collections.
              organization: [organization],
            })
            .build(),
        /requires a hasMany association/
      )
    })
  })

  test(`when ${version} creates a parent with children, its belongsTo dependency is persisted`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = fixture.projectFactory.build()

      // Act
      const category = await fixture.categoryFactory.create({
        projects: [child],
      })

      // Assert
      if ("User" in fixture) {
        const persistedCategory = await fixture.Category.findByPk(category.id)
        assert.equal(persistedCategory?.organizationId, category.organization?.id)
      } else {
        const persistedCategory = await fixture.Category.findByPk(category.id)
        assert.equal(persistedCategory?.organizationId, category.organization?.id)
      }
    })
  })

  test(`when ${version} saves built children, native save hooks run`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      let nativeSaves = 0
      const recordSave = () => {
        nativeSaves++
      }
      if ("User" in fixture) {
        fixture.Project.hooks.addListener("beforeSave", recordSave)
      } else {
        fixture.Project.addHook("beforeSave", recordSave)
      }
      const child = fixture.projectFactory.build()

      // Act
      await fixture.organizationFactory.create({
        projects: [child],
      })

      // Assert
      assert.equal(nativeSaves, 1)
    })
  })

  test(`when ${version} a child fails validation, the newly saved parent remains`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const invalid = fixture.projectFactory.build()
      Object.assign(invalid, {
        title: null,
      })
      let parentId: number | undefined
      const factory = fixture.organizationFactory.beforeCreate((parent) => {
        parentId = parent.id
      })

      // Act
      await assert.rejects(
        factory.create({
          id: 500,
          projects: [invalid],
        })
      )

      // Assert
      if ("User" in fixture) {
        assert.notEqual(await fixture.Organization.findByPk(parentId), null)
      } else {
        assert.notEqual(await fixture.Organization.findByPk(parentId), null)
      }
    })
  })

  test(`when ${version} a child fails validation, parent afterCreate does not run`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const invalid = fixture.projectFactory.build()
      Object.assign(invalid, {
        title: null,
      })
      let hooks = 0
      const factory = fixture.organizationFactory.afterCreate(async () => {
        hooks++
      })

      // Act
      await assert.rejects(
        factory.create({
          projects: [invalid],
        })
      )

      // Assert
      assert.equal(hooks, 0)
    })
  })

  test(`when ${version} mutates a persisted child foreign key, it cannot disguise reassignment`, async () => {
    // Arrange
    await withFixture(create, async (fixture) => {
      const child = await fixture.projectFactory.create()
      Object.assign(child, {
        organizationId: 500,
      })

      // Act / Assert
      await assert.rejects(
        fixture.organizationFactory.create({
          id: 500,
          projects: [child],
        }),
        /Cannot reassign persisted child/
      )
    })
  })
}

// These cases are compile-time only: invalid collections must stay rejected on configured factories.
function rejectedCollections(fixture: Fixture) {
  const child = fixture.projectFactory.build()
  const organization = fixture.organizationFactory.build()
  const factory = fixture.organizationFactory.params({
    name: "Configured",
  })
  factory.associations({
    // @ts-expect-error Collection members must match the declared model.
    projects: [organization],
  })
  factory.params({
    // @ts-expect-error Unknown collection aliases are not accepted in parameters.
    missing: [child],
  })
  factory.params({
    // @ts-expect-error Scalar attributes are not collection associations.
    name: [child],
  })
  factory.buildList(2, {
    // @ts-expect-error Call-time collection members must match their model.
    projects: [organization],
  })
  FactoryShark.define(fixture.Organization, ({ associate }) => {
    // @ts-expect-error associate() remains singular-only.
    associate("projects", fixture.projectFactory)
    return {
      name: "Invalid",
    }
  })
}
void rejectedCollections

function typedV7Collections(fixture: Fixture) {
  const child = fixture.projectFactory.build()
  const organization = fixture.organizationFactory.build()
  const root = FactoryShark.define(fixture.Organization, () => ({
    name: "Typed parent",
    projects: [child],
  }))
  root
    .associations({
      projects: [child],
    })
    .params({
      projects: [child],
    })
    .buildList(2, {
      projects: [child],
    })
  void root.create({
    projects: [child],
  })
  const projectRoot = FactoryShark.define(fixture.Project, () => ({
    title: "Typed child",
  }))
  projectRoot.associations<V7Organization>({
    organization,
  })
  fixture.projectFactory.associations<V7Organization>({
    organization,
  })
  root.associations({
    // @ts-expect-error Collections cannot take a singular model.
    projects: child,
  })
}

function typedV6Collections(fixture: SequelizeV6Fixture) {
  const child = fixture.projectFactory.build()
  const organization = fixture.organizationFactory.build()
  const root = FactoryShark.define(fixture.Organization, () => ({
    name: "Typed parent",
    projects: [child],
  }))
  root
    .associations({
      projects: [child],
    })
    .params({
      projects: [child],
    })
    .buildList(2, {
      projects: [child],
    })
  void root.create({
    projects: [child],
  })
  const projectRoot = FactoryShark.define(fixture.Project, () => ({
    title: "Typed child",
  }))
  projectRoot.associations<V6Organization>({
    organization,
  })
  fixture.projectFactory.associations<V6Organization>({
    organization,
  })
  root.associations({
    // @ts-expect-error Collection members must match their declared model.
    projects: [organization],
  })
  root.associations({
    // @ts-expect-error Collections cannot take a singular model.
    projects: child,
  })
}
void typedV7Collections
void typedV6Collections
