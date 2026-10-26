// Adapted from WRAP factories at revision 24ce6097a1f2c4d87a09dddcec88e33b8859782b.
// Original factory code is Apache-2.0; see LICENSE-APACHE in the repository.
import FactoryShark from "factory-shark"

import { Sequence } from "@/models"

export const sequenceFactory = FactoryShark.define(Sequence, ({ sequence }) => ({
  prefix: `SEQ-${sequence}`,
  format: "workflow_alpha_numeric",
}))

export default sequenceFactory
