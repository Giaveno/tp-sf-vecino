import { neon } from '@neondatabase/serverless'
import { readFile } from 'node:fs/promises'

try {
  const sql = neon(process.env.DATABASE_URL)
  const script = await readFile(new URL('./migrations/001_push.sql', import.meta.url), 'utf8')
  const statements = script.split(';').map((statement) => statement.trim()).filter(Boolean)
  await sql.transaction([
    sql.query("SELECT pg_advisory_xact_lock(hashtextextended('tp5_push:migration', 0))", []),
    ...statements.map((statement) => sql.query(statement, [])),
  ], { isolationLevel: 'ReadCommitted', fetchOptions: { signal: AbortSignal.timeout(15_000) } })
  console.log('TP5 push schema migration 001 applied successfully.')
} catch {
  console.error('TP5 push schema migration failed. Check the database connection and schema permissions; no credentials are printed.')
  process.exitCode = 1
}
