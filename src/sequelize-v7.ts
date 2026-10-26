// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

import { Model } from "@sequelize/core"
import type { InferCreationAttributes, ModelStatic } from "@sequelize/core"

import { AssociationManager as CoreAssociationManager } from "./association-manager"
import { AttributeBuilder as CoreAttributeBuilder } from "./attribute-builder"
import { FactoryBuilder } from "./factory-builder"
import { FactoryContext as CoreFactoryContext } from "./factory-context"
import { createSequelizeAdapter } from "./sequelize-adapter"
import type { AttributeBuilderOptions as CoreAttributeBuilderOptions } from "./attribute-builder"
import type { AssociationRegistration as CoreAssociationRegistration } from "./factory-context"
import type { FactoryAdapter } from "./orm-adapter"
import type {
  CoreFactoryParams,
  FactoryInterface as CoreFactoryInterface,
  GeneratorContext as CoreGeneratorContext,
  GeneratorFn as CoreGeneratorFn,
  RejectExcessKeys,
} from "./types"

export type FactoryParams<T extends Model> = CoreFactoryParams<T, InferCreationAttributes<T>>
export type GeneratorContext<
  T extends Model,
  TransientParams = Record<string, never>,
> = CoreGeneratorContext<T, InferCreationAttributes<T>, ModelStatic<T>, TransientParams>
export type GeneratorFn<T extends Model, TransientParams = Record<string, never>> = CoreGeneratorFn<
  T,
  InferCreationAttributes<T>,
  ModelStatic<T>,
  TransientParams
>
export type FactoryInterface<T extends Model, TransientParams = Record<string, never>> = {
  build(params?: FactoryParams<T>): T
  create(params?: FactoryParams<T>): Promise<T>
  associations<A extends Model>(
    associations: Record<string, A>
  ): FactoryInterface<T, TransientParams>
  params(params: FactoryParams<T>): FactoryInterface<T, TransientParams>
  transient(params: Partial<TransientParams>): FactoryInterface<T, TransientParams>
  afterCreate(hook: (model: T) => Promise<void>): FactoryInterface<T, TransientParams>
  beforeCreate(hook: (model: T) => void | Promise<void>): FactoryInterface<T, TransientParams>
  modelClass: ModelStatic<T>
}

type StrictFactoryGenerator<T extends Model, TransientParams, P extends FactoryParams<T>> = (
  context: GeneratorContext<T, TransientParams>
) => RejectExcessKeys<P, FactoryParams<T>>

const adapter = createSequelizeAdapter<Model, InferCreationAttributes<Model>, ModelStatic<Model>>(
  (value): value is Model => value instanceof Model,
  (value): value is ModelStatic<Model> =>
    typeof value === "function" && (value as typeof Model).prototype instanceof Model,
  7
)

// One family adapter serves every concrete model; the facade preserves its exact types.
function adapterFor<T extends Model>(): FactoryAdapter<
  T,
  InferCreationAttributes<T>,
  ModelStatic<T>
> {
  return adapter as unknown as FactoryAdapter<T, InferCreationAttributes<T>, ModelStatic<T>>
}

export class FactoryShark<
  T extends Model,
  TransientParams = Record<string, never>,
> implements FactoryInterface<T, TransientParams> {
  private readonly builder: FactoryBuilder<
    T,
    InferCreationAttributes<T>,
    ModelStatic<T>,
    TransientParams
  >
  public readonly modelClass: ModelStatic<T>

  constructor(
    modelClass: ModelStatic<T>,
    generator: GeneratorFn<T, TransientParams>,
    defaultTransientParams: TransientParams
  ) {
    adapter.assertCompatibleModelClass(modelClass)
    this.builder = new FactoryBuilder(
      modelClass,
      adapterFor<T>(),
      generator,
      defaultTransientParams
    )
    this.modelClass = modelClass
  }

  static define<
    T extends Model,
    TransientParams = Record<string, never>,
    P extends FactoryParams<T> = FactoryParams<T>,
  >(
    modelClass: ModelStatic<T>,
    generator: StrictFactoryGenerator<T, TransientParams, P>
  ): FactoryShark<T, TransientParams> {
    const defaultTransientParams: TransientParams = {} as TransientParams
    return new FactoryShark(modelClass, generator, defaultTransientParams)
  }

  transient(params: Partial<TransientParams>): FactoryInterface<T, TransientParams> {
    return this.asFactoryInterface(this.builder.transient(params))
  }

  build(params?: FactoryParams<T>): T {
    return this.builder.build(params)
  }

  async create(params?: FactoryParams<T>): Promise<T> {
    return this.builder.create(params)
  }

  associations<A extends Model>(
    associations: Record<string, A>
  ): FactoryInterface<T, TransientParams> {
    return this.asFactoryInterface(this.builder.associations(associations))
  }

  params(params: FactoryParams<T>): FactoryInterface<T, TransientParams> {
    return this.asFactoryInterface(this.builder.params(params))
  }

  afterCreate(hook: (model: T) => Promise<void>): FactoryInterface<T, TransientParams> {
    return this.asFactoryInterface(this.builder.afterCreate(hook))
  }

  beforeCreate(hook: (model: T) => void | Promise<void>): FactoryInterface<T, TransientParams> {
    return this.asFactoryInterface(this.builder.beforeCreate(hook))
  }

  private asFactoryInterface(
    factory: CoreFactoryInterface<T, InferCreationAttributes<T>, ModelStatic<T>, TransientParams>
  ): FactoryInterface<T, TransientParams> {
    return factory as unknown as FactoryInterface<T, TransientParams>
  }
}

export type AssociationRegistration<T extends Model> = CoreAssociationRegistration<
  T,
  InferCreationAttributes<T>
>
export type AttributeBuilderOptions<T extends Model, TransientParams> = CoreAttributeBuilderOptions<
  T,
  InferCreationAttributes<T>,
  ModelStatic<T>,
  TransientParams
>

export class FactoryContext<T extends Model = Model> extends CoreFactoryContext<
  T,
  InferCreationAttributes<T>,
  ModelStatic<T>
> {
  constructor(modelClass: ModelStatic<T>, params: FactoryParams<T> = {}) {
    super(modelClass, params, adapterFor<T>())
  }
}

export class AssociationManager<T extends Model> extends CoreAssociationManager<
  T,
  InferCreationAttributes<T>,
  ModelStatic<T>
> {
  constructor(
    modelClass: ModelStatic<T>,
    registrations: AssociationRegistration<T>[],
    params: FactoryParams<T>
  ) {
    super(modelClass, registrations, params, adapterFor<T>())
  }
}

export class AttributeBuilder<
  T extends Model,
  TransientParams = Record<string, never>,
> extends CoreAttributeBuilder<T, InferCreationAttributes<T>, ModelStatic<T>, TransientParams> {
  constructor(options: AttributeBuilderOptions<T, TransientParams>) {
    super(options)
  }
}

export { AssociationNotFoundError, ForeignKeyNotFoundError } from "./errors"
export { CreateStrategy } from "./strategy/create-strategy"

export function isModel(value: unknown): value is Model {
  return value instanceof Model
}

export { PRIMARY_KEY } from "./utils"
export type { AfterCreateFn, BeforeCreateFn, RejectExcessKeys } from "./types"

export default FactoryShark
