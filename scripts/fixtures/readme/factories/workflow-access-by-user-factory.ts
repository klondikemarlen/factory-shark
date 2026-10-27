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
