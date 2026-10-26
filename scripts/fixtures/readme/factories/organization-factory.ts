// Adapted from WRAP factory examples.
// Original factory code is Apache-2.0; see LICENSE in the repository.
import { faker } from "@faker-js/faker"
import FactoryShark from "factory-shark"

import { Organization } from "@/models"

import sequenceFactory from "@/factories/sequence-factory"

export const organizationFactory = FactoryShark.define(Organization, ({ sequence, associate }) => {
  associate("sequence", sequenceFactory)

  return {
    name: `${faker.company.name()}-${sequence}`,
    number: sequence.toString().padStart(2, "0"),
    acronym: `ORG-${sequence}`,
    timezone: "UTC-7",
  }
})

export default organizationFactory
