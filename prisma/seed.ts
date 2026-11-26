// Carga las categorías fijas de v1 (definidas en src/lib/categories.ts).
import { createPrisma } from "../src/lib/db";
import { CATEGORIES } from "../src/lib/categories";

const prisma = createPrisma();

async function main() {
  for (const c of CATEGORIES) {
    const data = { name: c.name, type: c.type, kind: c.kind, icon: c.icon, hue: c.hue, defaultBudget: c.budget };
    await prisma.category.upsert({ where: { id: c.id }, update: data, create: { id: c.id, ...data } });
  }
  console.log(`Categorías: ${CATEGORIES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
