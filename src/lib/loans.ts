import type { Loan } from "@prisma/client";
import { z } from "zod";

const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Revisá los montos");

export const LoanFields = z.object({
  /** Banco o billetera (de la lista o libre) */
  lender: z.string().trim().max(60).nullable().optional(),
  name: z.string().trim().min(1, "Poné un nombre al préstamo").max(60),
  installment: money.refine((v) => Number(v) > 0, "Poné el valor de la cuota"),
  due_day: z.number().int().min(1, "El día va de 1 a 31").max(31, "El día va de 1 a 31"),
  /** Cuotas ya pagadas */
  n: z.number().int().min(0).max(600),
  of: z.number().int().min(1, "Poné la cantidad de cuotas").max(600),
  tna: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Revisá la TNA"),
  balance: money,
  /** La cuota de este mes ya está paga (al cargar un préstamo que venías pagando por fuera de la app) */
  paid_this_month: z.boolean().optional(),
});

export function loanDto(l: Loan) {
  return {
    id: l.id,
    lender: l.lender,
    name: l.name,
    installment: l.installment.toFixed(2),
    due_day: l.dueDay,
    n: l.n,
    of: l.of,
    tna: l.tna.toFixed(2),
    balance: l.balance.toFixed(2),
    last_paid_month: l.lastPaidMonth,
  };
}

export type LoanDto = ReturnType<typeof loanDto>;
