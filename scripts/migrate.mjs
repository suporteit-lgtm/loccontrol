// Aplica as migrations de supabase/migrations em ordem, registrando em _migrations.
// Uso:  npm run db:migrate      (aplica todas as pendentes, incluindo o seed)
// Requer DATABASE_URL no .env (connection string do Supabase).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL não definida. Copie .env.example para .env e preencha.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const dir = path.join(process.cwd(), "supabase", "migrations");

try {
  await client.connect();
  await client.query(`create table if not exists _migrations (
    nome text primary key, aplicada_em timestamptz not null default now()
  )`);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("select nome from _migrations");
  const done = new Set(rows.map((r) => r.nome));

  let aplicadas = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(path.join(dir, f), "utf8");
    console.log(`→ aplicando ${f}...`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into _migrations (nome) values ($1)", [f]);
      await client.query("commit");
      aplicadas++;
    } catch (e) {
      await client.query("rollback");
      console.error(`✗ falha em ${f}:`, e.message);
      process.exit(1);
    }
  }
  console.log(aplicadas ? `✓ ${aplicadas} migration(s) aplicada(s).` : "✓ Nada a aplicar — banco em dia.");
} finally {
  await client.end();
}
