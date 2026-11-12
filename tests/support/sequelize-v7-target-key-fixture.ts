import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from "@sequelize/core"
import { DataTypes, Model, Sequelize } from "@sequelize/core"
import { SqliteDialect } from "@sequelize/sqlite3"

import type { TargetKey } from "@/tests/support/target-key-fixture.js"

import { FactoryShark } from "@/src/index.js"

export function createSequelizeV7TargetKeyFixture(targetKey: TargetKey) {
  // Fresh classes keep Sequelize 7's lifetime model binding local to each scenario.
  class Parent extends Model<InferAttributes<Parent>, InferCreationAttributes<Parent>> {
    declare key: string
    declare code: string
    declare name: string
  }

  class Child extends Model<InferAttributes<Child>, InferCreationAttributes<Child>> {
    declare id: CreationOptional<number>
    declare parentKey: ForeignKey<string> | null
    declare parent?: NonAttribute<Parent>
  }

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

  Parent.init(
    {
      key: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
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
  Child.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      parentKey: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
    }
  )
  Child.belongsTo(Parent, {
    as: "parent",
    foreignKey: "parentKey",
    targetKey,
  })

  const parentFactory = FactoryShark.define(Parent, ({ sequence }) => ({
    key: `primary-${sequence}`,
    code: `unique-${sequence}`,
    name: `Parent ${sequence}`,
  }))
  const childFactory = FactoryShark.define(Child, ({ associate }) => {
    associate("parent", parentFactory)

    return {}
  })

  return {
    sequelize,
    Parent,
    Child,
    parentFactory,
    childFactory,
  }
}
