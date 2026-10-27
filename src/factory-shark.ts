// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

import type {
  SequelizeCreationAttributes as InferCreationAttributes,
  SequelizeModel as Model,
  SequelizeModelStatic as ModelStatic,
} from "@/src/compatibility/sequelize/types.js"

import {
  createSequelizeAdapter,
  isSupportedSequelizeModel,
} from "@/src/compatibility/sequelize/create-sequelize-adapter.js"

import { AssociationManager as CoreAssociationManager } from "@/src/association-manager.js"
import { AttributeBuilder as CoreAttributeBuilder } from "@/src/attribute-builder.js"
import { FactoryBuilder } from "@/src/factory-builder.js"
import { FactoryContext as CoreFactoryContext } from "@/src/factory-context.js"
import type { FactoryAdapter } from "@/src/orm-adapter.js"
import type { AttributeBuilderOptions as CoreAttributeBuilderOptions } from "@/src/attribute-builder.js"
import type { AssociationRegistration as CoreAssociationRegistration } from "@/src/factory-context.js"
import type {
  AssociateFunction as CoreAssociateFunction,
  AssociationName,
  CoreFactoryParams,
  FactoryInterface as CoreFactoryInterface,
  GeneratorContext as CoreGeneratorContext,
  GeneratorFn as CoreGeneratorFn,
  RejectExcessKeys,
} from "@/src/types.js"

export type FactoryParams<T extends Model> = CoreFactoryParams<T, InferCreationAttributes<T>>
type PublicAssociateFunction<T extends Model> = <A extends Model>(
  name: AssociationName<T>,
  factory: Pick<FactoryInterface<A>, "build" | "create" | "modelClass">,
  overrides?: FactoryParams<A> | ((params: FactoryParams<T>) => FactoryParams<A>)
) => A

export type GeneratorContext<T extends Model, TransientParams = Record<string, never>> = Omit<
  CoreGeneratorContext<T, InferCreationAttributes<T>, TransientParams>,
  "associate"
> & {
  associate: PublicAssociateFunction<T>
}

export type GeneratorFn<T extends Model, TransientParams = Record<string, never>> = (
  context: GeneratorContext<T, TransientParams>
) => FactoryParams<T>
export type FactoryInterface<
  T extends Model,
  TransientParams = Record<string, never>,
  ModelClass extends ModelStatic<T> = ModelStatic<T>,
> = {
  build(params?: FactoryParams<T>): T
  create(params?: FactoryParams<T>): Promise<T>
  associations<A extends Model>(
    associations: Record<string, A>
  ): FactoryInterface<T, TransientParams, ModelClass>
  params(params: FactoryParams<T>): FactoryInterface<T, TransientParams, ModelClass>
  transient(params: Partial<TransientParams>): FactoryInterface<T, TransientParams, ModelClass>
  afterCreate(hook: (model: T) => Promise<void>): FactoryInterface<T, TransientParams, ModelClass>
  beforeCreate(
    hook: (model: T) => void | Promise<void>
  ): FactoryInterface<T, TransientParams, ModelClass>
  modelClass: ModelClass
}

type StrictFactoryGenerator<T extends Model, TransientParams, P extends FactoryParams<T>> = (
  context: GeneratorContext<T, TransientParams>
) => RejectExcessKeys<P, FactoryParams<T>>

const adapter = createSequelizeAdapter<Model, InferCreationAttributes<Model>, ModelStatic<Model>>(
  isSupportedSequelizeModel,
  (value): value is ModelStatic<Model> =>
    typeof value === "function" &&
    "prototype" in value &&
    typeof value.prototype === "object" &&
    value.prototype !== null &&
    "get" in value.prototype &&
    typeof value.prototype.get === "function" &&
    "set" in value.prototype &&
    typeof value.prototype.set === "function" &&
    "save" in value.prototype &&
    typeof value.prototype.save === "function" &&
    "build" in value &&
    typeof value.build === "function"
)

// One shared adapter delegates the common runtime protocol after model-version validation.
function adapterFor<T extends Model, ModelClass extends ModelStatic<T>>(): FactoryAdapter<
  T,
  InferCreationAttributes<T>,
  ModelClass
> {
  return adapter as unknown as FactoryAdapter<T, InferCreationAttributes<T>, ModelClass>
}

export class FactoryShark<
  T extends Model,
  TransientParams = Record<string, never>,
  ModelClass extends ModelStatic<T> = ModelStatic<T>,
> implements FactoryInterface<T, TransientParams, ModelClass> {
  private readonly builder: FactoryBuilder<
    T,
    InferCreationAttributes<T>,
    ModelClass,
    TransientParams
  >
  public readonly modelClass: ModelClass

  constructor(
    modelClass: (new (...args: never[]) => T) & ModelClass,
    generator: GeneratorFn<T, TransientParams>,
    defaultTransientParams: TransientParams
  ) {
    adapter.assertCompatibleModelClass(modelClass)
    this.builder = new FactoryBuilder(
      modelClass,
      adapterFor<T, ModelClass>(),
      generator as unknown as CoreGeneratorFn<T, InferCreationAttributes<T>, TransientParams>,
      defaultTransientParams
    )
    this.modelClass = modelClass
  }

  static define<
    T extends Model,
    TransientParams = Record<string, never>,
    P extends FactoryParams<T> = FactoryParams<T>,
    ModelClass extends ModelStatic<T> = ModelStatic<T>,
  >(
    modelClass: (new (...args: never[]) => T) & ModelClass,
    generator: StrictFactoryGenerator<T, TransientParams, P>
  ): FactoryShark<T, TransientParams, ModelClass> {
    const defaultTransientParams: TransientParams = {} as TransientParams
    return new FactoryShark(modelClass, generator, defaultTransientParams)
  }

  transient(params: Partial<TransientParams>): FactoryInterface<T, TransientParams, ModelClass> {
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
  ): FactoryInterface<T, TransientParams, ModelClass> {
    return this.asFactoryInterface(this.builder.associations(associations))
  }

  params(params: FactoryParams<T>): FactoryInterface<T, TransientParams, ModelClass> {
    return this.asFactoryInterface(this.builder.params(params))
  }

  afterCreate(hook: (model: T) => Promise<void>): FactoryInterface<T, TransientParams, ModelClass> {
    return this.asFactoryInterface(this.builder.afterCreate(hook))
  }

  beforeCreate(
    hook: (model: T) => void | Promise<void>
  ): FactoryInterface<T, TransientParams, ModelClass> {
    return this.asFactoryInterface(this.builder.beforeCreate(hook))
  }

  private asFactoryInterface(
    factory: CoreFactoryInterface<T, InferCreationAttributes<T>, ModelClass, TransientParams>
  ): FactoryInterface<T, TransientParams, ModelClass> {
    return factory as unknown as FactoryInterface<T, TransientParams, ModelClass>
  }
}

export type AssociationRegistration<T extends Model> = Omit<
  CoreAssociationRegistration<T, InferCreationAttributes<T>>,
  "instance" | "create"
> & {
  instance: Model
  create(params: FactoryParams<T>): Promise<Model>
}

export type AttributeBuilderOptions<T extends Model, TransientParams> = Omit<
  CoreAttributeBuilderOptions<T, InferCreationAttributes<T>, TransientParams>,
  "generator" | "associate"
> & {
  generator: GeneratorFn<T, TransientParams>
  associate: PublicAssociateFunction<T>
}

export class FactoryContext<T extends Model = Model> extends CoreFactoryContext<
  T,
  InferCreationAttributes<T>,
  ModelStatic<T>
> {
  declare readonly registrations: AssociationRegistration<T>[]
  declare associate: PublicAssociateFunction<T> &
    CoreAssociateFunction<T, InferCreationAttributes<T>>

  constructor(modelClass: ModelStatic<T>, params: FactoryParams<T> = {}) {
    super(modelClass, params, adapterFor<T, ModelStatic<T>>())
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
    super(modelClass, registrations, params, adapterFor<T, ModelStatic<T>>())
  }
}

export class AttributeBuilder<
  T extends Model,
  TransientParams = Record<string, never>,
> extends CoreAttributeBuilder<T, InferCreationAttributes<T>, TransientParams> {
  constructor(options: AttributeBuilderOptions<T, TransientParams>) {
    super(
      options as unknown as CoreAttributeBuilderOptions<
        T,
        InferCreationAttributes<T>,
        TransientParams
      >
    )
  }
}

export { AssociationNotFoundError, ForeignKeyNotFoundError } from "./errors.js"
export { CreateStrategy } from "./strategy/create-strategy.js"

export function isModel(value: unknown): value is Model {
  return isSupportedSequelizeModel(value)
}

export { PRIMARY_KEY } from "./utils.js"
export type { AfterCreateFn, BeforeCreateFn, RejectExcessKeys } from "./types.js"

export default FactoryShark
