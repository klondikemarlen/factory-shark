export type FactoryInterface<
  T extends object,
  Attributes extends object,
  ModelClass,
  TransientParams = Record<string, never>,
> = {
  build(params?: CoreFactoryParams<T, Attributes>): T
  create(params?: CoreFactoryParams<T, Attributes>): Promise<T>
  associations<A extends object>(
    associations: Record<string, A>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams>
  params(
    params: CoreFactoryParams<T, Attributes>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams>
  transient(
    params: Partial<TransientParams>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams>
  afterCreate(hook: AfterCreateFn<T>): FactoryInterface<T, Attributes, ModelClass, TransientParams>
  beforeCreate(
    hook: BeforeCreateFn<T>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams>
  modelClass: ModelClass
}

export type AssociationKeys<T> = {
  [K in keyof T]: NonNullable<T[K]> extends { isNewRecord: boolean; dataValues: object } ? K : never
}[keyof T]

export type AssociationName<T extends object> = AssociationKeys<T> & string
export type ForeignKeyName<T extends object, Attributes extends object> = keyof Attributes &
  keyof T &
  string

type FactoryParamKeys<T extends object, Attributes extends object> =
  keyof Attributes | AssociationKeys<T>

export type CoreFactoryParams<T extends object, Attributes extends object> = {
  [K in FactoryParamKeys<T, Attributes>]?: FactoryParamValue<T, Attributes, K>
}

type FactoryParamValue<
  T extends object,
  Attributes extends object,
  K extends FactoryParamKeys<T, Attributes>,
> = K extends keyof Attributes ? Attributes[K] : K extends keyof T ? T[K] : never

export type CoreGeneratorReturn<T extends object, Attributes extends object> = CoreFactoryParams<
  T,
  Attributes
>

export type GeneratorContext<
  T extends object,
  Attributes extends object,
  TransientParams = Record<string, never>,
> = {
  sequence: number
  params: CoreFactoryParams<T, Attributes>
  associate: AssociateFunction<T, Attributes>
  afterCreate: (fn: AfterCreateFn<T>) => void
  beforeCreate: (fn: BeforeCreateFn<T>) => void
  transient: TransientParams
}

export type GeneratorFn<
  T extends object,
  Attributes extends object,
  TransientParams = Record<string, never>,
> = (
  context: GeneratorContext<T, Attributes, TransientParams>
) => CoreGeneratorReturn<T, Attributes>

export type AfterCreateFn<T extends object> = (model: T) => Promise<void>
export type BeforeCreateFn<T extends object> = (model: T) => void | Promise<void>

export type AssociationFactory<A extends object, Attributes extends object, ModelClass> = {
  modelClass: ModelClass
  build(params?: CoreFactoryParams<A, Attributes>): A
  create(params?: CoreFactoryParams<A, Attributes>): Promise<A>
}

export type AssociateFunction<T extends object, Attributes extends object> = <
  A extends object,
  AAttributes extends object,
  AModelClass,
>(
  name: AssociationName<T>,
  factory: AssociationFactory<A, AAttributes, AModelClass>,
  overrides?:
    | CoreFactoryParams<A, AAttributes>
    | ((resolvedParams: CoreFactoryParams<T, Attributes>) => CoreFactoryParams<A, AAttributes>)
) => A

export type RejectExcessKeys<P, Target> = P & Record<Exclude<keyof P, keyof Target>, never>
export type ForeignKeyValue = string | number
export type MinimalAssociation = { id: ForeignKeyValue }
