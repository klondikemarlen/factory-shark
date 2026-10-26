// Adapted from WRAP factory examples.
// Original factory code is Apache-2.0; see LICENSE in the repository.
import FactoryShark from "factory-shark"

import { Sequence } from "@/models"

export const sequenceFactory = FactoryShark.define(Sequence, ({ sequence }) => ({
  prefix: `SEQ-${sequence}`,
  format: "workflow_alpha_numeric",
}))

export default sequenceFactory
