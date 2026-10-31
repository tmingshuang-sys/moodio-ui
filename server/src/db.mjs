// Postgres 连接与迁移。本机开发用 docker compose 起的库，线上用阿里云 RDS，连接串都从 DATABASE_URL 来。
import postgres from 'postgres';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(HERE, '..', 'db');

let sql = null;
export function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('没有配置 DATABASE_URL');
    sql = postgres(url, { max: 10, idle_timeout: 30, onnotice: () => {} });
  }
  return sql;
}
export const hasDb = () => !!process.env.DATABASE_URL;

export async function migrate() {
  const s = db();
  await s`create table if not exists migrations (name text primary key, run_at timestamptz not null default now())`;
  const done = new Set((await s`select name from migrations`).map(r => r.name));
  const files = (await fs.readdir(DB_DIR)).filter(f => f.endsWith('.sql')).sort();
  let n = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const text = await fs.readFile(path.join(DB_DIR, f), 'utf8');
    await s.begin(async t => {
      await t.unsafe(text);
      await t`insert into migrations (name) values (${f})`;
    });
    console.log('migrate:', f);
    n++;
  }
  return { ran: n, total: files.length };
}

export async function closeDb() { if (sql) { await sql.end({ timeout: 5 }); sql = null; } }
