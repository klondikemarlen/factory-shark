// Adapted from WRAP factories at revision 24ce6097a1f2c4d87a09dddcec88e33b8859782b.
// Original factory code is Apache-2.0; see LICENSE-APACHE in the repository.
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
