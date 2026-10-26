import assert from "node:assert/strict"

import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
  NonAttribute,
} from "sequelize"
import { DataTypes, Model, Sequelize } from "sequelize"

import { FactoryContext, FactoryShark } from "factory-shark/sequelize-v6"
import type { FactoryInterface, FactoryParams } from "factory-shark/sequelize-v6"

class OrganizationRecord extends Model<
  InferAttributes<OrganizationRecord>,
  InferCreationAttributes<OrganizationRecord>
> {
  declare id: CreationOptional<number>
  declare name: string
}

class CategoryRecord extends Model<
  InferAttributes<CategoryRecord>,
  InferCreationAttributes<CategoryRecord>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare organizationId: ForeignKey<OrganizationRecord["id"]>
  declare organization?: NonAttribute<OrganizationRecord>
}

class ProjectRecord extends Model<
  InferAttributes<ProjectRecord>,
  InferCreationAttributes<ProjectRecord>
> {
  declare id: CreationOptional<number>
  declare title: string
  declare nullableNote: string | null
  declare metadata: {
    source: string
  }
  declare organizationId: ForeignKey<OrganizationRecord["id"]>
  declare categoryId: ForeignKey<CategoryRecord["id"]>
  declare organization?: NonAttribute<OrganizationRecord>
  declare category?: NonAttribute<CategoryRecord>
}

class ConcreteProjectRecord extends ProjectRecord {
  displayTitle(): string {
    return this.title
  }
}

interface Fixture {
  sequelize: Sequelize
  Organization: ModelStatic<OrganizationRecord>
  Category: ModelStatic<CategoryRecord>
  Project: ModelStatic<ConcreteProjectRecord>
  organizationFactory: FactoryInterface<OrganizationRecord>
  projectFactory: FactoryInterface<ConcreteProjectRecord>
}

function createFixture(): Fixture {
  class Organization extends OrganizationRecord {}
  class Category extends CategoryRecord {}
  class Project extends ConcreteProjectRecord {}

  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: ":memory:",
    logging: false,
  })

  Organization.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    { sequelize }
  )

  Category.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    { sequelize }
  )

  Project.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nullableNote: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    { sequelize }
  )

  Project.belongsTo(Organization, {
    as: "organization",
    foreignKey: "organizationId",
  })
  Project.belongsTo(Category, {
    as: "category",
    foreignKey: "categoryId",
  })
  Category.belongsTo(Organization, {
    as: "organization",
    foreignKey: "organizationId",
  })

  const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
    name: `Organization ${sequence}`,
  }))
  const categoryFactory = FactoryShark.define(Category, ({ sequence, associate }) => {
    associate("organization", organizationFactory)

    return {
      name: `Category ${sequence}`,
    }
  })
  const projectFactory = FactoryShark.define(Project, ({ sequence, associate }) => {
    associate<OrganizationRecord>("organization", organizationFactory)
    associate("category", categoryFactory, ({ organizationId }) => ({
      organizationId,
    }))

    return {
      title: `Project ${sequence}`,
      nullableNote: null,
      metadata: {
        source: "factory",
      },
    }
  })

  return {
    sequelize,
    Organization,
    Category,
    Project,
    organizationFactory,
    projectFactory,
  }
}

async function verifyInstalledConsumer(): Promise<void> {
  const fixture = createFixture()

  try {
    await fixture.sequelize.sync({
      force: true,
    })

    const builtProject = fixture.projectFactory.build()
    assert.equal(builtProject.isNewRecord, true)
    assert.equal(builtProject.displayTitle(), "Project 1")
    assert.equal(await fixture.Project.count(), 0)

    const hookEvents: string[] = []
    const observedFactory = fixture.projectFactory
      .beforeCreate((project) => {
        hookEvents.push(`before:${project.isNewRecord}:${project.organizationId}`)
      })
      .afterCreate(async (project) => {
        hookEvents.push(`after:${project.isNewRecord}:${project.id}`)
      })

    const project = await observedFactory.create()
    const category = await fixture.Category.findByPk(project.categoryId)
    assert.equal(category?.organizationId, project.organizationId)
    assert.deepEqual(hookEvents, [
      `before:true:${project.organizationId}`,
      `after:false:${project.id}`,
    ])

    const existingOrganization = await fixture.organizationFactory.create()
    await fixture.projectFactory.create({
      organizationId: existingOrganization.id,
    })
    assert.equal(await fixture.Organization.count(), 2)

    const associatedFactory = fixture.projectFactory.associations({
      organization: existingOrganization,
    })
    const associatedProject = await associatedFactory.create()
    assert.equal(associatedProject.organizationId, existingOrganization.id)
    assert.equal(await fixture.Organization.count(), 2)

    console.log("Packed Sequelize 6 consumer PASS: build, nested belongsTo, overrides, and hooks")
  } finally {
    await fixture.sequelize.close()
  }
}

// This function compiles but never runs; it protects the installed public declarations.
export function checkInstalledConsumerTypes(
  Project: ModelStatic<ConcreteProjectRecord>,
  Organization: ModelStatic<OrganizationRecord>
) {
  const projectFactory = FactoryShark.define(Project, () => ({
    title: "Typed project",
    nullableNote: null,
    metadata: {
      source: "typed",
    },
  }))
  const project: ConcreteProjectRecord = projectFactory.build({
    nullableNote: null,
  })
  const modelClass: ModelStatic<ConcreteProjectRecord> = projectFactory.modelClass
  const directModelRows: Promise<ConcreteProjectRecord[]> = projectFactory.modelClass.findAll()
  const configuredModelRows: Promise<ConcreteProjectRecord[]> = projectFactory
    .params({
      title: "Configured project",
    })
    .modelClass.findAll()
  const chainedModelClass: ModelStatic<ConcreteProjectRecord> = projectFactory.beforeCreate(
    (model) => {
      model.title = "Changed by typed hook"
    }
  ).modelClass
  const factoryContract: FactoryInterface<ConcreteProjectRecord> = projectFactory
  void project
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
  factoryContext.registrations[0].instance.get("id")
  void factoryContext.registrations[0].create({}).then((model) => model.get("id"))

  FactoryShark.define(Project, ({ associate }) => {
    associate<OrganizationRecord>("organization", organizationFactory)

    // @ts-expect-error Association registration rejects unknown names.
    associate("missing", organizationFactory)

    // @ts-expect-error Scalar attributes cannot be association names.
    associate("title", organizationFactory)

    // @ts-expect-error JSON attributes cannot be association names.
    associate("metadata", organizationFactory)

    return {
      title: "Typed association",
      nullableNote: null,
      metadata: {
        source: "typed association",
      },
    }
  })

  FactoryShark.define(Project, () => ({
    title: "Valid generator result",
    nullableNote: null,
    metadata: {
      source: "typed generator",
    },
    // @ts-expect-error Generator results reject unknown keys.
    unknownAttribute: true,
  }))

  FactoryShark.define(Project, () => ({
    // @ts-expect-error Non-nullable attributes reject null.
    title: null,
    nullableNote: null,
  }))

  // @ts-expect-error Unknown factory parameter keys are rejected.
  projectFactory.create({ unknownAttribute: true })

  const nullableParams: FactoryParams<ConcreteProjectRecord> = {
    nullableNote: null,
  }
  const optionalParams: FactoryParams<ConcreteProjectRecord> = {
    title: "Only an explicit override",
  }
  projectFactory.build(nullableParams)
  projectFactory.build(optionalParams)

  const invalidFactoryParams: FactoryParams<ConcreteProjectRecord> = {
    // @ts-expect-error Factory parameters preserve non-nullable attribute types.
    title: null,
  }
  void invalidFactoryParams
}

verifyInstalledConsumer().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
