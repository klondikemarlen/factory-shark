import assert from "node:assert/strict"

import type {
  CreationOptional,
  ForeignKey,
  Includeable,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
  NonAttribute,
} from "sequelize"
import { DataTypes, Model, Sequelize } from "sequelize"

import FactorySharkDefault, { FactoryContext, FactoryShark } from "factory-shark"
import type { FactoryInterface, FactoryParams } from "factory-shark"

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
  declare startedAt?: Date
  declare payload?: Buffer
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

  const organizationFactory = FactorySharkDefault.define(Organization, ({ sequence }) => ({
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
    const projects = await fixture.projectFactory.createList(2, {
      organizationId: existingOrganization.id,
    })
    assert.deepEqual(
      projects.map((project) => project.displayTitle()),
      ["Project 2", "Project 3"]
    )
    assert.equal(await fixture.Organization.count(), 2)

    const associatedFactory = fixture.projectFactory
      .associations({
        organization: existingOrganization,
      })
      .params({
        nullableNote: "Configured list",
      })
    const associatedProjects = await associatedFactory.createList(2)
    assert.deepEqual(
      associatedProjects.map((project) => project.displayTitle()),
      ["Project 1", "Project 2"]
    )
    for (const project of associatedProjects) {
      const persistedProject = await fixture.Project.findByPk(project.id)
      const category = await fixture.Category.findByPk(project.categoryId)
      assert.equal(persistedProject?.organizationId, existingOrganization.id)
      assert.equal(persistedProject?.nullableNote, "Configured list")
      assert.equal(category?.organizationId, existingOrganization.id)
    }

    const startedAt = new Date("2026-01-02T03:04:05.000Z")
    const payload = Buffer.from([0, 128, 255])
    const attributes = fixture.projectFactory.attributesFor({
      startedAt,
      payload,
    })
    assert.equal(attributes instanceof fixture.Project, false)
    assert.equal(attributes.title, "Project 4")
    assert.ok(attributes.startedAt instanceof Date)
    assert.equal(attributes.startedAt.getTime(), startedAt.getTime())
    assert.ok(Buffer.isBuffer(attributes.payload))
    assert.deepEqual(attributes.payload, payload)
    assert.equal(fixture.projectFactory.build().title, "Project 5")

    const attributeHookEvents: string[] = []

    const projectWithNote = (note: string) => {
      return fixture.projectFactory
        .params({
          nullableNote: note,
        })
        .associations({
          organization: existingOrganization,
        })
        .beforeCreate(() => {
          attributeHookEvents.push("before")
        })
        .afterCreate(async () => {
          attributeHookEvents.push("after")
        })
    }

    const domainFactory = projectWithNote("Configured attributes")
    const configuredAttributes = domainFactory.attributesFor({
      organizationId: existingOrganization.id,
      metadata: {
        source: "attributes override",
      },
    })
    assert.equal(configuredAttributes.title, "Project 1")
    assert.equal(configuredAttributes.nullableNote, "Configured attributes")
    assert.equal(configuredAttributes.organizationId, existingOrganization.id)
    assert.deepEqual(configuredAttributes.metadata, {
      source: "attributes override",
    })
    assert.equal(domainFactory.build().title, "Project 2")
    assert.deepEqual(attributeHookEvents, [])

    const suppliedOrganizationFactory = fixture.projectFactory.associations({
      organization: existingOrganization,
    })
    const suppliedOrganizationProject = suppliedOrganizationFactory.build()
    assert.equal(suppliedOrganizationProject.organization, existingOrganization)
    assert.equal(suppliedOrganizationProject.organizationId, existingOrganization.id)

    const unsavedOrganization = fixture.organizationFactory.build()
    const unsavedOrganizationProject = fixture.projectFactory
      .associations({
        organization: unsavedOrganization,
      })
      .build()
    assert.equal(unsavedOrganizationProject.organization, unsavedOrganization)
    assert.equal(unsavedOrganization.isNewRecord, true)
    assert.ok(unsavedOrganization.id == null)
    assert.ok(unsavedOrganizationProject.organizationId == null)

    const suppliedOrganizationValues = existingOrganization.get({
      plain: true,
    })
    const conflictingOrganizationProject = suppliedOrganizationFactory.build({
      organizationId: 7001,
    })
    assert.notEqual(conflictingOrganizationProject.organization, existingOrganization)
    assert.deepEqual(conflictingOrganizationProject.organization, { id: 7001 })
    assert.equal(conflictingOrganizationProject.organizationId, 7001)
    assert.deepEqual(
      existingOrganization.get({
        plain: true,
      }),
      suppliedOrganizationValues
    )

    const overridingOrganization = fixture.Organization.build({
      id: 7002,
      name: "Call-time organization",
    })
    const overriddenOrganizationProject = suppliedOrganizationFactory.build({
      organization: overridingOrganization,
    })
    assert.equal(overriddenOrganizationProject.organization, overridingOrganization)
    assert.equal(overriddenOrganizationProject.organizationId, overridingOrganization.id)

    const suppliedOrganizationAttributes = suppliedOrganizationFactory.attributesFor()
    assert.equal(suppliedOrganizationAttributes.organizationId, existingOrganization.id)
    assert.equal("organization" in suppliedOrganizationAttributes, false)
    assert.equal(await fixture.Project.count(), 5)
    assert.equal(await fixture.Organization.count(), 2)
    assert.equal(await fixture.Category.count(), 5)

    const persistedCategory = await fixture.Category.create({
      name: "Persisted include category",
      organizationId: existingOrganization.id,
    })
    const persistedRelationshipFactory = FactoryShark.define(fixture.Project, () => ({
      title: "Eager-loaded project",
      nullableNote: null,
      metadata: {
        source: "persisted relationships",
      },
      organizationId: existingOrganization.id,
      categoryId: persistedCategory.id,
    }))
    const includedFactory = persistedRelationshipFactory
      .params({
        nullableNote: "Configured include",
      })
      .include("missingAssociation")
      .include({
        association: "category",
        include: ["organization"],
      })
      .afterCreate((project) => {
        const category = project.get("category")
        assert.ok(category instanceof fixture.Category)
        const organization = category.get("organization")
        assert.ok(organization instanceof fixture.Organization)
        assert.equal(organization.name, existingOrganization.name)
        project.nullableNote = "Unsaved afterCreate change"
      })
    const includedProjects = await includedFactory.createList(2)
    for (const project of includedProjects) {
      const category = project.get("category")
      assert.ok(category instanceof fixture.Category)
      assert.equal(category.id, persistedCategory.id)
      assert.equal(category.get("organization")?.id, existingOrganization.id)
      assert.equal(project.displayTitle(), "Eager-loaded project")
      assert.equal(project.nullableNote, "Unsaved afterCreate change")
      const persistedProject = await fixture.Project.findByPk(project.id)
      assert.equal(persistedProject?.nullableNote, "Configured include")
    }

    const invalidIncludeFactory = persistedRelationshipFactory.include("missingAssociation")
    const clearedProject = await invalidIncludeFactory.include(undefined).create()
    const emptyIncludeProject = await invalidIncludeFactory.include([]).create()
    assert.equal(clearedProject.get("category"), undefined)
    assert.equal(emptyIncludeProject.get("category"), undefined)

    console.log(
      "Packed Sequelize 6 consumer PASS: attributesFor, configured factories, supplied association builds, createList, nested includes, include replacement/clearing, and hook visibility"
    )
  } finally {
    await fixture.sequelize.close()
  }
}

// This function compiles but never runs; it protects the installed public declarations.
export function checkInstalledConsumerTypes(
  Project: ModelStatic<ConcreteProjectRecord>,
  Organization: ModelStatic<OrganizationRecord>
) {
  const defaultProjectFactory = FactorySharkDefault.define(Project, () => ({
    title: "Typed default project",
    nullableNote: null,
    metadata: {
      source: "typed default",
    },
  }))
  const defaultProject: ConcreteProjectRecord = defaultProjectFactory.build()
  void defaultProject

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
  const createdProjects: Promise<ConcreteProjectRecord[]> = projectFactory.createList(2, {
    nullableNote: null,
  })
  const configuredProjects: Promise<ConcreteProjectRecord[]> = factoryContract
    .params({
      title: "Configured list project",
    })
    .createList(2)
  const createdTitle: Promise<string> = createdProjects.then((projects) =>
    projects[0].displayTitle()
  )
  void configuredProjects
  void createdTitle
  void project
  void modelClass
  void chainedModelClass
  void factoryContract
  void directModelRows
  void configuredModelRows

  const nativeInclude: Includeable = {
    model: Organization,
    as: "organization",
  }
  projectFactory.include(Organization)
  projectFactory.include("organization")
  projectFactory.include(Project.associations.organization)
  const includedProject: Promise<ConcreteProjectRecord> = projectFactory
    .include(nativeInclude)
    .params({
      nullableNote: "Typed include",
    })
    .include({
      association: "category",
      include: ["organization"],
    })
    .create()
  const includedProjects: Promise<ConcreteProjectRecord[]> = factoryContract
    .include([nativeInclude])
    .include(undefined)
    .include([])
    .createList(2)
  const includedTitle: Promise<string> = includedProject.then((project) => project.displayTitle())
  void includedProjects
  void includedTitle

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
  const defaultAttributes = defaultProjectFactory.attributesFor()
  const defaultTitle: string = defaultAttributes.title
  void attributeTitle
  void attributeNote
  void attributeSource
  void configuredTitle
  void defaultTitle

  // @ts-expect-error Attributes are not model instances.
  attributes.displayTitle()

  // @ts-expect-error Attribute overrides reject unknown names.
  projectFactory.attributesFor({ unknownAttribute: true })

  // @ts-expect-error Attribute overrides preserve scalar types.
  projectFactory.params({}).attributesFor({ title: 42 })

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

  // @ts-expect-error List parameters reject unknown factory parameter keys.
  projectFactory.createList(2, { unknownAttribute: true })

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
