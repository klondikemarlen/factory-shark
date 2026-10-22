// Adapted from WRAP factories at revision 24ce6097a1f2c4d87a09dddcec88e33b8859782b.
// Original factory code is Apache-2.0; see LICENSE-APACHE in the repository.
import { faker } from "@faker-js/faker"

import FactoryShark from "factory-shark"

import { Organization } from "../models"

import sequenceFactory from "./sequence-factory"

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
