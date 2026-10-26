import { initializeModels } from "@/initialize-models"

const sequelize = initializeModels()

beforeEach(async () => {
  await sequelize.sync({ force: true })
})

afterAll(async () => {
  await sequelize.close()
})
