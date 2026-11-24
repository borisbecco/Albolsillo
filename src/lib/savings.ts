import { z } from "zod";
import type { Goal, Investment } from "@prisma/client";

// Metas e inversiones: esquemas y formas de la API.

const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Revisá el monto");
export const positive = money.refine((v) => Number(v) > 0, "Ingresá un monto");

export const GoalFields = z.object({
  name: z.string().trim().min(1, "Completá nombre y monto").max(60),
  icon: z.string().regex(/^[a-z_]{2,40}$/).default("savings"),
  target: positive,
  currency: z.enum(["ARS", "USD"]),
  due_month: z.string().regex(/^\d{4}-\d{2}$/, "Revisá la fecha objetivo").nullable(),
});

export const InvestmentFields = z.object({
  kind: z.enum(["pf", "fci", "usd"]),
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  amount: positive,
  currency: z.enum(["ARS", "USD"]),
  tna: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Revisá la TNA").nullable(),
  start_date: z.iso.date(),
  days: z.number().int().min(1).max(3650).nullable(),
  account_id: z.uuid("Elegí de qué cuenta sale"),
});

export function goalDto(g: Goal) {
  return {
    id: g.id,
    name: g.name,
    icon: g.icon,
    target: g.target.toFixed(2),
    saved: g.saved.toFixed(2),
    currency: g.currency,
    due_month: g.dueMonth,
    completed_at: g.completedAt?.toISOString() ?? null,
  };
}

export function investmentDto(i: Investment) {
  return {
    id: i.id,
    kind: i.kind,
    name: i.name,
    amount: i.amount.toFixed(2),
    currency: i.currency,
    tna: i.tna?.toFixed(2) ?? null,
    start_date: i.startDate.toISOString().slice(0, 10),
    days: i.days,
    account_id: i.accountId,
    closed_at: i.closedAt?.toISOString() ?? null,
  };
}

export type GoalDto = ReturnType<typeof goalDto>;
export type InvestmentDto = ReturnType<typeof investmentDto>;
