// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.
/**
 * Error handling utilities for the FactoryShark library.
 *
 * Provides consistent error messages and error types for common factory operations.
 */

/**
 * Error thrown when an association is not found on a model.
 */
export class AssociationNotFoundError extends Error {
  constructor(modelName: string, associationName: string, availableAssociations: string[]) {
    super(
      `Association "${associationName}" not found on model ${modelName}. ` +
        `Available associations: ${availableAssociations.join(", ")}`
    )
    this.name = "AssociationNotFoundError"
  }
}

/**
 * Error thrown when a foreign key is not found for an association.
 */
export class ForeignKeyNotFoundError extends Error {
  constructor(modelName: string, associationName: string) {
    super(
      `Foreign key not found for association "${associationName}" on model ${modelName}. ` +
        `This may indicate a misconfigured association.`
    )
    this.name = "ForeignKeyNotFoundError"
  }
}
