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

import FactorySharkDefault, { FactoryContext, FactoryShark } from "factory-shark"
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
    pool: {
      max: 1,
      idle: Infinity,
      maxUses: Infinity,
    },
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

    const organizationFactory = FactorySharkDefault.define(Organization, ({ sequence }) => ({
      name: `Packed organization ${sequence}`,
    }))
    const projectFactory = FactoryShark.define(Project, ({ sequence, associate }) => {
      associate<OrganizationRecord>("organization", organizationFactory)

      return {
        title: `Root Sequelize 7 consumer ${sequence}`,
        nullableNote: null,
        metadata: {
          source: "packed root entry",
        },
      }
    })
    await sequelize.sync({
      force: true,
    })

    const project = projectFactory.build()

    assert.equal(project instanceof Project, true)
    assert.equal(project.title, "Root Sequelize 7 consumer 1")

    const createdProject = await projectFactory.create()
    const associatedOrganization = await Organization.findByPk(createdProject.organizationId)
    assert.ok(associatedOrganization)
    assert.match(associatedOrganization.name, /^Packed organization \d+$/)

    const projects = await projectFactory.createList(2)
    assert.deepEqual(
      projects.map((project) => project.title),
      ["Root Sequelize 7 consumer 3", "Root Sequelize 7 consumer 4"]
    )
    for (const project of projects) {
      const organization = await Organization.findByPk(project.organizationId)
      assert.ok(organization)
      assert.match(organization.name, /^Packed organization \d+$/)
      const persistedCount = await Project.count({
        where: {
          id: project.id,
        },
      })
      assert.equal(persistedCount, 1)
    }

    const configuredFactory = projectFactory
      .associations({
        organization: associatedOrganization,
      })
      .params({
        nullableNote: "Configured list",
      })
    const configuredProjects = await configuredFactory.createList(2, {
      metadata: {
        source: "list override",
      },
    })
    assert.deepEqual(
      configuredProjects.map((project) => project.title),
      ["Root Sequelize 7 consumer 1", "Root Sequelize 7 consumer 2"]
    )
    for (const project of configuredProjects) {
      const persistedProject = await Project.findByPk(project.id)
      assert.equal(persistedProject?.organizationId, associatedOrganization.id)
      assert.equal(persistedProject?.nullableNote, "Configured list")
      assert.deepEqual(persistedProject?.metadata, {
        source: "list override",
      })
    }
    assert.equal(await Project.count(), 5)
    assert.equal(await Organization.count(), 3)
    console.log("Packed Sequelize 7 consumer PASS: root and configured createList with belongsTo")
  } finally {
    await sequelize.close()
  }
}

function checkRootConsumerTypes(
  Project: ModelStatic<ProjectRecord>,
  Organization: ModelStatic<OrganizationRecord>
) {
  const defaultOrganizationFactory = FactorySharkDefault.define(Organization, ({ sequence }) => ({
    name: `Typed organization ${sequence}`,
  }))
  const defaultOrganization: OrganizationRecord = defaultOrganizationFactory.build()
  void defaultOrganization

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
  const createdProjects: Promise<ProjectRecord[]> = projectFactory.createList(2, {
    nullableNote: null,
  })
  const configuredProjects: Promise<ProjectRecord[]> = factoryContract
    .params({
      title: "Configured list project",
    })
    .createList(2)
  const createdTitle: Promise<string> = createdProjects.then((projects) => projects[0].title)
  void configuredProjects
  void createdTitle
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

  // @ts-expect-error List params reject unknown attribute names.
  projectFactory.createList(2, { unknownAttribute: true })

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
