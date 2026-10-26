// Adapted from WRAP factory examples.
// Original factory code is Apache-2.0; see LICENSE in the repository.
import FactoryShark from "factory-shark"

import { WorkflowPlayer } from "@/models"

import userFactory from "@/factories/user-factory"
import workflowFactory from "@/factories/workflow-factory"

export const workflowPlayerFactory = FactoryShark.define(WorkflowPlayer, ({ associate }) => {
  associate("workflow", workflowFactory)
  associate("addedByUser", userFactory)

  return {}
})

export default workflowPlayerFactory
