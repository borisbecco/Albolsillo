import { z } from "zod";
import { CATEGORY_BY_ID } from "@/lib/categories";

// Esquemas compartidos por las rutas de tarjetas y gastos fijos.

export const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Revisá los montos");
export const day = z.number().int().min(1, "El día va de 1 a 31").max(31, "El día va de 1 a 31");
export const month = z.string().regex(/^\d{4}-\d{2}$/, "Revisá el mes");

export const CardFields = z.object({
  name: z.string().trim().min(1, "Poné un nombre a la tarjeta").max(60),
  balance: money,
  /** Saldo en dólares del resumen vigente */
  balance_usd: money.optional(),
  min_payment: money,
  due_day: day,
  close_day: day,
  tna: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Revisá la TNA"),
  last4: z.string().regex(/^\d{4}$/, "Los últimos 4 son 4 números").nullable(),
});

const positive = money.refine((v) => Number(v) > 0, "Poné el monto");

export const BillFields = z.object({
  name: z.string().trim().min(1, "Poné un nombre al gasto fijo").max(80),
  amount: positive,
  currency: z.enum(["ARS", "USD"]),
  due_day: day,
  category_id: z.string().refine((id) => CATEGORY_BY_ID[id]?.type === "out", "Revisá la categoría"),
  auto_debit: z.boolean(),
  account_id: z.uuid().nullable(),
  card_id: z.uuid().nullable(),
});
