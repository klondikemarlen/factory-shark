// Adapted from WRAP factories at revision 24ce6097a1f2c4d87a09dddcec88e33b8859782b.
// Original factory code is Apache-2.0; see LICENSE-APACHE in the repository.
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
