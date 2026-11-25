import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingRecurring } from "@/lib/recurring";

const t = (id: string, date: string, description: string, o: object = {}) => ({
  id,
  type: "out" as const,
  date,
  description,
  category_id: "subs",
  amount: "9000",
  currency: "ARS" as const,
  account_id: null,
  card_id: null,
  recurring: true,
  bill_id: null,
  loan_id: null,
  installment_id: null,
  ...o,
});

const txs = [
  t("1", "2026-10-05", "Netflix"),
  t("2", "2026-10-20", "Gimnasio"),
  t("3", "2026-10-03", "Spotify"),
  t("4", "2026-11-03", "spotify"),
  t("5", "2026-08-01", "Viejo"),
  t("6", "2026-10-02", "Alquiler", { bill_id: "b" }),
  t("7", "2026-10-04", "Disney"),
  t("8", "2026-10-10", "Disney", { recurring: false }),
  t("9", "2026-10-01", "Sueldo", { type: "in", category_id: "sueldo" }),
];
const names = (today: string, skip?: (x: (typeof txs)[number]) => boolean) => pendingRecurring(txs, today, skip).map((d) => d.last.description);

test("aparecen los recurrentes que tocan y no están cargados", () => {
  assert.deepEqual(names("2026-11-25"), ["Sueldo", "Netflix", "Gimnasio"]);
});

test("no aparecen antes de su día", () => {
  assert.deepEqual(names("2026-11-10"), ["Sueldo", "Netflix"]);
});

test("se puede excluir una categoría (el sueldo tiene su propio aviso)", () => {
  assert.deepEqual(names("2026-11-25", (x) => x.category_id === "sueldo"), ["Netflix", "Gimnasio"]);
});

test("día 31 en un mes de 30 días: toca el último día", () => {
  const d = pendingRecurring([t("x", "2026-10-31", "Cuota club")], "2026-11-30");
  assert.equal(d[0]?.day, 30);
});
