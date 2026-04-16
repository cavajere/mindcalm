import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { getPublicContactSettingsForPublic } from '../../services/publicContactSettingsService'

const router = createAsyncRouter()

router.get('/contact', async (_req: Request, res: Response) => {
  const settings = await getPublicContactSettingsForPublic()
  res.json(settings)
})

export default router
