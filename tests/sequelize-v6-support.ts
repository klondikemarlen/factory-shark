import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
  NonAttribute,
} from "sequelize"
import { DataTypes, Model, Sequelize } from "sequelize"

import { FactoryShark, type FactoryInterface } from "../src/index.js"

export class OrganizationRecord extends Model<
  InferAttributes<OrganizationRecord>,
  InferCreationAttributes<OrganizationRecord>
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
  declare nullableNote: string | null
  declare metadata: {
    source: string
  }
  declare organizationId: ForeignKey<OrganizationRecord["id"]>
  declare categoryId: ForeignKey<CategoryRecord["id"]>
  declare organization?: NonAttribute<OrganizationRecord>
  declare category?: NonAttribute<CategoryRecord>
}

export interface SequelizeV6Fixture {
  sequelize: Sequelize
  Organization: ModelStatic<OrganizationRecord>
  Category: ModelStatic<CategoryRecord>
  Project: ModelStatic<ProjectRecord>
  organizationFactory: FactoryInterface<OrganizationRecord>
  categoryFactory: FactoryInterface<CategoryRecord>
  projectFactory: FactoryInterface<ProjectRecord>
}

export function createSequelizeV6Fixture(): SequelizeV6Fixture {
  class Organization extends OrganizationRecord {}
  class Category extends CategoryRecord {}
  class Project extends ProjectRecord {}

  const sequelize = new Sequelize({
    dialect: "sqlite",
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
    associate("organization", organizationFactory)
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
    categoryFactory,
    projectFactory,
  }
}
