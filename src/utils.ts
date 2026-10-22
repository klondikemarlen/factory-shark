// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
import type { Model } from "@sequelize/core"

/**
 * Default primary key field name for Sequelize models.
 */
export const PRIMARY_KEY = "id"

/**
 * Type guard to check if a value is a Model instance.
 */
export function isModel(value: unknown): value is Model {
  return (
    value !== null && typeof value === "object" && "dataValues" in value && "isNewRecord" in value
  )
}
