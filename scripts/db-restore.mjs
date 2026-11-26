// Restaura un backup de scripts/db-backup.mjs en la base de DATABASE_URL. BORRA lo que haya en esa base.
//   npm run db:restore -- backups/albolsillo-20261125-1530.json.gz --confirm=<host de la base>
// El --confirm tiene que ser el host exacto de DATABASE_URL (se muestra si falta), para no pisar otra base por error.
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const confirm = process.argv.find((a) => a.startsWith("--confirm="))?.slice("--confirm=".length);
const url = process.env.DATABASE_URL ?? "";
if (!file || !url) {
  console.error("Uso: npm run db:restore -- <archivo.json.gz> --confirm=<host>   (usa DATABASE_URL de .env)");
  process.exit(1);
}
const host = new URL(url).host;
if (confirm !== host) {
  console.error(`Esto BORRA todo en ${host} y carga el backup. Para seguir, agregá --confirm=${host}`);
  process.exit(1);
}
// Mientras no esté separada la base de producción, no se restaura nada (DATABASE_URL podría ser producción).
if (!process.env.PROD_DATABASE_URL) {
  console.error("Primero separá las bases: PROD_DATABASE_URL = producción y DATABASE_URL = desarrollo (ver README › Bases de datos).");
  process.exit(1);
}
if (new URL(process.env.PROD_DATABASE_URL).host === host && !process.argv.includes("--prod")) {
  console.error(`${host} es la base de producción (PROD_DATABASE_URL). Si de verdad querés restaurarla, agregá también --prod`);
  process.exit(1);
}

const backup = JSON.parse(gunzipSync(await readFile(file)).toString());
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  const tables = (
    await db.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`)
  ).map((r) => r.table_name);
  const missing = Object.keys(backup.tables).filter((t) => !tables.includes(t));
  if (missing.length) throw new Error(`La base no tiene estas tablas (¿faltan migraciones?): ${missing.join(", ")}`);

  let rows = 0;
  await db.$transaction(
    async (tx) => {
      // Sin chequear claves foráneas mientras se carga (el orden de las tablas no importa).
      await tx.$executeRawUnsafe(`set local session_replication_role = replica`);
      await tx.$executeRawUnsafe(`truncate ${tables.map((t) => `"${t}"`).join(", ")} cascade`);
      for (const [t, list] of Object.entries(backup.tables)) {
        if (!list.length) continue;
        await tx.$executeRawUnsafe(`insert into "${t}" select * from json_populate_recordset(null::"${t}", $1::json)`, JSON.stringify(list));
        rows += list.length;
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  console.log(`Restaurado en ${host}: ${rows} filas del backup de ${backup.host} (${backup.created_at})`);
} finally {
  await db.$disconnect();
}
