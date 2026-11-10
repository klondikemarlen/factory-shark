import { sequelize } from "@/models"

beforeEach(async () => {
  await sequelize.sync({ force: true })
})

afterAll(async () => {
  await sequelize.close()
})
