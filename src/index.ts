import { FactoryShark } from "@/src/factory-shark.js"

export { FactoryShark } from "./factory-shark.js"
export {
  AssociationManager,
  AttributeBuilder,
  FactoryContext,
} from "./compatibility/sequelize/public-helpers.js"
export { AssociationNotFoundError, ForeignKeyNotFoundError } from "./errors.js"
export { CreateStrategy } from "./strategy/create-strategy.js"
export { isModel } from "./compatibility/sequelize/create-sequelize-adapter.js"
export { PRIMARY_KEY } from "./utils.js"

export type { FactoryInterface, FactoryParams, GeneratorFn } from "./factory-shark.js"
export type {
  AssociationRegistration,
  AttributeBuilderOptions,
} from "./compatibility/sequelize/public-helpers.js"
export type { AfterCreateFn, BeforeCreateFn, RejectExcessKeys } from "./types.js"
export type { FactoryInclude } from "./compatibility/sequelize/types.js"

export default FactoryShark
