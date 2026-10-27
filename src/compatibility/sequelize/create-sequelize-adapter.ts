import isUndefined from "lodash/isUndefined.js"
import { satisfies } from "semver"

import { CreateStrategy } from "@/src/strategy/create-strategy.js"
import type { FactoryAdapter, FactoryAssociation } from "@/src/orm-adapter.js"

export type SequelizeModelProtocol = {
  _creationAttributes: object
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

const supportedVersions = new WeakMap<object, 6 | 7>()

function resolveSupportedVersion(modelClass: object): 6 | 7 {
  const cachedVersion = supportedVersions.get(modelClass)
  if (!isUndefined(cachedVersion)) {
    return cachedVersion
  }

  let sequelize: unknown

  try {
    if (!("sequelize" in modelClass)) {
      throw new TypeError()
    }

    sequelize = modelClass.sequelize
  } catch {
    throw new TypeError("The Sequelize model must be initialized before a factory is used.")
  }

  if (typeof sequelize !== "object" || sequelize === null || !("constructor" in sequelize)) {
    throw new TypeError("FactoryShark could not identify the model's Sequelize installation.")
  }

  const constructor = sequelize.constructor
  if (typeof constructor !== "function" || !("version" in constructor)) {
    throw new TypeError("FactoryShark could not identify the model's Sequelize installation.")
  }

  const version = constructor.version

  if (typeof version === "string" && satisfies(version, "^6.37.8")) {
    supportedVersions.set(modelClass, 6)
    return 6
  }

  if (version === "7.0.0-alpha.48") {
    supportedVersions.set(modelClass, 7)
    return 7
  }

  throw new TypeError("FactoryShark supports Sequelize 6.37.8 and @sequelize/core 7.0.0-alpha.48.")
}

export function isSupportedSequelizeModel(value: unknown): value is SequelizeModelProtocol {
  if (
    typeof value !== "object" ||
    value === null ||
    !("isNewRecord" in value) ||
    typeof value.isNewRecord !== "boolean" ||
    !("get" in value) ||
    typeof value.get !== "function" ||
    !("set" in value) ||
    typeof value.set !== "function" ||
    !("save" in value) ||
    typeof value.save !== "function" ||
    !("constructor" in value) ||
    typeof value.constructor !== "function"
  ) {
    return false
  }

  try {
    resolveSupportedVersion(value.constructor)
    return true
  } catch {
    return false
  }
}

export function createSequelizeAdapter<
  T extends object,
  Attributes extends object,
  ModelClass extends object,
>(
  isModel: (value: unknown) => value is T,
  isCompatibleModelClass: (value: unknown) => value is ModelClass
): FactoryAdapter<T, Attributes, ModelClass> {
  const getInstance = (model: object): SequelizeModelProtocol => model as SequelizeModelProtocol
  const getStatic = (modelClass: ModelClass): SequelizeModelClassProtocol<T, Attributes> =>
    modelClass as unknown as SequelizeModelClassProtocol<T, Attributes>

  return {
    isModel,
    build(modelClass, attributes) {
      resolveSupportedVersion(modelClass)
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
      resolveSupportedVersion(modelClass)
      return getStatic(modelClass).associations[name]
    },
    findByPk(association, id) {
      return (association as SequelizeAssociationProtocol).target.findByPk(id)
    },
    assertCompatibleModelClass(modelClass) {
      if (!isCompatibleModelClass(modelClass)) {
        throw new TypeError("This factory requires a Sequelize Model class.")
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
