// Categorías fijas de v1 (valores tomados del prototipo).
import { PrismaClient, type CategoryKind, type TxType } from "@prisma/client";

const prisma = new PrismaClient();

type Cat = [id: string, name: string, type: TxType, kind: CategoryKind, icon: string, hue: number, budget: number | null];

const CATEGORIES: Cat[] = [
  ["super", "Supermercado", "out", "var", "shopping_cart", 150, 420000],
  ["resto", "Comida afuera", "out", "var", "restaurant", 35, 150000],
  ["transp", "Transporte", "out", "var", "directions_car", 245, 90000],
  ["hogar", "Hogar", "out", "var", "chair", 70, 80000],
  ["salud", "Salud", "out", "var", "favorite", 350, 60000],
  ["ocio", "Ocio", "out", "var", "movie", 295, 100000],
  ["ropa", "Ropa", "out", "var", "checkroom", 200, 70000],
  ["servicios", "Servicios", "out", "fix", "bolt", 100, 150000],
  ["alquiler", "Alquiler y expensas", "out", "fix", "apartment", 20, 750000],
  ["subs", "Suscripciones", "out", "fix", "autorenew", 320, 60000],
  ["impuestos", "Impuestos", "out", "fix", "account_balance", 0, 100000],
  ["otros", "Otros", "out", "var", "category", 220, 50000],
  ["sueldo", "Sueldo", "in", "fix", "payments", 155, null],
  ["freelance", "Freelance", "in", "var", "work", 185, null],
  ["otros_in", "Otros ingresos", "in", "var", "savings", 120, null],
  ["prestamo", "Préstamos", "out", "fix", "credit_card", 270, null],
];

async function main() {
  for (const [id, name, type, kind, icon, hue, budget] of CATEGORIES) {
    const data = { name, type, kind, icon, hue, defaultBudget: budget };
    await prisma.category.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  console.log(`Categorías: ${CATEGORIES.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
