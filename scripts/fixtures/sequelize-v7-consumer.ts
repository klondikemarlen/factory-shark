import assert from "node:assert/strict"

import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
  NonAttribute,
} from "@sequelize/core"
import { DataTypes, Model, Sequelize } from "@sequelize/core"
import { SqliteDialect } from "@sequelize/sqlite3"

import { FactoryContext, FactoryShark } from "factory-shark"
import type { FactoryInterface, FactoryParams } from "factory-shark"

class OrganizationRecord extends Model<
  InferAttributes<OrganizationRecord>,
  InferCreationAttributes<OrganizationRecord>
> {
  declare id: CreationOptional<number>
  declare name: string
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
  declare organization?: NonAttribute<OrganizationRecord>
}

async function verifyRootConsumer(): Promise<void> {
  class Organization extends OrganizationRecord {}
  class Project extends ProjectRecord {}

  const sequelize = new Sequelize({
    dialect: SqliteDialect,
    storage: ":memory:",
    logging: false,
  })

  try {
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
      {
        sequelize,
      }
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
      },
      {
        sequelize,
      }
    )
    Project.belongsTo(Organization, {
      as: "organization",
      foreignKey: "organizationId",
    })

    const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
      name: `Organization ${sequence}`,
    }))
    const projectFactory = FactoryShark.define(Project, ({ associate }) => {
      associate<OrganizationRecord>("organization", organizationFactory)

      return {
        title: "Root Sequelize 7 consumer",
        nullableNote: null,
        metadata: {
          source: "packed root entry",
        },
      }
    })
    const project = projectFactory.build()

    assert.equal(project instanceof Project, true)
    assert.equal(project.title, "Root Sequelize 7 consumer")
  } finally {
    await sequelize.close()
  }
}

function checkRootConsumerTypes(
  Project: ModelStatic<ProjectRecord>,
  Organization: ModelStatic<OrganizationRecord>
) {
  const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
    name: `Typed organization ${sequence}`,
  }))
  const projectFactory = FactoryShark.define(Project, ({ associate }) => {
    associate<OrganizationRecord>("organization", organizationFactory)

    return {
      title: "Typed project",
      nullableNote: null,
      metadata: {
        source: "typed root consumer",
      },
    }
  })

  const modelClass: ModelStatic<ProjectRecord> = projectFactory.modelClass
  const directModelRows: Promise<ProjectRecord[]> = projectFactory.modelClass.findAll()
  const configuredModelClass: ModelStatic<ProjectRecord> = projectFactory.params({
    title: "Configured typed project",
  }).modelClass
  const configuredModelRows: Promise<ProjectRecord[]> = configuredModelClass.findAll()
  const chainedModelClass: ModelStatic<ProjectRecord> = projectFactory.beforeCreate((project) => {
    project.title = "Changed by typed hook"
  }).modelClass
  const chainedModelRows: Promise<ProjectRecord[]> = chainedModelClass.findAll()
  const factoryContract: FactoryInterface<ProjectRecord> = projectFactory
  const factoryContext = new FactoryContext(Project)
  factoryContext.associate<OrganizationRecord>("organization", organizationFactory)
  const registration = factoryContext.registrations[0]
  registration.instance.get("id")
  void registration.create({}).then((organization) => organization.get("id"))
  void modelClass
  void directModelRows
  void configuredModelRows
  void chainedModelRows
  void factoryContract

  const nullableParams: FactoryParams<ProjectRecord> = {
    nullableNote: null,
  }
  projectFactory.build(nullableParams)

  // @ts-expect-error Factory params reject unknown attribute names.
  projectFactory.create({ unknownAttribute: true })

  // @ts-expect-error Association params require an ORM model instance.
  projectFactory.create({ organization: "not an organization" })

  FactoryShark.define(Project, () => ({
    title: "Valid generator result",
    nullableNote: null,
    metadata: {
      source: "typed generator",
    },
    // @ts-expect-error Generator results reject unknown keys.
    unknownAttribute: true,
  }))

  FactoryShark.define(Project, ({ associate }) => {
    // @ts-expect-error Unknown names are not associations.
    associate("missing", organizationFactory)

    // @ts-expect-error Scalar attributes are not associations.
    associate("title", organizationFactory)

    // @ts-expect-error JSON attributes are not associations.
    associate("metadata", organizationFactory)

    return {
      title: "Invalid associations remain rejected",
      nullableNote: null,
      metadata: {
        source: "invalid association checks",
      },
    }
  })

  FactoryShark.define(Project, () => ({
    // @ts-expect-error Non-nullable model attributes reject null.
    title: null,
    nullableNote: null,
    metadata: {
      source: "invalid scalar check",
    },
  }))
}

void checkRootConsumerTypes

verifyRootConsumer().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
