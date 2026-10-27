// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

import { AssociationNotFoundError, ForeignKeyNotFoundError } from "@/src/errors.js"
import type { FactoryAdapter } from "@/src/orm-adapter.js"
import type {
  AssociateFunction,
  AssociationFactory,
  AssociationName,
  CoreFactoryParams,
  ForeignKeyName,
} from "@/src/types.js"

export type AssociationRegistration<T extends object, Attributes extends object> = {
  name: AssociationName<T>
  foreignKeyName: ForeignKeyName<T, Attributes>
  create: (resolvedParams: CoreFactoryParams<T, Attributes>) => Promise<object>
  instance: object
}

export class FactoryContext<T extends object, Attributes extends object, ModelClass> {
  readonly registrations: AssociationRegistration<T, Attributes>[] = []

  constructor(
    protected readonly modelClass: ModelClass,
    protected readonly params: CoreFactoryParams<T, Attributes>,
    private readonly adapter: FactoryAdapter<T, Attributes, ModelClass>
  ) {}

  associate: AssociateFunction<T, Attributes> = <
    A extends object,
    AAttributes extends object,
    AModelClass,
  >(
    name: AssociationName<T>,
    factory: AssociationFactory<A, AAttributes, AModelClass>,
    overrides?:
      | CoreFactoryParams<A, AAttributes>
      | ((resolvedParams: CoreFactoryParams<T, Attributes>) => CoreFactoryParams<A, AAttributes>)
  ): A => {
    this.adapter.assertCompatibleModelClass(factory.modelClass)
    const foreignKeyName = this.resolveForeignKeyName(name)
    let buildParams: CoreFactoryParams<A, AAttributes> | undefined

    if (typeof overrides === "function") {
      buildParams = overrides(this.params)
    } else {
      buildParams = overrides
    }

    const instance = factory.build(buildParams)

    this.registrations.push({
      name,
      foreignKeyName,
      create: (resolvedParams) => {
        if (typeof overrides === "function") {
          return factory.create(overrides(resolvedParams))
        } else {
          return factory.create(overrides)
        }
      },
      instance,
    })

    return instance
  }

  getParams(): CoreFactoryParams<T, Attributes> {
    return this.params
  }

  private resolveForeignKeyName(name: AssociationName<T>): ForeignKeyName<T, Attributes> {
    const association = this.adapter.association(this.modelClass, name)

    if (!association) {
      throw new AssociationNotFoundError(
        this.adapter.modelName(this.modelClass),
        name,
        this.adapter.associationNames(this.modelClass)
      )
    }

    const foreignKey = association.foreignKey
    if (!foreignKey) {
      throw new ForeignKeyNotFoundError(this.adapter.modelName(this.modelClass), name)
    }

    return foreignKey as ForeignKeyName<T, Attributes>
  }
}

export default FactoryContext
