// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import { FactoryContext } from "./factory-context"
import { FactoryShark } from "./factory-shark"
import { AssociationManager } from "./association-manager"
import { AttributeBuilder } from "./attribute-builder"
import { CreateStrategy } from "./strategy/create-strategy"
import { isModel, PRIMARY_KEY } from "./utils"

import { AssociationNotFoundError, ForeignKeyNotFoundError } from "./errors"

export {
  FactoryContext,
  FactoryShark,
  AssociationManager,
  AttributeBuilder,
  CreateStrategy,
  AssociationNotFoundError,
  ForeignKeyNotFoundError,
  isModel,
  PRIMARY_KEY,
}

export {
  type BeforeCreateFn,
  type FactoryInterface,
  type FactoryParams,
  type GeneratorFn,
} from "./types"

export default FactoryShark
