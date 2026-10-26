import { Model } from "@sequelize/core"
import type {
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from "@sequelize/core"

import type { RoleTypes } from "@/models/role"

export class Sequence extends Model<InferAttributes<Sequence>, InferCreationAttributes<Sequence>> {
  declare id: CreationOptional<number>
  declare prefix: string
  declare format: string
}

export class Organization extends Model<
  InferAttributes<Organization>,
  InferCreationAttributes<Organization>
> {
  declare id: CreationOptional<number>
  declare sequenceId: ForeignKey<Sequence["id"]>
  declare sequence?: NonAttribute<Sequence>
  declare name: string
  declare number: string
  declare acronym: string
  declare timezone: string
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>
  declare authSubject: string
  declare email: string
  declare firstName: string
  declare lastName: string
  declare roles?: NonAttribute<Role[]>
}

export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<number>
  declare userId: ForeignKey<User["id"]>
  declare role: RoleTypes
}

export class WorkflowCategory extends Model<
  InferAttributes<WorkflowCategory>,
  InferCreationAttributes<WorkflowCategory>
> {
  declare id: CreationOptional<number>
  declare organizationId: ForeignKey<Organization["id"]>
  declare organization?: NonAttribute<Organization>
  declare title: string
}

export class Workflow extends Model<InferAttributes<Workflow>, InferCreationAttributes<Workflow>> {
  static readonly Statuses = {
    OPEN: "open",
  } as const

  declare id: CreationOptional<number>
  declare organizationId: ForeignKey<Organization["id"]>
  declare categoryId: ForeignKey<WorkflowCategory["id"]>
  declare creatorId: ForeignKey<User["id"]>
  declare organization?: NonAttribute<Organization>
  declare category?: NonAttribute<WorkflowCategory>
  declare creator?: NonAttribute<User>
  declare status: string
  declare title: string
}

export class WorkflowPlayer extends Model<
  InferAttributes<WorkflowPlayer>,
  InferCreationAttributes<WorkflowPlayer>
> {
  declare id: CreationOptional<number>
  declare workflowId: ForeignKey<Workflow["id"]>
  declare userId: ForeignKey<User["id"]>
  declare workflow?: NonAttribute<Workflow>
  declare addedByUser?: NonAttribute<User>
  declare user?: NonAttribute<User>
  declare addedByUserId: ForeignKey<User["id"]>
}

export class WorkflowAccessByUser extends Model<
  InferAttributes<WorkflowAccessByUser>,
  InferCreationAttributes<WorkflowAccessByUser>
> {
  declare id: CreationOptional<number>
  declare workflowId: ForeignKey<Workflow["id"]>
  declare userId: ForeignKey<User["id"]>
  declare workflow?: NonAttribute<Workflow>
  declare user?: NonAttribute<User>
  declare workflowPlayer?: NonAttribute<WorkflowPlayer>
  declare workflowPlayerId: ForeignKey<WorkflowPlayer["id"]>
}
