import Koa from 'koa'
import Router from 'koa-router'
import Pug from 'koa-pug'
import logger from 'koa-logger'
import pg from 'pg'
import randomstring from 'randomstring'

const app = new Koa()
const router = new Router()
const pug = new Pug({
  viewPath: 'src',
})
pug.use(app)

const pool = new pg.Pool()

router.get('/', async ctx => {
  let generatedGrabPath = null
  if (ctx.request.query.generate) {
    do {
      generatedGrabPath = randomstring.generate({
        length: 16,
        readable: true,
      })
      try {
        await pool.query(
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
  let accesses: {time: string, ip: string}[] | undefined

  await pool.query('BEGIN')
  const pageRes = await pool.query(
    `SELECT id, creation_time, creation_ip
    FROM page
    WHERE path = $1::text`,
    [grabPath],
  )
  if (pageRes.rowCount) {
    const pageId = pageRes.rows[0].id
    creationTime = pageRes.rows[0].creation_time
    creationIp = pageRes.rows[0].creation_ip
    await pool.query(
      `INSERT INTO access (page_id, time, ip)
      VALUES ($1::integer, NOW(), $2::inet)`,
      [pageId, ctx.request.ip],
    )
    const accessesRes = await pool.query(
      `SELECT time, ip
      FROM access
      WHERE page_id = $1::integer
      ORDER BY time`,
      [pageId],
    )
    accesses = accessesRes.rows
  }
  await pool.query('COMMIT')

  if (pageRes.rowCount) {
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
