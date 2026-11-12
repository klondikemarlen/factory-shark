export type TargetKey = "key" | "code"

export interface TargetKeyParent {
  key: string
  code: string
  name: string
  isNewRecord: boolean
}

export interface TargetKeyChild<Parent extends TargetKeyParent> {
  id: number
  parentKey: string | null
  parent?: Parent
}

type ParentParams = {
  key?: string
  code?: string
  name?: string
}

type ChildParams<Parent extends TargetKeyParent> = {
  parentKey?: string | null
  parent?: Parent
}

// Both native ORM fixture families expose the same observable test operations.
export interface TargetKeyFixture<Parent extends TargetKeyParent> {
  sequelize: {
    sync(options: { force: boolean }): Promise<unknown>
    close(): Promise<void>
  }
  Parent: {
    count(): Promise<number>
    findOne(options: {
      where: {
        key: string
      }
    }): Promise<Parent | null>
  }
  Child: {
    findByPk(id: number): Promise<TargetKeyChild<Parent> | null>
  }
  parentFactory: {
    build(params?: ParentParams): Parent
    create(params?: ParentParams): Promise<Parent>
  }
  childFactory: {
    build(params?: ChildParams<Parent>): TargetKeyChild<Parent>
    create(params?: ChildParams<Parent>): Promise<TargetKeyChild<Parent>>
  }
}
