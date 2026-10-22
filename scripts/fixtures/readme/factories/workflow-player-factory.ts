// Adapted from WRAP factories at revision 24ce6097a1f2c4d87a09dddcec88e33b8859782b.
// Original factory code is Apache-2.0; see LICENSE-APACHE in the repository.
import FactoryShark from "factory-shark"

import { WorkflowPlayer } from "../models"

import userFactory from "./user-factory"
import workflowFactory from "./workflow-factory"

export const workflowPlayerFactory = FactoryShark.define(WorkflowPlayer, ({ associate }) => {
  associate("workflow", workflowFactory)
  associate("addedByUser", userFactory)

  return {}
})

export default workflowPlayerFactory
