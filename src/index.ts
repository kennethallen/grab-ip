import Koa from 'koa'
import Router from 'koa-router'
import Pug from 'koa-pug'
import logger from 'koa-logger'
import randomstring from 'randomstring'
import db from './db'

const app = new Koa()
const router = new Router()
const pug = new Pug({
  viewPath: 'views',
})
pug.use(app)

router.get('/', async ctx => {
  let generatedGrabPath = null
  if (ctx.request.query.generate) {
    do {
      generatedGrabPath = randomstring.generate({
        length: 16,
        readable: true,
      })
      try {
        await db.none(
          `INSERT INTO page (path, creation_time, creation_ip)
          VALUES ($1::text, NOW(), $2::inet)`,
          [generatedGrabPath, ctx.request.ip],
        )
      } catch (err) {
        if (err.code === '23505') { // Unique key violation
          generatedGrabPath = null
        } else {
          throw err
        }
      }
    } while (generatedGrabPath === null)
  }

  await ctx.render('index', {
    generatedGrabPath,
  })
})

router.get('/:grabPath', async ctx => {
  const grabPath = ctx.params.grabPath
  let creationTime: Date | undefined
  let creationIp: string | undefined
  let accesses: { time: string, ip: string }[] | undefined

  // eslint-disable-next-line camelcase
  let pageRes: { id: string, creation_time: Date, creation_ip: string } | null | undefined
  await db.tx(async t => {
    pageRes = await t.oneOrNone(
      `SELECT id, creation_time, creation_ip
      FROM page
      WHERE path = $1::text`,
      [grabPath],
    )
    console.log(JSON.stringify(pageRes))
    if (pageRes) {
      const pageId = pageRes.id
      creationTime = pageRes.creation_time
      creationIp = pageRes.creation_ip
      await t.none(
        `INSERT INTO access (page_id, time, ip)
        VALUES ($1::integer, NOW(), $2::inet)`,
        [pageId, ctx.request.ip],
      )
      accesses = await t.manyOrNone(
        `SELECT time, ip
        FROM access
        WHERE page_id = $1::integer
        ORDER BY time`,
        [pageId],
      )
    }
  })

  if (pageRes) {
    await ctx.render('grab', {
      grabPath,
      creationTime,
      creationIp,
      accesses,
    })
  } else {
    ctx.throw(404)
  }
})

app.use(logger())
app.use(router.routes())
app.use(router.allowedMethods())
app.listen(process.env.PORT ?? 3000, () => {
  console.log('Server started.')
})
