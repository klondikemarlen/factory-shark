// Adapted from WRAP FactoryShark tests at 24ce6097a1f2c4d87a09dddcec88e33b8859782b under Apache-2.0; rewritten for standalone SQLite fixtures.
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

import { FactoryShark } from "../src/index.js"
import type { FactoryInterface } from "../src/index.js"

export class OrganizationRecord extends Model<
  InferAttributes<OrganizationRecord>,
  InferCreationAttributes<OrganizationRecord>
> {
  declare id: CreationOptional<number>
  declare name: string
}

export class UserRecord extends Model<
  InferAttributes<UserRecord>,
  InferCreationAttributes<UserRecord>
> {
  declare id: CreationOptional<number>
  declare name: string
}

export class CategoryRecord extends Model<
  InferAttributes<CategoryRecord>,
  InferCreationAttributes<CategoryRecord>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare organizationId: ForeignKey<OrganizationRecord["id"]>
  declare organization?: NonAttribute<OrganizationRecord>
}

export class ProjectRecord extends Model<
  InferAttributes<ProjectRecord>,
  InferCreationAttributes<ProjectRecord>
> {
  declare id: CreationOptional<number>
  declare title: string
  declare organizationId: ForeignKey<OrganizationRecord["id"]>
  declare categoryId: ForeignKey<CategoryRecord["id"]>
  declare creatorId: ForeignKey<UserRecord["id"]>
  declare organization?: NonAttribute<OrganizationRecord>
  declare category?: NonAttribute<CategoryRecord>
  declare creator?: NonAttribute<UserRecord>
}

export interface Fixture {
  sequelize: Sequelize
  Organization: ModelStatic<OrganizationRecord>
  User: ModelStatic<UserRecord>
  Category: ModelStatic<CategoryRecord>
  Project: ModelStatic<ProjectRecord>
  organizationFactory: FactoryInterface<OrganizationRecord>
  userFactory: FactoryInterface<UserRecord>
  categoryFactory: FactoryInterface<CategoryRecord>
  projectFactory: FactoryInterface<ProjectRecord>
}

export function createFixture(): Fixture {
  // Sequelize 7 binds each model class to one instance for its lifetime.
  // Fresh subclasses keep every scenario's metadata and persistence isolated.
  class Organization extends OrganizationRecord {}
  class User extends UserRecord {}
  class Category extends CategoryRecord {}
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

  User.init(
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
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      creatorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
  Project.belongsTo(User, {
    as: "creator",
    foreignKey: "creatorId",
  })
  Category.belongsTo(Organization, {
    as: "organization",
    foreignKey: "organizationId",
  })

  const organizationFactory = FactoryShark.define(Organization, ({ sequence }) => ({
    name: `Organization ${sequence}`,
  }))
  const userFactory = FactoryShark.define(User, ({ sequence }) => ({
    name: `User ${sequence}`,
  }))
  const categoryFactory = FactoryShark.define(Category, ({ sequence, associate }) => {
    associate("organization", organizationFactory)

    return { name: `Category ${sequence}` }
  })
  const projectFactory = FactoryShark.define(Project, ({ sequence, associate }) => {
    associate("organization", organizationFactory)
    associate("category", categoryFactory, ({ organizationId }) => ({ organizationId }))
    associate("creator", userFactory)

    return { title: `Project ${sequence}` }
  })

  return {
    sequelize,
    Organization,
    User,
    Category,
    Project,
    organizationFactory,
    userFactory,
    categoryFactory,
    projectFactory,
  }
}
