// Adapted from WRAP factory examples.
// Original factory code is Apache-2.0; see LICENSE in the repository.
import FactoryShark from "factory-shark"

import { WorkflowAccessByUser } from "@/models"

import userFactory from "@/factories/user-factory"
import workflowFactory from "@/factories/workflow-factory"
import workflowPlayerFactory from "@/factories/workflow-player-factory"

export const workflowAccessByUserFactory = FactoryShark.define(
  WorkflowAccessByUser,
  ({ associate }) => {
    associate("workflow", workflowFactory)
    associate("user", userFactory)
    associate("workflowPlayer", workflowPlayerFactory)

    return {}
  }
)

export default workflowAccessByUserFactory
