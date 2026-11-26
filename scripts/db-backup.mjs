// Backup de la base: todas las tablas a un JSON comprimido en backups/ (no se sube a git).
// Sin pg_dump: usa Prisma y el propio Postgres (json_agg).
//   npm run db:backup                 → la base de PROD_DATABASE_URL (o DATABASE_URL si no está)
//   npm run db:backup -- --dev        → la de DATABASE_URL
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const useDev = process.argv.includes("--dev");
const url = (useDev ? process.env.DATABASE_URL : process.env.PROD_DATABASE_URL || process.env.DATABASE_URL) ?? "";
if (!url) {
  console.error("Falta DATABASE_URL (o PROD_DATABASE_URL) en .env");
  process.exit(1);
}
const host = new URL(url).host;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  const tables = (
    await db.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)
  ).map((r) => r.table_name);
  const data = {};
  let rows = 0;
  for (const t of tables) {
    const [{ j }] = await db.$queryRawUnsafe(`select coalesce(json_agg(x), '[]'::json) as j from "${t}" x`);
    data[t] = j;
    rows += j.length;
  }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `albolsillo-${stamp}.json.gz`);
  await writeFile(file, gzipSync(JSON.stringify({ created_at: new Date().toISOString(), host, tables: data })));
  console.log(`Backup de ${host}: ${tables.length} tablas, ${rows} filas → ${path.relative(process.cwd(), file)}`);
} finally {
  await db.$disconnect();
}
