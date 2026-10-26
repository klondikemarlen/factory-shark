// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

import { FactoryShark } from "./sequelize-v7"

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
} from "./sequelize-v7"

export type { BeforeCreateFn, FactoryInterface, FactoryParams, GeneratorFn } from "./sequelize-v7"

export default FactoryShark
