import { AssociationManager as CoreAssociationManager } from "@/src/association-manager.js"
import { AttributeBuilder as CoreAttributeBuilder } from "@/src/attribute-builder.js"
import { FactoryContext as CoreFactoryContext } from "@/src/factory-context.js"
import { adapterFor } from "@/src/compatibility/sequelize/create-sequelize-adapter.js"
import type { AttributeBuilderOptions as CoreAttributeBuilderOptions } from "@/src/attribute-builder.js"
import type { AssociationRegistration as CoreAssociationRegistration } from "@/src/factory-context.js"
import type { FactoryParams, GeneratorContext, GeneratorFn } from "@/src/factory-shark.js"
import type { AssociateFunction as CoreAssociateFunction } from "@/src/types.js"
import type {
  SequelizeCreationAttributes as InferCreationAttributes,
  SequelizeModel as Model,
  SequelizeModelStatic as ModelStatic,
} from "@/src/compatibility/sequelize/types.js"

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
  associate: GeneratorContext<T>["associate"]
}

export class FactoryContext<T extends Model = Model> extends CoreFactoryContext<
  T,
  InferCreationAttributes<T>,
  ModelStatic<T>
> {
  declare readonly registrations: AssociationRegistration<T>[]
  declare associate: GeneratorContext<T>["associate"] &
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
