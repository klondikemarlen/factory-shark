// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import { type CreationAttributes, type Model, type ModelStatic } from "@sequelize/core"

/**
 * Build strategy — mirrors factory_bot's Strategy::Build. Associations are
 * built but not saved, so nested trees can be constructed without persistence.
 */
export class BuildStrategy {
  static build<T extends Model>(modelClass: ModelStatic<T>, attributes: CreationAttributes<T>): T {
    return modelClass.build(attributes)
  }
}
