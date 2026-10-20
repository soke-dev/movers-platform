// `npm run dev`: everything on your computer in one go. Starts the local database, creates the
// .env files the first time, updates the tables, adds the starting data, then runs the API and
// the three websites. Ctrl+C stops it all.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startLocalDb, LOCAL_DATABASE_URL } from './local-db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Local values on top of each app's .env.example. Only used when the .env doesn't exist yet.
const LOCAL = {
  api: {
    DATABASE_URL: LOCAL_DATABASE_URL,
    JWT_SECRET: 'local-dev-secret',
    ADMIN_EMAIL: 'admin@movers.local',
    ADMIN_PASSWORD: 'movers-admin',
    ADMIN_NAME: 'Local Admin'
  },
  learn: {},
  space: {},
  admin: {}
};

function ensureEnv(app) {
  const file = path.join(root, 'apps', app, '.env');
  if (fs.existsSync(file)) return false;
  let text = fs.readFileSync(path.join(root, 'apps', app, '.env.example'), 'utf8');
  for (const [k, v] of Object.entries(LOCAL[app])) {
    const line = `${k}=${v}`;
    text = new RegExp(`^${k}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${k}=.*$`, 'm'), line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(file, text);
  return true;
}

const run = (cmd) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, { cwd: root, shell: true, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`"${cmd}" failed`))));
  });

const created = Object.keys(LOCAL).filter(ensureEnv);
if (created.length) console.log(`Created .env for ${created.join(', ')} with local settings.`);

console.log('Starting the local database…');
const pg = await startLocalDb();
await run('npm run migrate -w apps/api');
await run('npm run seed -w apps/api');

const COLORS = { api: 35, learn: 33, space: 34, admin: 32 };
const children = Object.keys(COLORS).map((app) => {
  const p = spawn(`npm run dev -w apps/${app}`, { cwd: root, shell: true, env: { ...process.env, FORCE_COLOR: '1' } });
  const tag = `\x1b[${COLORS[app]}m${app.padEnd(5)}\x1b[0m │ `;
  const out = (stream) => stream.on('data', (d) => process.stdout.write(String(d).replace(/^(?=.)/gm, tag)));
  out(p.stdout);
  out(p.stderr);
  return p;
});

console.log(`
  API     http://localhost:4000
  Learn   http://localhost:5173
  Space   http://localhost:5174
  Admin   http://localhost:5175   (log in with ADMIN_EMAIL and ADMIN_PASSWORD from apps/api/.env)
  Emails  http://localhost:4000/auth/dev-outbox
`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(c.pid), '/t', '/f']);
    else c.kill('SIGTERM');
  }
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
