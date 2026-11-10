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
  declare startedAt?: Date
  declare payload?: Buffer
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
        startedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        payload: {
          type: DataTypes.BLOB,
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

    const startedAt = new Date("2026-01-02T03:04:05.000Z")
    const payload = Buffer.from([0, 128, 255])
    const attributes = projectFactory.attributesFor({
      startedAt,
      payload,
    })
    assert.equal(attributes instanceof Project, false)
    assert.equal(attributes.title, "Root Sequelize 7 consumer 5")
    assert.ok(attributes.startedAt instanceof Date)
    assert.equal(attributes.startedAt.getTime(), startedAt.getTime())
    assert.ok(Buffer.isBuffer(attributes.payload))
    assert.deepEqual(attributes.payload, payload)
    assert.equal(projectFactory.build().title, "Root Sequelize 7 consumer 6")

    const hookEvents: string[] = []

    const projectWithNote = (note: string) => {
      return projectFactory
        .params({
          nullableNote: note,
        })
        .associations({
          organization: associatedOrganization,
        })
        .beforeCreate(() => {
          hookEvents.push("before")
        })
        .afterCreate(async () => {
          hookEvents.push("after")
        })
    }

    const domainFactory = projectWithNote("Configured attributes")
    const configuredAttributes = domainFactory.attributesFor({
      organizationId: associatedOrganization.id,
      metadata: {
        source: "attributes override",
      },
    })
    assert.equal(configuredAttributes.title, "Root Sequelize 7 consumer 1")
    assert.equal(configuredAttributes.nullableNote, "Configured attributes")
    assert.equal(configuredAttributes.organizationId, associatedOrganization.id)
    assert.deepEqual(configuredAttributes.metadata, {
      source: "attributes override",
    })
    assert.equal(domainFactory.build().title, "Root Sequelize 7 consumer 2")
    assert.deepEqual(hookEvents, [])

    const suppliedOrganizationFactory = projectFactory.associations({
      organization: associatedOrganization,
    })
    const suppliedOrganizationProject = suppliedOrganizationFactory.build()
    assert.equal(suppliedOrganizationProject.organization, associatedOrganization)
    assert.equal(suppliedOrganizationProject.organizationId, associatedOrganization.id)

    const unsavedOrganization = organizationFactory.build()
    const unsavedOrganizationProject = projectFactory
      .associations({
        organization: unsavedOrganization,
      })
      .build()
    assert.equal(unsavedOrganizationProject.organization, unsavedOrganization)
    assert.equal(unsavedOrganization.isNewRecord, true)
    assert.ok(unsavedOrganization.id == null)
    assert.ok(unsavedOrganizationProject.organizationId == null)

    const suppliedOrganizationValues = associatedOrganization.get({
      plain: true,
    })
    const conflictingOrganizationProject = suppliedOrganizationFactory.build({
      organizationId: 7001,
    })
    assert.notEqual(conflictingOrganizationProject.organization, associatedOrganization)
    assert.deepEqual(conflictingOrganizationProject.organization, { id: 7001 })
    assert.equal(conflictingOrganizationProject.organizationId, 7001)
    assert.deepEqual(
      associatedOrganization.get({
        plain: true,
      }),
      suppliedOrganizationValues
    )

    const overridingOrganization = Organization.build({
      id: 7002,
      name: "Call-time organization",
    })
    const overriddenOrganizationProject = suppliedOrganizationFactory.build({
      organization: overridingOrganization,
    })
    assert.equal(overriddenOrganizationProject.organization, overridingOrganization)
    assert.equal(overriddenOrganizationProject.organizationId, overridingOrganization.id)

    const suppliedOrganizationAttributes = suppliedOrganizationFactory.attributesFor()
    assert.equal(suppliedOrganizationAttributes.organizationId, associatedOrganization.id)
    assert.equal("organization" in suppliedOrganizationAttributes, false)
    assert.equal(await Project.count(), 5)
    assert.equal(await Organization.count(), 3)
    console.log(
      "Packed Sequelize 7 consumer PASS: attributesFor, configured factories, supplied association builds, createList, and belongsTo"
    )
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

  const attributes = projectFactory.attributesFor({
    nullableNote: null,
  })
  const attributeTitle: string = attributes.title
  const attributeNote: string | null = attributes.nullableNote
  const attributeSource: string = attributes.metadata.source
  const configuredAttributes = factoryContract
    .params({
      title: "Configured attributes",
    })
    .beforeCreate(() => {})
    .afterCreate(async () => {})
    .attributesFor()
  const configuredTitle: string = configuredAttributes.title
  const defaultAttributes = defaultOrganizationFactory.attributesFor()
  const defaultName: string = defaultAttributes.name
  void attributeTitle
  void attributeNote
  void attributeSource
  void configuredTitle
  void defaultName

  // @ts-expect-error Attributes are not model instances.
  attributes.save()

  // @ts-expect-error Attribute overrides reject unknown names.
  projectFactory.attributesFor({ unknownAttribute: true })

  // @ts-expect-error Attribute overrides preserve scalar types.
  projectFactory.params({}).attributesFor({ title: 42 })

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
