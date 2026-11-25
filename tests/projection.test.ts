import { test } from "node:test";
import assert from "node:assert/strict";
import { projectMonths, simulate, freeAfter } from "@/lib/projection";

const base = {
  month: "2026-11",
  freeNow: 400000,
  income: 2000000,
  billsMonthly: 600000,
  variableMonthly: 700000,
  loans: [{ name: "Préstamo", installment: 200000, n: 18, of: 24, paidThisMonth: true }],
  installments: [{ name: "Heladera", amount: 100000, n: 1, of: 3 }],
};

test("12 meses: préstamo y cuotas que siguen y terminan", () => {
  const ms = projectMonths(base);
  assert.equal(ms.length, 12);
  assert.equal(ms[0].free, 400000);
  assert.equal(ms[1].ym, "2026-12");
  assert.equal(ms[2].ym, "2027-01");
  // Diciembre: préstamo (19/24) + heladera (2/3)
  assert.equal(ms[1].free, 2000000 - 600000 - 200000 - 100000 - 700000);
  // La heladera termina en enero (3/3) y el préstamo en mayo (24/24)
  assert.deepEqual(ms[2].ends.map((e) => e.name), ["Heladera"]);
  assert.deepEqual(ms[6].ends.map((e) => e.name), ["Préstamo"]);
  // Desde junio ya no hay préstamo
  assert.equal(ms[7].loansA, 0);
});

test("préstamo con la cuota de este mes sin pagar arranca en la siguiente", () => {
  const ms = projectMonths({ ...base, loans: [{ name: "P", installment: 100, n: 23, of: 24, paidThisMonth: false }] });
  assert.equal(ms[0].loansA, 100);
  assert.deepEqual(ms[0].ends.map((e) => e.name), ["P"]);
  assert.equal(ms[1].loansA, 0);
});

test("veredictos y sugerencia de más cuotas", () => {
  const ms = projectMonths(base);
  assert.equal(simulate(ms, base.income, { amount: 0, cuotas: 6, surcharge: 0 }).verdict, "none");
  const ok = simulate(ms, base.income, { amount: 300000, cuotas: 6, surcharge: 0 });
  assert.equal(ok.verdict, "ok");
  assert.equal(ok.cuota, 50000);
  // Una compra grande en 1 cuota no entra este mes; en más cuotas sí.
  const no = simulate(ms, base.income, { amount: 1200000, cuotas: 1, surcharge: 0 });
  assert.equal(no.verdict, "no");
  assert.ok(no.better && no.better > 1, String(no.better));
  const w = no.worst!;
  assert.equal(freeAfter(w, no.cuota, 1), 400000 - 1200000);
});

test("recargo y meses que ya venían en rojo", () => {
  const ms = projectMonths({ ...base, freeNow: -50000 });
  const r = simulate(ms, base.income, { amount: 100000, cuotas: 3, surcharge: 20 });
  assert.equal(r.total, 120000);
  assert.equal(r.alreadyRed.length, 1);
  const pre = simulate(projectMonths({ ...base, freeNow: -1, income: 0 }), 0, { amount: 1000, cuotas: 1, surcharge: 0 });
  assert.equal(pre.verdict, "pre");
});
