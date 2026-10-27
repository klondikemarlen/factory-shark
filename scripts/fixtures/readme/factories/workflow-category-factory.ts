import { faker } from "@faker-js/faker"
import FactoryShark from "factory-shark"

import { WorkflowCategory } from "@/models"

import organizationFactory from "@/factories/organization-factory"

export const workflowCategoryFactory = FactoryShark.define(
  WorkflowCategory,
  ({ sequence, associate }) => {
    associate("organization", organizationFactory)

    return {
      title: `${faker.science.chemicalElement().name}-${sequence}`,
    }
  }
)

export default workflowCategoryFactory
