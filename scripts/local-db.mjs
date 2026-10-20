// A Postgres for local development, so you don't need to install one. The data lives in .pgdata/
// and is kept between runs. `npm run db:local` runs just the database; `npm run dev` starts it too.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCAL_DB_PORT = 54320;
export const LOCAL_DATABASE_URL = `postgresql://postgres:postgres@localhost:${LOCAL_DB_PORT}/movers`;

// UTF-8 like Railway's Postgres. On Windows initdb otherwise picks WIN1252, which can't hold ₦.
const UTF8 = "ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0";

async function query(pg, db, sql, params) {
  const c = pg.getPgClient(db);
  await c.connect();
  try {
    return await c.query(sql, params);
  } finally {
    await c.end();
  }
}

/**
 * Databases made before the UTF-8 fix are copied into a new UTF-8 one, once. The old one is kept as
 * movers_win1252 in case anything is missing.
 */
async function moveToUtf8(pg) {
  const { rows } = await query(pg, 'postgres', "SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = 'movers'");
  if (!rows.length || rows[0].enc === 'UTF8') return;
  console.log('Moving the local database to UTF-8 (one time)…');
  await query(pg, 'postgres', 'ALTER DATABASE movers RENAME TO movers_win1252');
  await query(pg, 'postgres', `CREATE DATABASE movers ${UTF8}`);
  execSync('npm run migrate -w apps/api', { cwd: root, stdio: 'ignore', env: { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL } });

  const from = pg.getPgClient('movers_win1252');
  const to = pg.getPgClient('movers');
  await from.connect();
  await to.connect();
  try {
    await from.query("SET client_encoding = 'UTF8'");
    await to.query('SET session_replication_role = replica'); // skip foreign key order while copying
    const tables = (await from.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'")).rows.map((r) => r.tablename);
    for (const t of tables) {
      const json = new Set((await from.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND data_type IN ('json', 'jsonb')", [t])).rows.map((r) => r.column_name));
      const { rows: data } = await from.query(`SELECT * FROM "${t}"`);
      for (const row of data) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => (json.has(c) && row[c] != null ? JSON.stringify(row[c]) : row[c]));
        await to.query(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`, vals);
      }
    }
  } finally {
    await from.end();
    await to.end();
  }
  console.log('Done. The old copy is kept as the database movers_win1252.');
}

export async function startLocalDb() {
  const dir = path.join(root, '.pgdata');
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: LOCAL_DB_PORT, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {} });
  if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  const exists = (await query(pg, 'postgres', "SELECT 1 FROM pg_database WHERE datname = 'movers'")).rows.length;
  if (!exists) await query(pg, 'postgres', `CREATE DATABASE movers ${UTF8}`);
  else await moveToUtf8(pg);
  return pg;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pg = await startLocalDb();
  console.log(`Local Postgres is running: ${LOCAL_DATABASE_URL}\nPress Ctrl+C to stop it.`);
  const stop = () => pg.stop().finally(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
