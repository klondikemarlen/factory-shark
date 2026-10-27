// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

import { isUndefined } from "lodash"

import { CreateStrategy } from "./strategy/create-strategy"
import type { FactoryAdapter, FactoryAssociation } from "./orm-adapter"

export type SequelizeModelProtocol = {
  isNewRecord: boolean
  save(): Promise<unknown>
  get(key?: string): unknown
  set(keyOrValues: string | object, value?: unknown): unknown
}

type SequelizeAssociationProtocol = FactoryAssociation & {
  target: {
    findByPk(id: string | number): Promise<object | null>
  }
}

type SequelizeModelClassProtocol<T extends object, Attributes extends object> = {
  name: string
  build(attributes: Attributes): T
  associations: Record<string, SequelizeAssociationProtocol | undefined>
}

export function createSequelizeAdapter<
  T extends object,
  Attributes extends object,
  ModelClass extends object,
>(
  isModel: (value: unknown) => value is T,
  isCompatibleModelClass: (value: unknown) => value is ModelClass,
  version: 6 | 7
): FactoryAdapter<T, Attributes, ModelClass> {
  const getInstance = (model: object): SequelizeModelProtocol => model as SequelizeModelProtocol
  const getStatic = (modelClass: ModelClass): SequelizeModelClassProtocol<T, Attributes> =>
    modelClass as unknown as SequelizeModelClassProtocol<T, Attributes>

  return {
    isModel,
    build(modelClass, attributes) {
      return getStatic(modelClass).build(attributes)
    },
    save(model) {
      return CreateStrategy.save(model as T & SequelizeModelProtocol)
    },
    set(model, key, value) {
      getInstance(model).set(key, value)
    },
    setValues(model, values) {
      getInstance(model).set(values)
    },
    markSaved(model) {
      getInstance(model).isNewRecord = false
    },
    get(model, key) {
      const instance = getInstance(model)
      if (isUndefined(key)) return instance.get()
      return instance.get(key)
    },
    association(modelClass, name) {
      return getStatic(modelClass).associations[name]
    },
    findByPk(association, id) {
      return (association as SequelizeAssociationProtocol).target.findByPk(id)
    },
    assertCompatibleModelClass(modelClass) {
      if (!isCompatibleModelClass(modelClass)) {
        throw new TypeError(`This factory requires a Sequelize v${version} Model class.`)
      }
    },
    modelName(modelClass) {
      return getStatic(modelClass).name
    },
    associationNames(modelClass) {
      return Object.keys(getStatic(modelClass).associations)
    },
  }
}

export default createSequelizeAdapter
