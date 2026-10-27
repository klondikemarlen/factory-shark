// Sequelize 6.37 and Core 7.0.0-alpha.48 both expose this metadata.
// It preserves Sequelize's native CreationOptional and ForeignKey inference without
// importing either ORM into the public declaration graph. Sequelize may remove it.
export type SequelizeModel<T extends object = object> = {
  _creationAttributes: T
  isNewRecord: boolean
  get(key?: string): unknown
  set(keyOrValues: string | object, value?: unknown): unknown
  save(): Promise<unknown>
}

export type SequelizeCreationAttributes<T extends SequelizeModel> = T["_creationAttributes"]

export type SequelizeModelStatic<T extends SequelizeModel> = new (...args: never[]) => T
