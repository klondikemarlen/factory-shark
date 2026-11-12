import assert from "node:assert/strict"
import { test } from "node:test"

import { createSequelizeV6TargetKeyFixture } from "@/tests/support/sequelize-v6-target-key-fixture.js"
import { createSequelizeV7TargetKeyFixture } from "@/tests/support/sequelize-v7-target-key-fixture.js"
import type {
  TargetKey,
  TargetKeyFixture,
  TargetKeyParent,
} from "@/tests/support/target-key-fixture.js"

function registerTargetKeyScenarios<Parent extends TargetKeyParent>(
  version: string,
  createFixture: (targetKey: TargetKey) => TargetKeyFixture<Parent>
) {
  for (const targetKey of ["key", "code"] as const) {
    const condition = `${version} belongsTo targets ${targetKey}`

    async function withFixture(runScenario: (fixture: TargetKeyFixture<Parent>) => Promise<void>) {
      const fixture = createFixture(targetKey)

      try {
        await fixture.sequelize.sync({
          force: true,
        })
        await runScenario(fixture)
      } finally {
        await fixture.sequelize.close()
      }
    }

    test(`when ${condition}, build infers an undefined foreign key from a supplied parent`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = parentFactory.build()

        // Act
        const child = childFactory.build({
          parentKey: undefined,
          parent,
        })

        // Assert
        assert.equal(child.parentKey, parent[targetKey])
      })
    })

    test(`when ${condition}, build preserves supplied parent identity`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = parentFactory.build()

        // Act
        const child = childFactory.build({
          parent,
        })

        // Assert
        assert.equal(child.parent, parent)
      })
    })

    test(`when ${condition}, build leaves a supplied parent unsaved`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = parentFactory.build()

        // Act
        childFactory.build({
          parent,
        })

        // Assert
        assert.equal(parent.isNewRecord, true)
      })
    })

    test(`when ${condition}, build preserves an explicit null foreign key`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = parentFactory.build()

        // Act
        const child = childFactory.build({
          parentKey: null,
          parent,
        })

        // Assert
        assert.equal(child.parentKey, null)
      })
    })

    test(`when ${condition}, build attaches a supplied parent despite an explicit null foreign key`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = parentFactory.build()

        // Act
        const child = childFactory.build({
          parentKey: null,
          parent,
        })

        // Assert
        assert.equal(child.parent, parent)
      })
    })

    test(`when ${condition}, build creates a placeholder using the actual target key`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = parentFactory.build()
        const parentKey = "explicit-target"

        // Act
        const child = childFactory.build({
          parentKey,
          parent,
        })

        // Assert
        assert.deepEqual(child.parent, {
          [targetKey]: parentKey,
        })
      })
    })

    test(`when ${condition}, an explicit build foreign key leaves the supplied target unchanged`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = parentFactory.build()
        const originalTarget = parent[targetKey]

        // Act
        childFactory.build({
          parentKey: "explicit-target",
          parent,
        })

        // Assert
        assert.equal(parent[targetKey], originalTarget)
      })
    })

    test(`when ${condition}, create returns the generated parent's target key`, async () => {
      // Arrange
      await withFixture(async ({ childFactory }) => {
        // Act
        const child = await childFactory.create()

        // Assert
        assert.equal(child.parentKey, child.parent?.[targetKey])
      })
    })

    test(`when ${condition}, create persists the generated parent's target key on the child`, async () => {
      // Arrange
      await withFixture(async ({ Child, childFactory }) => {
        // Act
        const child = await childFactory.create()

        // Assert
        const storedChild = await Child.findByPk(child.id)
        assert.equal(storedChild?.parentKey, child.parent?.[targetKey])
      })
    })

    test(`when ${condition}, create persists the generated parent`, async () => {
      // Arrange
      await withFixture(async ({ Parent, childFactory }) => {
        // Act
        const child = await childFactory.create()

        // Assert
        const storedParent = await Parent.findOne({
          where: {
            key: child.parent!.key,
          },
        })
        assert.equal(storedParent?.[targetKey], child.parentKey)
      })
    })

    test(`when ${condition}, create reuses a supplied persisted parent`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const parent = await parentFactory.create()

        // Act
        const child = await childFactory.create({
          parent,
        })

        // Assert
        assert.equal(child.parent?.key, parent.key)
      })
    })

    test(`when ${condition}, create persists a supplied parent's target key on the child`, async () => {
      // Arrange
      await withFixture(async ({ Child, parentFactory, childFactory }) => {
        const parent = await parentFactory.create()

        // Act
        const child = await childFactory.create({
          parent,
        })

        // Assert
        const storedChild = await Child.findByPk(child.id)
        assert.equal(storedChild?.parentKey, parent[targetKey])
      })
    })

    test(`when ${condition}, create does not generate another supplied parent`, async () => {
      // Arrange
      await withFixture(async ({ Parent, parentFactory, childFactory }) => {
        const parent = await parentFactory.create()

        // Act
        await childFactory.create({
          parent,
        })

        // Assert
        assert.equal(await Parent.count(), 1)
      })
    })

    test(`when ${condition}, create loads a foreign key override by target key instead of primary key`, async () => {
      // Arrange
      await withFixture(async ({ parentFactory, childFactory }) => {
        const referencedParent = await parentFactory.create({
          key: "referenced-primary",
          code: "referenced-unique",
          name: "Referenced parent",
        })
        const suppliedParent = await parentFactory.create()

        // Act
        const child = await childFactory.create({
          parentKey: referencedParent[targetKey],
          parent: suppliedParent,
        })

        // Assert
        assert.equal(child.parent?.name, referencedParent.name)
      })
    })

    test(`when ${condition}, create persists an override ahead of a supplied parent`, async () => {
      // Arrange
      await withFixture(async ({ Child, parentFactory, childFactory }) => {
        const referencedParent = await parentFactory.create()
        const suppliedParent = await parentFactory.create()

        // Act
        const child = await childFactory.create({
          parentKey: referencedParent[targetKey],
          parent: suppliedParent,
        })

        // Assert
        const storedChild = await Child.findByPk(child.id)
        assert.equal(storedChild?.parentKey, referencedParent[targetKey])
      })
    })

    test(`when ${condition}, create with an override does not generate a parent`, async () => {
      // Arrange
      await withFixture(async ({ Parent, parentFactory, childFactory }) => {
        const parent = await parentFactory.create()

        // Act
        await childFactory.create({
          parentKey: parent[targetKey],
        })

        // Assert
        assert.equal(await Parent.count(), 1)
      })
    })
  }
}

registerTargetKeyScenarios("Sequelize 6", createSequelizeV6TargetKeyFixture)
registerTargetKeyScenarios("Sequelize 7", createSequelizeV7TargetKeyFixture)
