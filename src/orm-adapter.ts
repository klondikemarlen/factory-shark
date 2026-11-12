export type FactoryAdapter<T extends object, Attributes extends object, ModelClass> = {
  build(modelClass: ModelClass, attributes: Attributes): T
  rawAttributes(model: T): Attributes
  save(model: T): Promise<T>
  reload(model: T, include: unknown): Promise<void>
  attachSuppliedCollections(model: T, attributes: Attributes): void
  saveSuppliedCollections(model: T): Promise<void>
  isModel(value: unknown): value is object
  set(model: object, key: string, value: unknown): void
  setValues(model: object, values: Record<string, unknown>): void
  markSaved(model: object): void
  get(model: object, key?: string): unknown
  association(modelClass: ModelClass, name: string): FactoryAssociation | undefined
  findByTargetKey(association: FactoryAssociation, value: string | number): Promise<object | null>
  assertCompatibleModelClass(modelClass: unknown): void
  modelName(modelClass: ModelClass): string
  associationNames(modelClass: ModelClass): string[]
}

// The engine needs metadata only; each adapter owns its native association lookup.
export type FactoryAssociation = {
  foreignKey?: string
  targetKey: string
}
