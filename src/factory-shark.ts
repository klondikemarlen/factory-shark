// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import { type Model, type ModelStatic } from "@sequelize/core"

import { FactoryBuilder } from "./factory-builder"
import {
  type AfterCreateFn,
  type BeforeCreateFn,
  type FactoryInterface,
  type FactoryParams,
  type GeneratorFn,
  type GeneratorReturn,
  type StrictGeneratorFn,
} from "./types"

export { type GeneratorFn } from "./types"

/**
 * FactoryShark for creating Sequelize models with associations.
 *
 * Inspired by Ruby's factory_bot, this factory handles:
 * - Attribute generation with sequence counters
 * - BelongsTo association creation and assignment
 * - Override merging (attributes take precedence over associations)
 * - Transient attributes for afterCreate hooks
 * - After-create hooks
 *
 * @example
 * ```typescript
 * import { FactoryShark } from "factory-shark"
 * import { User, Organization } from "./models"
 *
 * // Basic factory definition
 * const userFactory = FactoryShark.define(User, ({ sequence, associate }) => {
 *   associate("organization", organizationFactory)
 *
 *   return {
 *     firstName: `User${sequence}`,
 *     lastName: "Test",
 *     email: `user${sequence}@example.com`,
 *   }
 * })
 *
 * // Create an instance
 * const user = await userFactory.create()
 *
 * // Build without saving
 * const builtUser = userFactory.build()
 *
 * // Override attributes
 * const customUser = await userFactory.create({
 *   firstName: "Custom",
 *   email: "custom@example.com"
 * })
 *
 * // Use transient parameters
 * const factoryWithTransient = userFactory.transient({ roles: ["admin"] })
 * ```
 */
export class FactoryShark<T extends Model, TransientParams = Record<string, never>>
  implements FactoryInterface<T, TransientParams>
{
  private builder: FactoryBuilder<T, TransientParams>
  public readonly modelClass: ModelStatic<T>

  constructor(
    modelClass: ModelStatic<T>,
    generator: GeneratorFn<T, TransientParams>,
    defaultTransientParams: TransientParams
  ) {
    this.builder = new FactoryBuilder(modelClass, generator, defaultTransientParams)
    this.modelClass = modelClass
  }

  /**
   * The extra generic P captures the generator's actual return type so that
   * RejectExcessKeys can flag properties that aren't valid GeneratorReturn<T> keys.
   */
  static define<
    T extends Model,
    TransientParams = Record<string, never>,
    P extends GeneratorReturn<T> = GeneratorReturn<T>,
  >(
    modelClass: ModelStatic<T>,
    generator: StrictGeneratorFn<T, TransientParams, P>
  ): FactoryShark<T, TransientParams> {
    const defaultTransientParams: TransientParams = {} as TransientParams
    return new FactoryShark(modelClass, generator, defaultTransientParams)
  }

  transient(transientParams: Partial<TransientParams>): FactoryInterface<T, TransientParams> {
    return this.builder.transient(transientParams)
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
    return this.builder.associations(associations)
  }

  params(params: FactoryParams<T>): FactoryInterface<T, TransientParams> {
    return this.builder.params(params)
  }

  afterCreate(hook: AfterCreateFn<T>): FactoryInterface<T, TransientParams> {
    return this.builder.afterCreate(hook)
  }

  beforeCreate(hook: BeforeCreateFn<T>): FactoryInterface<T, TransientParams> {
    return this.builder.beforeCreate(hook)
  }
}

export default FactoryShark
