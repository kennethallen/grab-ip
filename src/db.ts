import pgp from 'pg-promise'
import { env } from 'process'

export default pgp()(env.PGCONNECTION!)
