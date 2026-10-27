import { AssociationManager } from "@/src/association-manager.js"
import { AttributeBuilder } from "@/src/attribute-builder.js"
import { FactoryContext } from "@/src/factory-context.js"
import type { FactoryAdapter } from "@/src/orm-adapter.js"
import type {
  AfterCreateFn,
  BeforeCreateFn,
  CoreFactoryParams,
  FactoryInterface,
  GeneratorFn,
} from "@/src/types.js"

export class FactoryBuilder<
  T extends object,
  Attributes extends object,
  ModelClass,
  TransientParams = Record<string, never>,
> {
  // Each configured clone owns a fresh counter; evaluating it never advances its source.
  private sequenceCounter = 0

  constructor(
    public readonly modelClass: ModelClass,
    private readonly adapter: FactoryAdapter<T, Attributes, ModelClass>,
    private readonly generator: GeneratorFn<T, Attributes, TransientParams>,
    private readonly defaultTransientParams: TransientParams,
    private readonly defaultParams: CoreFactoryParams<T, Attributes> = {},
    private readonly defaultAssociations: Record<string, object> = {},
    private readonly afterCreateHooks: AfterCreateFn<T>[] = [],
    private readonly beforeCreateHooks: BeforeCreateFn<T>[] = []
  ) {}

  build(params?: CoreFactoryParams<T, Attributes>): T {
    const { attributeBuilder, associationManager } = this.createEvaluator(params)
    const model = this.adapter.build(this.modelClass, attributeBuilder.mergeAttributes())

    associationManager.attachAssociations(model)
    return model
  }

  async create(params?: CoreFactoryParams<T, Attributes>): Promise<T> {
    const { attributeBuilder, associationManager } = this.createEvaluator(params)

    attributeBuilder.triggerGenerator()
    await associationManager.createAssociations()

    const model = this.adapter.build(this.modelClass, attributeBuilder.mergeAttributes())
    await associationManager.attachAssociationsAsync(model)
    await this.runHooks(model, [
      ...this.beforeCreateHooks,
      ...attributeBuilder.getBeforeCreateHooks(),
    ])

    const savedModel = await this.adapter.save(model)
    await this.runHooks(savedModel, [
      ...this.afterCreateHooks,
      ...attributeBuilder.getAfterCreateHooks(),
    ])

    return savedModel
  }

  associations<A extends object>(
    associations: Record<string, A>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams> {
    return this.clone({ defaultAssociations: associations })
  }

  params(
    params: CoreFactoryParams<T, Attributes>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams> {
    return this.clone({ defaultParams: { ...this.defaultParams, ...params } })
  }

  transient(
    params: Partial<TransientParams>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams> {
    const mergedTransientParams = { ...this.defaultTransientParams, ...params } as TransientParams
    return this.clone({ defaultTransientParams: mergedTransientParams })
  }

  afterCreate(
    hook: AfterCreateFn<T>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams> {
    return this.clone({ afterCreateHooks: [...this.afterCreateHooks, hook] })
  }

  beforeCreate(
    hook: BeforeCreateFn<T>
  ): FactoryInterface<T, Attributes, ModelClass, TransientParams> {
    return this.clone({ beforeCreateHooks: [...this.beforeCreateHooks, hook] })
  }

  private createEvaluator(params?: CoreFactoryParams<T, Attributes>) {
    const mergedParams = { ...this.defaultAssociations, ...this.defaultParams, ...params }
    const factoryContext = new FactoryContext<T, Attributes, ModelClass>(
      this.modelClass,
      mergedParams,
      this.adapter
    )
    const attributeBuilder = new AttributeBuilder<T, Attributes, TransientParams>({
      generator: this.generator,
      sequence: ++this.sequenceCounter,
      transientParams: this.defaultTransientParams,
      associate: factoryContext.associate,
      params: factoryContext.getParams(),
    })
    const associationManager = new AssociationManager(
      this.modelClass,
      factoryContext.registrations,
      factoryContext.getParams(),
      this.adapter
    )

    return { attributeBuilder, associationManager }
  }

  private clone(overrides: {
    defaultTransientParams?: TransientParams
    defaultParams?: CoreFactoryParams<T, Attributes>
    defaultAssociations?: Record<string, object>
    afterCreateHooks?: AfterCreateFn<T>[]
    beforeCreateHooks?: BeforeCreateFn<T>[]
  }): FactoryInterface<T, Attributes, ModelClass, TransientParams> {
    return new FactoryBuilder(
      this.modelClass,
      this.adapter,
      this.generator,
      overrides.defaultTransientParams ?? this.defaultTransientParams,
      overrides.defaultParams ?? this.defaultParams,
      overrides.defaultAssociations ?? this.defaultAssociations,
      overrides.afterCreateHooks ?? this.afterCreateHooks,
      overrides.beforeCreateHooks ?? this.beforeCreateHooks
    )
  }

  private async runHooks<H extends (model: T) => unknown>(model: T, hooks: H[]): Promise<void> {
    for (const hook of hooks) {
      await hook(model)
    }
  }
}
