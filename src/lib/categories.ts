// Categorías fijas de v1 (valores del prototipo). Es la fuente de verdad: el seed las carga en la base
// y el cliente las usa directamente, sin pedirlas a la API.

export type CategoryType = "in" | "out";
export type CategoryKind = "fix" | "var";

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  kind: CategoryKind;
  icon: string;
  hue: number;
  budget: number | null;
};

export const CATEGORIES: Category[] = [
  { id: "super", name: "Supermercado", type: "out", kind: "var", icon: "shopping_cart", hue: 150, budget: 420000 },
  { id: "resto", name: "Comida afuera", type: "out", kind: "var", icon: "restaurant", hue: 35, budget: 150000 },
  { id: "transp", name: "Transporte", type: "out", kind: "var", icon: "directions_car", hue: 245, budget: 90000 },
  { id: "hogar", name: "Hogar", type: "out", kind: "var", icon: "chair", hue: 70, budget: 80000 },
  { id: "salud", name: "Salud", type: "out", kind: "var", icon: "favorite", hue: 350, budget: 60000 },
  { id: "ocio", name: "Ocio", type: "out", kind: "var", icon: "movie", hue: 295, budget: 100000 },
  // Viajes: sin límite sugerido (es un gasto ocasional; no suma a la reserva del mes salvo que le pongas uno).
  { id: "viajes", name: "Viajes", type: "out", kind: "var", icon: "flight", hue: 55, budget: null },
  { id: "ropa", name: "Ropa", type: "out", kind: "var", icon: "checkroom", hue: 200, budget: 70000 },
  { id: "servicios", name: "Servicios", type: "out", kind: "fix", icon: "bolt", hue: 100, budget: 150000 },
  { id: "alquiler", name: "Alquiler y expensas", type: "out", kind: "fix", icon: "apartment", hue: 20, budget: 750000 },
  { id: "subs", name: "Suscripciones", type: "out", kind: "fix", icon: "autorenew", hue: 320, budget: 60000 },
  { id: "impuestos", name: "Impuestos", type: "out", kind: "fix", icon: "account_balance", hue: 0, budget: 100000 },
  { id: "otros", name: "Otros", type: "out", kind: "var", icon: "category", hue: 220, budget: 50000 },
  { id: "sueldo", name: "Sueldo", type: "in", kind: "fix", icon: "payments", hue: 155, budget: null },
  { id: "freelance", name: "Freelance", type: "in", kind: "var", icon: "work", hue: 185, budget: null },
  { id: "otros_in", name: "Otros ingresos", type: "in", kind: "var", icon: "savings", hue: 120, budget: null },
  { id: "prestamo", name: "Préstamos", type: "out", kind: "fix", icon: "credit_card", hue: 270, budget: null },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, Category>;

/** Las que se ofrecen al cargar un movimiento ("prestamo" queda para los pagos de préstamos). */
export const pickableCategories = (type: CategoryType) => CATEGORIES.filter((c) => c.type === type && c.id !== "prestamo");

export const DEFAULT_CATEGORY: Record<CategoryType, string> = { out: "super", in: "sueldo" };

export const catColor = (id: string) => `oklch(0.76 0.15 ${CATEGORY_BY_ID[id]?.hue ?? 220})`;
export const catTint = (id: string) => `oklch(0.76 0.15 ${CATEGORY_BY_ID[id]?.hue ?? 220} / .14)`;
