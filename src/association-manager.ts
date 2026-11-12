import isNil from "lodash/isNil.js"
import isUndefined from "lodash/isUndefined.js"

import { AssociationNotFoundError } from "@/src/errors.js"
import type { AssociationRegistration } from "@/src/factory-context.js"
import type { FactoryAdapter } from "@/src/orm-adapter.js"
import type {
  AssociationName,
  CoreFactoryParams,
  ForeignKeyName,
  ForeignKeyValue,
} from "@/src/types.js"

export class AssociationManager<T extends object, Attributes extends object, ModelClass> {
  constructor(
    private readonly modelClass: ModelClass,
    private readonly registrations: AssociationRegistration<T, Attributes>[],
    private readonly params: CoreFactoryParams<T, Attributes>,
    private readonly adapter: FactoryAdapter<T, Attributes, ModelClass>
  ) {}

  attachAssociations(model: T): void {
    for (const registration of this.registrations) {
      if (!registration.instance) continue

      const foreignKeyValue = this.readForeignKey(registration.foreignKeyName)
      if (!isNil(foreignKeyValue)) {
        const targetKeyName = this.resolveTargetKeyName(registration.name)
        Object.assign(model, {
          [registration.name]: {
            [targetKeyName]: foreignKeyValue,
          },
        })
        continue
      }

      const providedInstance = this.readProvidedInstance(registration.name)
      if (!isNil(providedInstance)) {
        if (!this.adapter.isModel(providedInstance)) {
          throw new Error(
            `Invalid association instance provided for "${registration.name}". Expected Model instance.`
          )
        }

        Object.assign(model, { [registration.name]: providedInstance })

        const targetKeyName = this.resolveTargetKeyName(registration.name)
        const targetKey = this.adapter.get(providedInstance, targetKeyName)
        if (isUndefined(foreignKeyValue) && !isNil(targetKey)) {
          this.adapter.set(model, registration.foreignKeyName, targetKey)
        }
        continue
      }

      Object.assign(model, { [registration.name]: registration.instance })
    }
  }

  async attachAssociationsAsync(model: T): Promise<void> {
    for (const registration of this.registrations) {
      const foreignKeyValue = this.readForeignKey(registration.foreignKeyName)
      const associatedModel = await this.resolveAssociationModel(registration, foreignKeyValue)

      this.backfillForeignKeyIfNeeded(model, registration, associatedModel, foreignKeyValue)

      if (associatedModel) {
        Object.assign(model, { [registration.name]: associatedModel })
      }
    }
  }

  async createAssociations(): Promise<void> {
    for (const registration of this.registrations) {
      await this.createAssociation(registration)
    }
  }

  private async createAssociation(
    registration: AssociationRegistration<T, Attributes>
  ): Promise<void> {
    const foreignKeyValue = this.readForeignKey(registration.foreignKeyName)
    if (!isNil(foreignKeyValue)) {
      this.backfillInstanceTargetKey(registration, foreignKeyValue)
      return
    }

    const providedInstance = this.readProvidedInstance(registration.name)
    if (!isNil(providedInstance)) {
      this.swapInProvidedInstance(registration, providedInstance)
      return
    }

    await this.createAndMirrorInstance(registration)
  }

  private backfillInstanceTargetKey(
    registration: AssociationRegistration<T, Attributes>,
    foreignKeyValue: ForeignKeyValue
  ): void {
    const targetKeyName = this.resolveTargetKeyName(registration.name)
    this.adapter.set(registration.instance, targetKeyName, foreignKeyValue)
  }

  private swapInProvidedInstance(
    registration: AssociationRegistration<T, Attributes>,
    providedInstance: unknown
  ): void {
    if (!this.adapter.isModel(providedInstance)) {
      throw new Error(
        `Invalid association instance provided for "${registration.name}". Expected Model instance.`
      )
    }

    registration.instance = providedInstance
    this.writeForeignKey(
      registration.foreignKeyName,
      this.readTargetKey(providedInstance, registration)
    )
  }

  private async createAndMirrorInstance(
    registration: AssociationRegistration<T, Attributes>
  ): Promise<void> {
    const persistedInstance = await registration.create(this.params)
    this.updateRegistrationInstance(registration, persistedInstance)
    this.writeForeignKey(
      registration.foreignKeyName,
      this.readTargetKey(persistedInstance, registration)
    )
  }

  private updateRegistrationInstance(
    registration: AssociationRegistration<T, Attributes>,
    persistedInstance: object
  ): void {
    this.adapter.setValues(
      registration.instance,
      this.adapter.get(persistedInstance) as Record<string, unknown>
    )
    this.adapter.markSaved(registration.instance)
    registration.instance = persistedInstance
  }

  private async resolveAssociationModel(
    registration: AssociationRegistration<T, Attributes>,
    foreignKeyValue: ForeignKeyValue | undefined | null
  ): Promise<object | null> {
    if (isNil(foreignKeyValue)) return registration.instance

    const association = this.adapter.association(this.modelClass, registration.name)
    if (!association) return null

    return this.adapter.findByTargetKey(association, foreignKeyValue)
  }

  private backfillForeignKeyIfNeeded(
    model: T,
    registration: AssociationRegistration<T, Attributes>,
    associatedModel: object | null,
    foreignKeyValue: ForeignKeyValue | undefined | null
  ): void {
    if (!isNil(foreignKeyValue) || !associatedModel) return

    const targetKey = this.readTargetKey(associatedModel, registration)
    Object.assign(model, { [registration.foreignKeyName]: targetKey })
  }

  private resolveTargetKeyName(name: AssociationName<T>): string {
    const association = this.adapter.association(this.modelClass, name)
    if (association) return association.targetKey

    throw new AssociationNotFoundError(
      this.adapter.modelName(this.modelClass),
      name,
      this.adapter.associationNames(this.modelClass)
    )
  }

  private readForeignKey<K extends ForeignKeyName<T, Attributes>>(
    foreignKeyName: K
  ): ForeignKeyValue | undefined | null {
    const value = this.params[foreignKeyName]
    return value as ForeignKeyValue | undefined | null
  }

  private readProvidedInstance<K extends AssociationName<T>>(
    name: K
  ): CoreFactoryParams<T, Attributes>[K] {
    return this.params[name]
  }

  private writeForeignKey<K extends ForeignKeyName<T, Attributes>>(
    foreignKeyName: K,
    value: ForeignKeyValue
  ): void {
    this.params[foreignKeyName] = value as CoreFactoryParams<T, Attributes>[K]
  }

  private readTargetKey(
    model: object,
    registration: AssociationRegistration<T, Attributes>
  ): ForeignKeyValue {
    const targetKeyName = this.resolveTargetKeyName(registration.name)
    const targetKey = this.adapter.get(model, targetKeyName)

    if (isNil(targetKey)) {
      throw new Error(
        `Expected target key "${targetKeyName}" on ${model.constructor.name}, got ${targetKey}`
      )
    }

    return targetKey as ForeignKeyValue
  }
}
