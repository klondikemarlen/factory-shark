// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import { type InferCreationAttributes, type Model, type ModelStatic } from "@sequelize/core"

// ============================================================================
// CORE FACTORY TYPES
// ============================================================================

/**
 * Type for factory instances returned by FactoryShark.define()
 */
export type FactoryInterface<T extends Model, TransientParams = Record<string, never>> = {
  build(params?: FactoryParams<T>): T
  create(params?: FactoryParams<T>): Promise<T>
  associations<A extends Model>(
    associations: Record<string, A>
  ): FactoryInterface<T, TransientParams>
  params(params: FactoryParams<T>): FactoryInterface<T, TransientParams>
  transient(params: Partial<TransientParams>): FactoryInterface<T, TransientParams>
  afterCreate(hook: AfterCreateFn<T>): FactoryInterface<T, TransientParams>
  beforeCreate(hook: BeforeCreateFn<T>): FactoryInterface<T, TransientParams>
  modelClass: ModelStatic<T>
}

// ============================================================================
// PARAMETER AND ATTRIBUTE TYPES
// ============================================================================

/**
 * Keys on T whose values are associations (Model or Model[]).
 */
export type AssociationKeys<T> = {
  [K in keyof T]: NonNullable<T[K]> extends Model | Model[] ? K : never
}[keyof T]

/**
 * Association property names as string keys, usable as FactoryParams keys.
 */
export type AssociationName<T extends Model> = AssociationKeys<T> & string

/**
 * Foreign key attribute names: string keys present on both the creation
 * attributes and the model. Used for FK overrides in FactoryParams.
 */
export type ForeignKeyName<T extends Model> = keyof InferCreationAttributes<T> & keyof T & string

type FactoryParamKeys<T extends Model> = keyof InferCreationAttributes<T> | AssociationKeys<T>

/**
 * Factory params accepting both creation attributes and association instances.
 *
 * Uses a single mapped type (not an intersection) so that excess property
 * checking rejects invalid keys on object literals at call sites.
 */
export type FactoryParams<T extends Model> = {
  [K in FactoryParamKeys<T>]?: FactoryParamValue<T, K>
}

type FactoryParamValue<
  T extends Model,
  K extends FactoryParamKeys<T>,
> = K extends keyof InferCreationAttributes<T>
  ? InferCreationAttributes<T>[K]
  : K extends keyof T
    ? T[K]
    : never

/**
 * Return type for generator functions.
 */
export type GeneratorReturn<T extends Model> = {
  [K in FactoryParamKeys<T>]?: FactoryParamValue<T, K>
}

// ============================================================================
// GENERATOR AND HOOK TYPES
// ============================================================================

/**
 * Context provided to factory generator functions.
 */
export type GeneratorContext<T extends Model, TransientParams = Record<string, never>> = {
  sequence: number
  params: FactoryParams<T>
  associate: AssociateFunction<T>
  afterCreate: (fn: AfterCreateFn<T>) => void
  beforeCreate: (fn: BeforeCreateFn<T>) => void
  transient: TransientParams
}

export type GeneratorFn<T extends Model, TransientParams = Record<string, never>> = (
  context: GeneratorContext<T, TransientParams>
) => GeneratorReturn<T>

/**
 * Type-safe generator that enforces excess property checking via RejectExcessKeys.
 */
export type StrictGeneratorFn<
  T extends Model,
  TransientParams = Record<string, never>,
  P extends GeneratorReturn<T> = GeneratorReturn<T>,
> = (context: GeneratorContext<T, TransientParams>) => RejectExcessKeys<P, GeneratorReturn<T>>

export type AfterCreateFn<T extends Model> = (model: T) => Promise<void>

/**
 * Runs with the fully-populated instance after FKs are set but before save.
 * Use to compute attributes that depend on resolved FK values. Not called during `build()`.
 */
export type BeforeCreateFn<T extends Model> = (model: T) => void | Promise<void>

export type AssociateFunction<T extends Model> = <A extends Model>(
  name: AssociationName<T>,
  factory: FactoryInterface<A>,
  overrides?: FactoryParams<A> | ((resolvedParams: FactoryParams<T>) => FactoryParams<A>)
) => A

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Marks keys in P that aren't in Target as `never`, surfacing excess-property
 * errors in generic callback return types where TS would normally skip them.
 */
export type RejectExcessKeys<P, Target> = P & Record<Exclude<keyof P, keyof Target>, never>

/**
 * Value shape for Sequelize primary/foreign keys — number (int PKs) or string
 * (uuid/natural PKs). Narrower than `unknown`, so callers don't need casts.
 */
export type ForeignKeyValue = string | number

/**
 * Build-mode placeholder: when a foreign key is provided but the association
 * is not loaded, we attach an object with just the id field.
 */
export type MinimalAssociation = {
  id: ForeignKeyValue
}
