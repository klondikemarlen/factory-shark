// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

import type {
  AfterCreateFn,
  AssociateFunction,
  BeforeCreateFn,
  CoreFactoryParams,
  CoreGeneratorReturn,
  GeneratorFn,
} from "@/src/types.js"

export type AttributeBuilderOptions<
  T extends object,
  Attributes extends object,
  TransientParams,
> = {
  generator: GeneratorFn<T, Attributes, TransientParams>
  sequence: number
  transientParams: TransientParams
  associate: AssociateFunction<T, Attributes>
  params: CoreFactoryParams<T, Attributes>
}

export class AttributeBuilder<T extends object, Attributes extends object, TransientParams> {
  private readonly generator: GeneratorFn<T, Attributes, TransientParams>
  private readonly sequence: number
  private readonly transientParams: TransientParams
  private readonly associateFn: AssociateFunction<T, Attributes>
  private readonly params: CoreFactoryParams<T, Attributes>
  private readonly afterCreateHooks: AfterCreateFn<T>[] = []
  private readonly beforeCreateHooks: BeforeCreateFn<T>[] = []
  // Attribute merging and hook discovery share one evaluation, so generator side effects run once.
  private cachedAttributes?: CoreGeneratorReturn<T, Attributes>

  constructor(options: AttributeBuilderOptions<T, Attributes, TransientParams>) {
    this.generator = options.generator
    this.sequence = options.sequence
    this.transientParams = options.transientParams
    this.associateFn = options.associate
    this.params = options.params
  }

  triggerGenerator(): void {
    this.generateAttributes()
  }

  mergeAttributes(): Attributes {
    const generatedAttributes = this.generateAttributes()
    return {
      ...generatedAttributes,
      ...this.params,
    } as Attributes
  }

  getAfterCreateHooks(): AfterCreateFn<T>[] {
    return this.afterCreateHooks
  }

  getBeforeCreateHooks(): BeforeCreateFn<T>[] {
    return this.beforeCreateHooks
  }

  private generateAttributes(): CoreGeneratorReturn<T, Attributes> {
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
