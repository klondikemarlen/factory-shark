import isNil from "lodash/isNil.js"

import { CreateStrategy } from "@/src/strategy/create-strategy.js"
import type { SequelizeModelProtocol } from "@/src/compatibility/sequelize/create-sequelize-adapter.js"

type NativeModel = SequelizeModelProtocol & {
  previous(key: string): unknown
}

type NativeModelClass = {
  new (...args: never[]): NativeModel
  associations: Record<string, NativeAssociation>
  getAttributes(): Record<string, unknown>
}

type NativeAssociation = {
  associationType: string
  foreignKey: string
  target: NativeModelClass
}

function modelClass(model: SequelizeModelProtocol): NativeModelClass {
  return model.constructor as NativeModelClass
}

function attached(model: SequelizeModelProtocol, name: string): unknown {
  return (model as unknown as Record<string, unknown>)[name] ?? model.get(name)
}

export function attachSuppliedCollections(
  model: SequelizeModelProtocol,
  attributes: object,
  isModel: (value: unknown) => value is SequelizeModelProtocol
): void {
  const nativeModelClass = modelClass(model)
  const associations = nativeModelClass.associations
  const scalarAttributes = nativeModelClass.getAttributes()

  for (const [name, value] of Object.entries(attributes)) {
    const association = associations[name]
    if (!association) {
      if (Array.isArray(value) && !(name in scalarAttributes)) {
        throw new TypeError(`Unknown supplied collection association "${name}".`)
      }
      continue
    }

    if (association.associationType !== "HasMany") {
      if (Array.isArray(value)) {
        throw new TypeError(`Supplied collection "${name}" requires a hasMany association.`)
      }
      continue
    }

    if (!Array.isArray(value)) {
      throw new TypeError(
        `Supplied hasMany association "${name}" requires an array of Model instances.`
      )
    }

    for (const child of value) {
      if (!isModel(child) || !(child instanceof association.target)) {
        throw new TypeError(
          `Invalid child in "${name}". Expected an instance of the associated model.`
        )
      }
    }

    Object.assign(model, {
      [name]: value,
    })
  }
}

// Only attached belongsTo dependencies are followed; no factories or collection graphs are replayed.
async function saveAttachedBelongsTo(
  model: SequelizeModelProtocol,
  visiting: Set<SequelizeModelProtocol>
): Promise<void> {
  if (!model.isNewRecord) return
  if (visiting.has(model)) {
    throw new Error("Cannot persist a cyclic unsaved belongsTo dependency in a supplied child.")
  }
  visiting.add(model)

  for (const [name, association] of Object.entries(modelClass(model).associations)) {
    if (association.associationType !== "BelongsTo" || !isNil(model.get(association.foreignKey))) {
      continue
    }

    const dependency = attached(model, name)
    if (isNil(dependency)) continue
    if (!(dependency instanceof association.target)) {
      throw new TypeError(`Invalid attached belongsTo dependency "${name}" on supplied child.`)
    }

    await saveAttachedBelongsTo(dependency, visiting)
    model.set(association.foreignKey, dependency.get("id"))
  }

  await CreateStrategy.save(model)
  visiting.delete(model)
}

export async function saveSuppliedCollections(model: SequelizeModelProtocol): Promise<void> {
  const parentId = model.get("id")
  let visiting: Set<SequelizeModelProtocol> | undefined

  for (const [name, association] of Object.entries(modelClass(model).associations)) {
    if (association.associationType !== "HasMany") continue
    const children = attached(model, name)
    if (isNil(children)) continue
    if (!Array.isArray(children)) {
      throw new TypeError(
        `Supplied hasMany association "${name}" requires an array of Model instances.`
      )
    }

    for (const child of children) {
      if (!(child instanceof association.target)) {
        throw new TypeError(
          `Invalid child in "${name}". Expected an instance of the associated model.`
        )
      }

      if (!child.isNewRecord) {
        if (
          child.get(association.foreignKey) !== parentId ||
          child.previous(association.foreignKey) !== parentId
        ) {
          throw new Error(`Cannot reassign persisted child in "${name}" to a different parent.`)
        }
        continue
      }

      child.set(association.foreignKey, parentId)
      // A built child's generated inverse placeholder must never become a second parent.
      for (const [inverseName, inverse] of Object.entries(modelClass(child).associations)) {
        if (
          inverse.associationType === "BelongsTo" &&
          inverse.foreignKey === association.foreignKey &&
          model instanceof inverse.target
        ) {
          Object.assign(child, {
            [inverseName]: model,
          })
        }
      }

      visiting ??= new Set<SequelizeModelProtocol>()
      await saveAttachedBelongsTo(child, visiting)
    }
  }
}
