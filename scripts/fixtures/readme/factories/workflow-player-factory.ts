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
