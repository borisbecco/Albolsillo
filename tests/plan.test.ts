import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlan, monthTotals } from "@/lib/plan";

const card = { id: "c", name: "Cencosud", balance: 2266857, min: 685760, dueDay: 11, tna: 79 };
const base = { income: 2450000, spent: 1772248, pendingFixed: 0, reserve: 913960, strategy: "avalancha" as const };

test("mínimo ya pagado y gastos por encima del ingreso: 'Mínimo cubierto', sin 'faltan para los mínimos'", () => {
  const p = computePlan({ ...base, cards: [{ ...card, paid: 700000 }] });
  assert.equal(p.short, false);
  assert.equal(Math.round(p.over), 936208);
  assert.equal(p.paid, 700000);
  assert.equal(p.rows[0].tag, "Mínimo cubierto");
  assert.equal(p.rows[0].pay, 0);
});

test("sin pagar y sin plata: faltan para los mínimos", () => {
  const p = computePlan({ ...base, cards: [{ ...card, paid: 0 }] });
  assert.equal(p.short, true);
  assert.equal(p.rows[0].tag, "Mínimo");
  assert.equal(p.rows[0].pay, 685760);
});

test("con plata alcanza para el total", () => {
  const p = computePlan({ ...base, income: 5000000, cards: [{ ...card, paid: 700000 }] });
  assert.equal(p.over, 0);
  assert.equal(p.rows[0].tag, "Pago total");
  assert.equal(Math.round(p.rows[0].pay), 1566857);
});

test("tarjeta pagada completa queda 'Pagado'", () => {
  const p = computePlan({ ...base, income: 5000000, cards: [{ ...card, paid: card.balance }] });
  assert.equal(p.rows[0].tag, "Pagado");
  assert.equal(p.rows[0].done, true);
});

test("avalancha paga primero la de mayor tasa", () => {
  const p = computePlan({
    income: 1000000,
    spent: 0,
    pendingFixed: 0,
    cards: [
      { id: "a", name: "A", balance: 500000, min: 50000, dueDay: 5, tna: 40 },
      { id: "b", name: "B", balance: 500000, min: 50000, dueDay: 20, tna: 90 },
    ],
    strategy: "avalancha",
  });
  assert.equal(p.rows[0].id, "b");
  assert.equal(p.rows[0].tag, "Pago total");
});

test("monthTotals no cuenta los pagos de tarjeta como gasto", () => {
  const t = monthTotals(
    [
      { type: "out", date: "2026-11-02", category_id: "super", amount: "1000", currency: "ARS" },
      { type: "card_payment", date: "2026-11-03", category_id: "otros", amount: "700000", currency: "ARS" },
      { type: "in", date: "2026-11-01", category_id: "sueldo", amount: "500", currency: "USD" },
      { type: "out", date: "2026-10-30", category_id: "super", amount: "999", currency: "ARS" },
    ],
    "2026-11",
    (n, c) => (c === "USD" ? n * 1000 : n),
  );
  assert.equal(t.out, 1000);
  assert.equal(t.inc, 500000);
  assert.deepEqual(t.byCat, { super: 1000 });
});
