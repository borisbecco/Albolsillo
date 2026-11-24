import type { SharedExpense } from "@prisma/client";

// Gastos compartidos: forma de la API y cálculo de saldos con cada persona.

export function sharedDto(s: SharedExpense) {
  return {
    id: s.id,
    kind: s.kind,
    description: s.description,
    date: s.date.toISOString().slice(0, 10),
    category_id: s.categoryId,
    total: s.total.toFixed(2),
    currency: s.currency,
    paid_by: s.paidBy,
    participants: s.participants,
    settle_person_id: s.settlePersonId,
    settle_amount: s.settleAmount?.toFixed(2) ?? null,
  };
}

export type SharedDto = ReturnType<typeof sharedDto>;

type SharedLike = Pick<SharedDto, "kind" | "total" | "paid_by" | "participants" | "settle_person_id" | "settle_amount" | "currency">;

/**
 * Saldo con cada persona, desde el lado del usuario: > 0 te debe, < 0 le debés.
 * - Si pagó el usuario, cada participante le debe su parte.
 * - Si pagó otra persona y el usuario participa, el usuario le debe su parte.
 * - Una liquidación (settle_amount > 0: la persona le pagó al usuario) descuenta del saldo.
 * `toArs` convierte a pesos para sumar gastos en distintas monedas.
 */
export function balances(list: SharedLike[], toArs: (n: number, c: "ARS" | "USD") => number = (n) => n) {
  const bal: Record<string, number> = {};
  const add = (id: string, v: number) => (bal[id] = (bal[id] ?? 0) + v);
  for (const e of list) {
    if (e.kind === "settlement") {
      if (e.settle_person_id && e.settle_amount) add(e.settle_person_id, -toArs(Number(e.settle_amount), e.currency));
      continue;
    }
    const share = toArs(Number(e.total), e.currency) / Math.max(1, e.participants.length);
    if (e.paid_by === "me") {
      for (const p of e.participants) if (p !== "me") add(p, share);
    } else if (e.participants.includes("me")) {
      add(e.paid_by, -share);
    }
  }
  return bal;
}
