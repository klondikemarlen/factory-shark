// Originally from WRAP's FactoryShark; extracted and modified for standalone distribution.
// Apache-2.0 terms and original attribution are preserved.

/**
 * Create strategy — mirrors factory_bot's Strategy::Create. Only saves the
 * instance; association trees are resolved independently by AssociationManager.
 */
export class CreateStrategy {
  static async save<T extends { isNewRecord: boolean; save(): Promise<unknown> }>(
    modelInstance: T
  ): Promise<T> {
    if (modelInstance.isNewRecord === true) {
      await modelInstance.save()
    }
    return modelInstance
  }
}
