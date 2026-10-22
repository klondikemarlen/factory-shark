// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import { isNil, isUndefined } from "lodash"
import type { Association, Model, ModelStatic } from "@sequelize/core"

import { AssociationNotFoundError } from "./errors"
import { isModel, PRIMARY_KEY } from "./utils"
import type { AssociationRegistration } from "./factory-context"
import type {
  AssociationName,
  FactoryParams,
  ForeignKeyName,
  ForeignKeyValue,
  MinimalAssociation,
} from "./types"

/**
 * Creates and attaches associations for a single factory evaluation.
 *
 * In create mode each registration resolves in one of three ways:
 *   (a) caller supplied an FK      → backfill the instance's id
 *   (b) caller supplied a Model    → swap it in and mirror its id onto our FK
 *   (c) neither                    → invoke the factory, then mirror
 *
 * In build mode associations are attached without persistence.
 */
export class AssociationManager<T extends Model> {
  constructor(
    private readonly modelClass: ModelStatic<T>,
    private readonly registrations: AssociationRegistration<T>[],
    private readonly params: FactoryParams<T>
  ) {}

  attachAssociations(model: T): void {
    for (const registration of this.registrations) {
      if (!registration.instance) continue

      const foreignKeyValue = this.readForeignKey(registration.foreignKeyName)
      if (!isNil(foreignKeyValue)) {
        const minimalAssociation: MinimalAssociation = { id: foreignKeyValue }
        Object.assign(model, { [registration.name]: minimalAssociation })
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

  private async createAssociation(registration: AssociationRegistration<T>): Promise<void> {
    this.validateAssociationExists(registration.name)

    const foreignKeyValue = this.readForeignKey(registration.foreignKeyName)
    if (!isNil(foreignKeyValue)) {
      this.backfillInstanceId(registration, foreignKeyValue)
      return
    }

    const providedInstance = this.readProvidedInstance(registration.name)
    if (!isNil(providedInstance)) {
      this.swapInProvidedInstance(registration, providedInstance)
      return
    }

    await this.createAndMirrorInstance(registration)
  }

  /** Case (a): caller passed an FK — stamp it onto the build-time instance. */
  private backfillInstanceId(
    registration: AssociationRegistration<T>,
    foreignKeyValue: ForeignKeyValue
  ): void {
    registration.instance.set(PRIMARY_KEY, foreignKeyValue)
  }

  /** Case (b): caller passed an instance — use it and mirror its id onto our FK. */
  private swapInProvidedInstance(
    registration: AssociationRegistration<T>,
    providedInstance: unknown
  ): void {
    if (!isModel(providedInstance)) {
      throw new Error(
        `Invalid association instance provided for "${registration.name}". Expected Model instance.`
      )
    }

    registration.instance = providedInstance
    this.writeForeignKey(registration.foreignKeyName, this.readPrimaryKey(providedInstance))
  }

  /** Case (c): create the associated row and reconcile with the build-time instance. */
  private async createAndMirrorInstance(registration: AssociationRegistration<T>): Promise<void> {
    const persistedInstance = await registration.create(this.params)
    this.updateRegistrationInstance(registration, persistedInstance)
    this.writeForeignKey(registration.foreignKeyName, this.readPrimaryKey(persistedInstance))
  }

  /**
   * Reconciles the build-time instance with the saved record. Other registrations
   * (via lazy override closures) may have captured the build-time instance before
   * save; we copy persisted values back onto it and flip isNewRecord so those
   * references observe the saved state, while also advancing our own reference
   * to the newly-returned instance for subsequent operations.
   */
  private updateRegistrationInstance(
    registration: AssociationRegistration<T>,
    persistedInstance: Model
  ): void {
    registration.instance.set(persistedInstance.get() as Record<string, unknown>)
    registration.instance.isNewRecord = false
    registration.instance = persistedInstance
  }

  private async resolveAssociationModel(
    registration: AssociationRegistration<T>,
    foreignKeyValue: ForeignKeyValue | undefined | null
  ): Promise<Model | null> {
    if (isNil(foreignKeyValue)) return registration.instance

    const associationMeta: Association | undefined = this.modelClass.associations[registration.name]
    if (!associationMeta) return null

    return associationMeta.target.findByPk(foreignKeyValue)
  }

  private backfillForeignKeyIfNeeded(
    model: T,
    registration: AssociationRegistration<T>,
    associatedModel: Model | null,
    foreignKeyValue: ForeignKeyValue | undefined | null
  ): void {
    if (!isNil(foreignKeyValue) || !associatedModel) return

    const associationPrimaryKey = this.readPrimaryKey(associatedModel)
    Object.assign(model, { [registration.foreignKeyName]: associationPrimaryKey })
  }

  private validateAssociationExists(associationName: string): void {
    const associationMeta: Association | undefined = this.modelClass.associations[associationName]

    if (!associationMeta) {
      throw new AssociationNotFoundError(
        this.modelClass.name,
        associationName,
        Object.keys(this.modelClass.associations)
      )
    }
  }

  /**
   * Reads the FK attribute from params. Returns the PK shape Sequelize accepts
   * (number | string) or undefined/null when the caller didn't supply it.
   *
   * Narrowing to ForeignKeyValue is safe: all Sequelize PKs are int or string
   * at the DB layer, regardless of how a given model types its id column.
   */
  private readForeignKey<K extends ForeignKeyName<T>>(
    foreignKeyName: K
  ): ForeignKeyValue | undefined | null {
    const value: FactoryParams<T>[K] = this.params[foreignKeyName]
    return value as ForeignKeyValue | undefined | null
  }

  private readProvidedInstance<K extends AssociationName<T>>(name: K): FactoryParams<T>[K] {
    return this.params[name]
  }

  private writeForeignKey<K extends ForeignKeyName<T>>(
    foreignKeyName: K,
    value: ForeignKeyValue
  ): void {
    this.params[foreignKeyName] = value as FactoryParams<T>[K]
  }

  /**
   * Extracts a primary key from a persisted model. Sequelize types `.get()` as
   * `unknown`, but a saved model always has a PK — assert once at this boundary
   * so callers get a typed value.
   */
  private readPrimaryKey(model: Model): ForeignKeyValue {
    const primaryKey = model.get(PRIMARY_KEY)

    if (isUndefined(primaryKey) || primaryKey === null) {
      throw new Error(`Expected primary key on ${model.constructor.name}, got ${primaryKey}`)
    }

    return primaryKey as ForeignKeyValue
  }
}
