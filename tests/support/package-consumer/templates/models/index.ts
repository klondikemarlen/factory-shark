import { DataTypes, Model, Sequelize } from "@sequelize/core"
import { SqliteDialect } from "@sequelize/sqlite3"
import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from "@sequelize/core"

export class Organization extends Model<
  InferAttributes<Organization>,
  InferCreationAttributes<Organization>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare projects?: NonAttribute<Project[]>
}

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id: CreationOptional<number>
  declare title: string
  declare note: string | null
  declare organizationId: ForeignKey<Organization["id"]>
  declare organization?: NonAttribute<Organization>
}

export const sequelize = new Sequelize({
  dialect: SqliteDialect,
  storage: ":memory:",
  logging: false,
  pool: {
    max: 1,
    idle: Infinity,
    maxUses: Infinity,
  },
})

// Sequelize 7 initializes each model class once; setup resets tables, not classes.
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
    timestamps: false,
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
    note: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    timestamps: false,
  }
)

Organization.hasMany(Project, {
  as: "projects",
  foreignKey: "organizationId",
  inverse: {
    as: "organization",
  },
})
