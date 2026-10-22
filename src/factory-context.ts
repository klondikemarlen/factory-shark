// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import { type Association, type Model, type ModelStatic } from "@sequelize/core"

import { AssociationNotFoundError, ForeignKeyNotFoundError } from "./errors"
import type {
  AssociateFunction,
  AssociationName,
  FactoryInterface,
  FactoryParams,
  ForeignKeyName,
} from "./types"

/**
 * Records an association registered during generator evaluation.
 *
 * `create` receives the parent factory's resolved params (including FK values
 * populated by earlier registrations) so lazy overrides see saved ids rather
 * than the unsaved build-time instance captured by closure.
 */
export type AssociationRegistration<T extends Model> = {
  name: AssociationName<T>
  foreignKeyName: ForeignKeyName<T>
  create: (resolvedParams: FactoryParams<T>) => Promise<Model>
  instance: Model
}

/**
 * Tracks association registrations produced by the generator's `associate()` calls.
 */
export class FactoryContext<T extends Model = Model> {
  readonly registrations: AssociationRegistration<T>[] = []

  constructor(
    protected readonly modelClass: ModelStatic<T>,
    protected readonly params: FactoryParams<T> = {}
  ) {}

  associate: AssociateFunction<T> = <A extends Model>(
    name: AssociationName<T>,
    factory: FactoryInterface<A>,
    overrides?: FactoryParams<A> | ((resolvedParams: FactoryParams<T>) => FactoryParams<A>)
  ): A => {
    const foreignKeyName = this.resolveForeignKeyName(name)
    const buildParams = typeof overrides === "function" ? overrides(this.params) : overrides
    const instance = factory.build(buildParams)

    this.registrations.push({
      name,
      foreignKeyName,
      create: (resolvedParams) => {
        const createParams =
          typeof overrides === "function" ? overrides(resolvedParams) : overrides
        return factory.create(createParams)
      },
      instance,
    })

    return instance
  }

  getParams(): FactoryParams<T> {
    return this.params
  }

  /**
   * Looks up Sequelize's association metadata and extracts the FK attribute name.
   *
   * Sequelize types `modelClass.associations[name]` as Association (not Association
   * | undefined), but the runtime value can be missing when an association is
   * mistyped — so we widen explicitly to keep the runtime guard meaningful.
   */
  private resolveForeignKeyName(name: AssociationName<T>): ForeignKeyName<T> {
    const associationMeta: Association | undefined = this.modelClass.associations[name]

    if (!associationMeta) {
      throw new AssociationNotFoundError(
        this.modelClass.name,
        name,
        Object.keys(this.modelClass.associations)
      )
    }

    const foreignKey = associationMeta.foreignKey
    if (!foreignKey) {
      throw new ForeignKeyNotFoundError(this.modelClass.name, name)
    }

    return foreignKey as ForeignKeyName<T>
  }
}

export default FactoryContext
