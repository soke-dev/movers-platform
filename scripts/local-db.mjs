// A Postgres for local development, so you don't need to install one. The data lives in .pgdata/
// and is kept between runs. `npm run db:local` runs just the database; `npm run dev` starts it too.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCAL_DB_PORT = 54320;
export const LOCAL_DATABASE_URL = `postgresql://postgres:postgres@localhost:${LOCAL_DB_PORT}/movers`;

export async function startLocalDb() {
  const dir = path.join(root, '.pgdata');
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: LOCAL_DB_PORT, persistent: true, onLog: () => {} });
  if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  await pg.createDatabase('movers').catch(() => {}); // already there after the first run
  return pg;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pg = await startLocalDb();
  console.log(`Local Postgres is running: ${LOCAL_DATABASE_URL}\nPress Ctrl+C to stop it.`);
  const stop = () => pg.stop().finally(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
