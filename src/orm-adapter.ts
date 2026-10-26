// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

export type FactoryAdapter<T extends object, Attributes extends object, ModelClass> = {
  build(modelClass: ModelClass, attributes: Attributes): T
  save(model: T): Promise<T>
  isModel(value: unknown): value is object
  set(model: object, key: string, value: unknown): void
  setValues(model: object, values: Record<string, unknown>): void
  markSaved(model: object): void
  get(model: object, key?: string): unknown
  association(modelClass: ModelClass, name: string): FactoryAssociation | undefined
  findByPk(association: FactoryAssociation, id: string | number): Promise<object | null>
  assertCompatibleModelClass(modelClass: unknown): void
  modelName(modelClass: ModelClass): string
  associationNames(modelClass: ModelClass): string[]
}

export type FactoryAssociation = {
  foreignKey?: string
  target: {
    findByPk(id: string | number): Promise<object | null>
  }
}
