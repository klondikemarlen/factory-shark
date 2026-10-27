import { DataTypes, Sequelize } from "@sequelize/core"
import { SqliteDialect } from "@sequelize/sqlite3"

import {
  Organization,
  Role,
  Sequence,
  User,
  Workflow,
  WorkflowAccessByUser,
  WorkflowCategory,
  WorkflowPlayer,
} from "@/models"

export function initializeModels(): Sequelize {
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

  Sequence.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      prefix: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      format: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "sequences",
      timestamps: false,
    }
  )

  Organization.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      sequenceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      number: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      acronym: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      timezone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "organizations",
      timestamps: false,
    }
  )

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      authSubject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "users",
      timestamps: false,
    }
  )

  Role.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "roles",
      timestamps: false,
    }
  )

  WorkflowCategory.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "workflow_categories",
      timestamps: false,
    }
  )

  Workflow.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "workflows",
      timestamps: false,
    }
  )

  WorkflowPlayer.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      workflowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      addedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "workflow_players",
      timestamps: false,
    }
  )

  WorkflowAccessByUser.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      workflowId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      workflowPlayerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "workflow_access_by_users",
      timestamps: false,
    }
  )

  Organization.belongsTo(Sequence, {
    foreignKey: "sequenceId",
    as: "sequence",
  })
  User.hasMany(Role, {
    foreignKey: "userId",
    as: "roles",
  })
  Role.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  })
  WorkflowCategory.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  })
  Workflow.belongsTo(Organization, {
    foreignKey: "organizationId",
    as: "organization",
  })
  Workflow.belongsTo(WorkflowCategory, {
    foreignKey: "categoryId",
    as: "category",
  })
  Workflow.belongsTo(User, {
    foreignKey: "creatorId",
    as: "creator",
  })
  WorkflowPlayer.belongsTo(Workflow, {
    foreignKey: "workflowId",
    as: "workflow",
  })
  WorkflowPlayer.belongsTo(User, {
    foreignKey: "addedByUserId",
    as: "addedByUser",
  })
  WorkflowPlayer.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  })
  WorkflowAccessByUser.belongsTo(Workflow, {
    foreignKey: "workflowId",
    as: "workflow",
  })
  WorkflowAccessByUser.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  })
  WorkflowAccessByUser.belongsTo(WorkflowPlayer, {
    foreignKey: "workflowPlayerId",
    as: "workflowPlayer",
  })

  return sequelize
}
