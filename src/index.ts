import { FactoryShark } from "@/src/factory-shark.js"

export {
  AssociationManager,
  AssociationNotFoundError,
  AttributeBuilder,
  CreateStrategy,
  FactoryContext,
  FactoryShark,
  ForeignKeyNotFoundError,
  isModel,
  PRIMARY_KEY,
} from "./factory-shark.js"

export type {
  AfterCreateFn,
  AssociationRegistration,
  AttributeBuilderOptions,
  BeforeCreateFn,
  FactoryInterface,
  FactoryParams,
  GeneratorFn,
  RejectExcessKeys,
} from "./factory-shark.js"

export default FactoryShark
