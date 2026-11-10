import assert from "node:assert/strict"

import type {
  CreationOptional,
  ForeignKey,
  Includeable,
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
  declare parentId?: ForeignKey<OrganizationRecord["id"]>
  declare parent?: NonAttribute<OrganizationRecord>
  declare projects?: NonAttribute<ProjectRecord[]>
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
        parentId: {
          type: DataTypes.INTEGER,
          allowNull: true,
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
    Organization.belongsTo(Organization, {
      as: "parent",
      foreignKey: "parentId",
    })
    Organization.hasMany(Project, {
      as: "projects",
      foreignKey: "organizationId",
      inverse: {
        as: "organization",
      },
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

    const builtProjects: ProjectRecord[] = projectFactory.buildList(2, {
      nullableNote: null,
    })
    assert.deepEqual(
      builtProjects.map((project) => project.title),
      ["Root Sequelize 7 consumer 7", "Root Sequelize 7 consumer 8"]
    )
    assert.equal(projectFactory.build().title, "Root Sequelize 7 consumer 9")
    for (const project of builtProjects) {
      assert.equal(project instanceof Project, true)
      assert.equal(project.isNewRecord, true)
    }

    const buildListHookEvents: string[] = []
    const configuredBuildFactory = projectFactory
      .associations({
        organization: associatedOrganization,
      })
      .params({
        nullableNote: "Configured unsaved list",
      })
      .include("missingAssociation")
      .beforeCreate(() => {
        buildListHookEvents.push("before")
      })
      .afterCreate(async () => {
        buildListHookEvents.push("after")
      })
    const configuredBuiltProjects = configuredBuildFactory.buildList(2, {
      metadata: {
        source: "unsaved list override",
      },
    })
    assert.deepEqual(
      configuredBuiltProjects.map((project) => project.title),
      ["Root Sequelize 7 consumer 1", "Root Sequelize 7 consumer 2"]
    )
    assert.equal(configuredBuildFactory.build().title, "Root Sequelize 7 consumer 3")
    for (const project of configuredBuiltProjects) {
      assert.equal(project.isNewRecord, true)
      assert.equal(project.organization, associatedOrganization)
      assert.equal(project.organizationId, associatedOrganization.id)
      assert.equal(project.nullableNote, "Configured unsaved list")
      assert.deepEqual(project.metadata, {
        source: "unsaved list override",
      })
    }
    assert.deepEqual(buildListHookEvents, [])
    assert.equal(await Project.count(), 5)
    assert.equal(await Organization.count(), 3)

    const parentOrganization = await Organization.create({
      name: "Persisted parent organization",
    })
    const childOrganization = await Organization.create({
      name: "Persisted child organization",
      parentId: parentOrganization.id,
    })
    const persistedRelationshipFactory = FactoryShark.define(Project, () => ({
      title: "Eager-loaded project",
      nullableNote: null,
      metadata: {
        source: "persisted relationships",
      },
      organizationId: childOrganization.id,
    }))
    const includedFactory = persistedRelationshipFactory
      .params({
        nullableNote: "Configured include",
      })
      .include("missingAssociation")
      .include({
        association: "organization",
        include: ["parent"],
      })
      .afterCreate(async (project) => {
        const organization = project.get("organization")
        assert.ok(organization instanceof Organization)
        const parent = organization.get("parent")
        assert.ok(parent instanceof Organization)
        assert.equal(parent.name, parentOrganization.name)
        project.nullableNote = "Unsaved afterCreate change"
      })
    const includedProjects = await includedFactory.createList(2)
    for (const project of includedProjects) {
      const organization = project.get("organization")
      assert.ok(organization instanceof Organization)
      assert.equal(organization.id, childOrganization.id)
      assert.equal(organization.get("parent")?.id, parentOrganization.id)
      assert.equal(project.nullableNote, "Unsaved afterCreate change")
      const persistedProject = await Project.findByPk(project.id)
      assert.equal(persistedProject?.nullableNote, "Configured include")
    }

    const invalidIncludeFactory = persistedRelationshipFactory.include("missingAssociation")
    const clearedProject = await invalidIncludeFactory.include(undefined).create()
    const emptyIncludeProject = await invalidIncludeFactory.include([]).create()
    assert.equal(clearedProject.get("organization"), undefined)
    assert.equal(emptyIncludeProject.get("organization"), undefined)

    const suppliedProjects = projectFactory.buildList(2, {
      title: "Supplied collection project",
      organizationId: 7001,
      nullableNote: "Preserved child note",
    })
    const collectionFactory = organizationFactory.associations({
      projects: suppliedProjects,
    })
    const builtOrganization = collectionFactory.build()
    assert.equal(builtOrganization.projects?.[0], suppliedProjects[0])
    assert.equal(builtOrganization.projects?.[1], suppliedProjects[1])
    assert.equal(builtOrganization.isNewRecord, true)
    assert.equal("projects" in collectionFactory.attributesFor(), false)
    assert.equal(await Project.count(), 9)
    assert.equal(await Organization.count(), 5)

    const collectionOrganization = await collectionFactory
      .afterCreate(async (organization) => {
        await organization.reload({
          include: {
            association: "projects",
            include: ["organization"],
          },
        })
        assert.equal(organization.projects?.length, 2)
        for (const project of organization.projects ?? []) {
          assert.equal(project.organization?.id, organization.id)
        }
      })
      .create()
    for (const project of suppliedProjects) {
      assert.equal(project.isNewRecord, false)
      assert.equal(project.organizationId, collectionOrganization.id)
      const persistedProject = await Project.findByPk(project.id)
      assert.equal(persistedProject?.title, "Supplied collection project")
      assert.equal(persistedProject?.nullableNote, "Preserved child note")
      assert.equal(persistedProject?.organizationId, collectionOrganization.id)
    }
    assert.equal(await Project.count(), 11)
    assert.equal(await Organization.count(), 6)

    const emptyOrganization = await organizationFactory.create({
      projects: [],
    })
    assert.deepEqual(emptyOrganization.projects, [])
    assert.equal(await Project.count(), 11)
    assert.equal(await Organization.count(), 7)

    console.log(
      "Packed Sequelize 7 consumer PASS: attributesFor, configured factories, supplied association builds, buildList, createList, nested includes, include replacement/clearing, and hook visibility"
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

  const suppliedProjects: ProjectRecord[] = projectFactory.buildList(2)
  organizationFactory.associations({ projects: suppliedProjects }).build()
  organizationFactory.params({ projects: suppliedProjects }).buildList(2)
  organizationFactory.create({ projects: suppliedProjects })
  organizationFactory.build({ projects: [] })

  // @ts-expect-error Collection params require an array, not a scalar model.
  organizationFactory.params({ projects: suppliedProjects[0] })

  // @ts-expect-error Collection association defaults require an array.
  organizationFactory.associations({ projects: suppliedProjects[0] })

  // @ts-expect-error Collection params reject scalar array elements.
  organizationFactory.params({ projects: ["not a project"] })

  // @ts-expect-error Collection association defaults reject scalar array elements.
  organizationFactory.associations({ projects: [42] })

  // @ts-expect-error Collection params retain the associated model type.
  organizationFactory.build({ projects: [organizationFactory.build()] })

  // @ts-expect-error Collection defaults retain the associated model type.
  organizationFactory.associations({ projects: [organizationFactory.build()] })

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
  const builtProjects: ProjectRecord[] = projectFactory.buildList(2, {
    nullableNote: null,
    metadata: {
      source: "typed build list",
    },
  })
  const configuredBuiltProjects: ProjectRecord[] = factoryContract
    .params({
      nullableNote: "Configured unsaved list",
    })
    .buildList(2, {
      title: "Typed unsaved project",
    })
  const builtTitle: string = builtProjects[0].title
  const configuredBuiltSource: string = configuredBuiltProjects[0].metadata.source
  void builtTitle
  void configuredBuiltSource
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

  const nativeInclude: Includeable = {
    model: Organization,
    as: "organization",
  }
  projectFactory.include(Organization)
  projectFactory.include("organization")
  projectFactory.include(Project.associations.organization)
  const includedProject: Promise<ProjectRecord> = projectFactory
    .include(nativeInclude)
    .params({
      nullableNote: "Typed include",
    })
    .include({
      association: "organization",
      include: ["parent"],
    })
    .create()
  const includedProjects: Promise<ProjectRecord[]> = factoryContract
    .include([nativeInclude])
    .include(undefined)
    .include([])
    .createList(2)
  void includedProject
  void includedProjects

  // @ts-expect-error Include selections reject numbers.
  projectFactory.include(42)

  // @ts-expect-error Configured selections retain native association types.
  projectFactory.params({}).include({ association: 42 })

  // @ts-expect-error Include selections reject unknown option names.
  projectFactory.include({ invalidIncludeOption: true })

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

  // @ts-expect-error Unsaved list params reject unknown attribute names.
  projectFactory.buildList(2, { unknownAttribute: true })

  // @ts-expect-error Configured unsaved list params preserve scalar types.
  factoryContract.params({}).buildList(2, { title: 42 })

  // @ts-expect-error Unsaved list counts must be numbers.
  projectFactory.buildList("2")

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
