// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

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
