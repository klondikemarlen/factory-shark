import { adapterFor } from "@/src/compatibility/sequelize/create-sequelize-adapter.js"
import { FactoryBuilder } from "@/src/factory-builder.js"
import type {
  FactoryInclude,
  SequelizeCreationAttributes as InferCreationAttributes,
  SequelizeModel as Model,
  SequelizeModelStatic as ModelStatic,
} from "@/src/compatibility/sequelize/types.js"
import type {
  AssociationName,
  CoreFactoryParams,
  FactoryInterface as CoreFactoryInterface,
  GeneratorContext as CoreGeneratorContext,
  GeneratorFn as CoreGeneratorFn,
  RejectExcessKeys,
  SuppliedAssociations,
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
  buildList(count: number, params?: FactoryParams<T>): T[]
  attributesFor(params?: FactoryParams<T>): InferCreationAttributes<T>
  create(params?: FactoryParams<T>): Promise<T>
  createList(count: number, params?: FactoryParams<T>): Promise<T[]>
  include(
    selection: FactoryInclude<T> | undefined
  ): FactoryInterface<T, TransientParams, ModelClass>
  associations<A extends Model | Model[]>(
    associations: SuppliedAssociations<T, A>
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
    const adapter = adapterFor<T, ModelClass>()
    adapter.assertCompatibleModelClass(modelClass)
    this.builder = new FactoryBuilder(
      modelClass,
      adapter,
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

  buildList(count: number, params?: FactoryParams<T>): T[] {
    return this.builder.buildList(count, params)
  }

  attributesFor(params?: FactoryParams<T>): InferCreationAttributes<T> {
    return this.builder.attributesFor(params)
  }

  async create(params?: FactoryParams<T>): Promise<T> {
    return this.builder.create(params)
  }

  async createList(count: number, params?: FactoryParams<T>): Promise<T[]> {
    return this.builder.createList(count, params)
  }

  include(
    selection: FactoryInclude<T> | undefined
  ): FactoryInterface<T, TransientParams, ModelClass> {
    return this.asFactoryInterface(this.builder.include(selection))
  }

  associations<A extends Model | Model[]>(
    associations: SuppliedAssociations<T, A>
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

export default FactoryShark
