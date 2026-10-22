// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import type { CreationAttributes, Model } from "@sequelize/core"

import type {
  AfterCreateFn,
  AssociateFunction,
  BeforeCreateFn,
  FactoryParams,
  GeneratorFn,
  GeneratorReturn,
} from "./types"

export type AttributeBuilderOptions<T extends Model, TransientParams> = {
  generator: GeneratorFn<T, TransientParams>
  sequence: number
  transientParams: TransientParams
  associate: AssociateFunction<T>
  params: FactoryParams<T>
}

/**
 * Generates factory attributes by invoking the generator exactly once and
 * merging its output with caller-provided params. Params may mutate during
 * association creation (FK backfill), so merge is deferred to read time.
 */
export class AttributeBuilder<T extends Model, TransientParams> {
  private readonly generator: GeneratorFn<T, TransientParams>
  private readonly sequence: number
  private readonly transientParams: TransientParams
  private readonly associateFn: AssociateFunction<T>
  private readonly params: FactoryParams<T>
  private readonly afterCreateHooks: AfterCreateFn<T>[] = []
  private readonly beforeCreateHooks: BeforeCreateFn<T>[] = []

  // Cache generator output so the same evaluation and hooks are produced only once.
  private cachedAttributes?: GeneratorReturn<T>

  constructor(options: AttributeBuilderOptions<T, TransientParams>) {
    this.generator = options.generator
    this.sequence = options.sequence
    this.transientParams = options.transientParams
    this.associateFn = options.associate
    this.params = options.params
  }

  triggerGenerator(): void {
    this.generateAttributes()
  }

  mergeAttributes(): CreationAttributes<T> {
    const generatedAttributes = this.generateAttributes()
    return {
      ...generatedAttributes,
      ...this.params,
    }
  }

  getAfterCreateHooks(): AfterCreateFn<T>[] {
    return this.afterCreateHooks
  }

  getBeforeCreateHooks(): BeforeCreateFn<T>[] {
    return this.beforeCreateHooks
  }

  private generateAttributes(): GeneratorReturn<T> {
    if (this.cachedAttributes) return this.cachedAttributes

    this.cachedAttributes = this.generator({
      sequence: this.sequence,
      params: this.params,
      associate: this.associateFn,
      afterCreate: (hook) => {
        this.afterCreateHooks.push(hook)
      },
      beforeCreate: (hook) => {
        this.beforeCreateHooks.push(hook)
      },
      transient: this.transientParams,
    })

    return this.cachedAttributes
  }
}
