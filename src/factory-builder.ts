// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import type { CreationAttributes, Model, ModelStatic } from "@sequelize/core"

import { AssociationManager } from "./association-manager"
import { AttributeBuilder } from "./attribute-builder"
import { FactoryContext } from "./factory-context"
import { BuildStrategy } from "./strategy/build-strategy"
import { CreateStrategy } from "./strategy/create-strategy"

import type {
  AfterCreateFn,
  BeforeCreateFn,
  FactoryInterface,
  FactoryParams,
  GeneratorFn,
} from "./types"

type BuilderState<T extends Model, TransientParams> = {
  modelClass: ModelStatic<T>
  generator: GeneratorFn<T, TransientParams>
  defaultTransientParams: TransientParams
  defaultParams: FactoryParams<T>
  defaultAssociations: Record<string, Model>
  afterCreateHooks: AfterCreateFn<T>[]
  beforeCreateHooks: BeforeCreateFn<T>[]
}

type FactoryEvaluator<T extends Model> = {
  attributeBuilder: {
    triggerGenerator(): void
    mergeAttributes(): CreationAttributes<T>
    getAfterCreateHooks(): AfterCreateFn<T>[]
    getBeforeCreateHooks(): BeforeCreateFn<T>[]
  }
  associationManager: AssociationManager<T>
}

/**
 * Orchestrates factory build and create flows by wiring together the
 * attribute generator, association manager, and hook runners. Immutable:
 * configuration methods (params/associations/hooks) return a new builder.
 */
export class FactoryBuilder<T extends Model, TransientParams = Record<string, never>> {
  // Keep sequence state on each builder so immutable configured clones start at zero.
  private sequenceCounter = 0

  constructor(
    public readonly modelClass: ModelStatic<T>,
    private readonly generator: GeneratorFn<T, TransientParams>,
    private readonly defaultTransientParams: TransientParams,
    private readonly defaultParams: FactoryParams<T> = {},
    private readonly defaultAssociations: Record<string, Model> = {},
    private readonly afterCreateHooks: AfterCreateFn<T>[] = [],
    private readonly beforeCreateHooks: BeforeCreateFn<T>[] = []
  ) {}

  build(params?: FactoryParams<T>): T {
    const { attributeBuilder, associationManager } = this.createEvaluator(params)
    const model = BuildStrategy.build(this.modelClass, attributeBuilder.mergeAttributes())

    associationManager.attachAssociations(model)

    return model
  }

  async create(params?: FactoryParams<T>): Promise<T> {
    const { attributeBuilder, associationManager } = this.createEvaluator(params)

    attributeBuilder.triggerGenerator()
    await associationManager.createAssociations()

    const model = this.modelClass.build(attributeBuilder.mergeAttributes())
    await associationManager.attachAssociationsAsync(model)

    await this.runHooks(model, [
      ...this.beforeCreateHooks,
      ...attributeBuilder.getBeforeCreateHooks(),
    ])

    const savedModel = await CreateStrategy.save(model)
    await this.runHooks(savedModel, [
      ...this.afterCreateHooks,
      ...attributeBuilder.getAfterCreateHooks(),
    ])

    return savedModel
  }

  associations<A extends Model>(
    associations: Record<string, A>
  ): FactoryInterface<T, TransientParams> {
    return this.clone({ defaultAssociations: associations })
  }

  params(params: FactoryParams<T>): FactoryInterface<T, TransientParams> {
    return this.clone({
      defaultParams: {
        ...this.defaultParams,
        ...params,
      },
    })
  }

  transient(params: Partial<TransientParams>): FactoryInterface<T, TransientParams> {
    const mergedTransientParams = {
      ...this.defaultTransientParams,
      ...params,
    } as TransientParams

    return this.clone({ defaultTransientParams: mergedTransientParams })
  }

  afterCreate(hook: AfterCreateFn<T>): FactoryInterface<T, TransientParams> {
    return this.clone({ afterCreateHooks: [...this.afterCreateHooks, hook] })
  }

  beforeCreate(hook: BeforeCreateFn<T>): FactoryInterface<T, TransientParams> {
    return this.clone({ beforeCreateHooks: [...this.beforeCreateHooks, hook] })
  }

  private createEvaluator(params?: FactoryParams<T>): FactoryEvaluator<T> {
    const mergedParams = {
      ...this.defaultAssociations,
      ...this.defaultParams,
      ...params,
    }
    const factoryContext = new FactoryContext<T>(this.modelClass, mergedParams)
    const attributeBuilder = new AttributeBuilder<T, TransientParams>({
      generator: this.generator,
      sequence: ++this.sequenceCounter,
      transientParams: this.defaultTransientParams,
      associate: factoryContext.associate,
      params: factoryContext.getParams(),
    })
    const associationManager = new AssociationManager(
      this.modelClass,
      factoryContext.registrations,
      factoryContext.getParams()
    )

    return {
      attributeBuilder,
      associationManager,
    }
  }

  private clone(
    overrides: Partial<BuilderState<T, TransientParams>>
  ): FactoryInterface<T, TransientParams> {
    const state: BuilderState<T, TransientParams> = {
      modelClass: this.modelClass,
      generator: this.generator,
      defaultTransientParams: this.defaultTransientParams,
      defaultParams: this.defaultParams,
      defaultAssociations: this.defaultAssociations,
      afterCreateHooks: this.afterCreateHooks,
      beforeCreateHooks: this.beforeCreateHooks,
      ...overrides,
    }
    return new FactoryBuilder(
      state.modelClass,
      state.generator,
      state.defaultTransientParams,
      state.defaultParams,
      state.defaultAssociations,
      state.afterCreateHooks,
      state.beforeCreateHooks
    )
  }

  private async runHooks<H extends (model: T) => unknown>(model: T, hooks: H[]): Promise<void> {
    for (const hook of hooks) {
      await hook(model)
    }
  }
}
