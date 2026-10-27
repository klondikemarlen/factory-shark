import FactoryShark from "factory-shark"

import { Sequence } from "@/models"

export const sequenceFactory = FactoryShark.define(Sequence, ({ sequence }) => ({
  prefix: `SEQ-${sequence}`,
  format: "workflow_alpha_numeric",
}))

export default sequenceFactory
