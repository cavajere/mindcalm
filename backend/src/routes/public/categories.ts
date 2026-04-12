import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { prisma } from '../../lib/prisma'
import { appAuthMiddleware } from '../../middleware/auth'

const router = createAsyncRouter()

router.use(appAuthMiddleware)

// GET /api/categories — elenco categorie
router.get('/', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: {
      audios: {
        some: {
          status: 'PUBLISHED',
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { audios: { where: { status: 'PUBLISHED' } } } },
    },
  })

  res.json(categories.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    color: c.color,
    icon: c.icon,
    sortOrder: c.sortOrder,
    audioCount: c._count.audios,
  })))
})

export default router
