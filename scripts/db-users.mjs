// Lista las cuentas de producción (solo lectura).
//   npm run db:users            → emails tapados a medias
//   npm run db:users -- --full  → emails completos
//   npm run db:users -- --dev   → la base de desarrollo
import { PrismaClient } from "@prisma/client";

const useDev = process.argv.includes("--dev");
const full = process.argv.includes("--full");
const url = (useDev ? process.env.DATABASE_URL : process.env.PROD_DATABASE_URL || process.env.DATABASE_URL) ?? "";
if (!url) {
  console.error("Falta PROD_DATABASE_URL (o DATABASE_URL) en .env");
  process.exit(1);
}
const db = new PrismaClient({ datasourceUrl: url });
const mask = (e) => {
  if (full) return e;
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}***@${d}`;
};
const ar = (d) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }).format(d);

try {
  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { name: true, email: true, createdAt: true, onboardedAt: true, invitedById: true, _count: { select: { transactions: true, accounts: true, cards: true } } },
  });
  const deleted = await db.user.count({ where: { deletedAt: { not: null } } });
  const since = Date.now() - 7 * 86_400_000;
  console.log(`${useDev ? "Desarrollo" : "Producción"} (${new URL(url).host})`);
  console.log(`Cuentas activas: ${users.length} · nuevas en 7 días: ${users.filter((u) => u.createdAt.getTime() > since).length} · borradas: ${deleted}\n`);
  for (const u of users) {
    const c = u._count;
    console.log(
      `${ar(u.createdAt)} · ${u.name} · ${mask(u.email)} · ${u.onboardedAt ? "configuró" : "sin configurar"} · ${c.transactions} mov. · ${c.accounts} cuentas · ${c.cards} tarjetas${u.invitedById ? " · invitado" : ""}`,
    );
  }
} finally {
  await db.$disconnect();
}
