import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLines, type Line } from "@/lib/import/statement";

// Estructura de un resumen real de Cencosud (posiciones de unpdf), con datos inventados.
let y = 1000;
const L = (...items: [number, string][]): Line => {
  y -= 20;
  const its = items.map(([x, str]) => ({ x, str, w: str.length * 5 }));
  return { y, items: its, text: its.map((i) => i.str).join(" ") };
};

const lines: Line[] = [
  L([40, "CENCOSUD S.A."], [300, "N° CUIT 30-59036076-3"]),
  L([40, "Este es el resumen de tu tarjeta finalizada en 1234 al día"], [316, "29/10/2026."]),
  L([42, "VENCIMIENTO"], [203, "11/11/2026"], [315, "PLAZO EXTRA"], [475, "19/11/2026"]),
  L([42, "Pago mínimo"], [220, "$ 100.000,00"], [315, "Pago mínimo"], [493, "$ 101.000,00"]),
  L([42, "Saldo en pesos"], [212, "$ 400.000,50"], [315, "Saldo en pesos"], [485, "$ 410.000,00"]),
  L([42, "Saldo en dólares"]),
  L([236, "U$D 12,34"]),
  // Recuadro de la página 1: mismos títulos que las secciones, pero con monto (no se importa)
  L([315, "Cargos y comisiones"], [457, "$ 5.000,00"]),
  L([315, "Intereses"], [453, "$ 7.000,00"]),
  L([315, "Impuestos"], [453, "$ 2.520,00"], [517, "U$D 0,00"]),
  L([40, "Te recordamos que tu próximo cierre será el día"], [298, "26/11/2026"], [360, "con vencimiento el"], [466, "04/12/2026"]),
  L([100, "SALDO ANTERIOR"], [417, "300.000,00"], [531, "0,00"]),
  L([40, "07/10/2026"], [100, "SU PAGO"], [421, "-200.000,00"]),
  L([100, "TOTAL MES ANTERIOR"]),
  L([40, "CONSUMOS"]),
  L([40, "00269"], [85, "04/03/2026"], [160, "PR.FINANCIACION"], [262, "TNA 86,96%"], [350, "08/12"], [425, "50.000,00"]),
  L([85, "04/03/2026"], [160, "INTERESES"], [350, "08/12"], [425, "20.000,00"]),
  L([85, "04/03/2026"], [160, "SEGURO AP"], [436, "3.000,00"]),
  L([160, "TOTAL TITULAR PERSONA DE PRUEBA"], [416, "$ 73.000,00"], [509, "U$D 0,00"]),
  L([40, "07918"], [85, "09/10/2026"], [160, "DLO*RAPPI"], [436, "7.820,00"]),
  L([40, "02121"], [85, "10/10/2026"], [160, "DLO*DIDI"], [436, "4.600,00"]),
  L([40, "00070"], [85, "16/10/2026"], [160, "MERPAGO*DIA"], [436, "25.700,00"]),
  L([160, "TOTAL CONSUMOS"], [416, "$ 111.120,00"], [509, "U$D 0,00"]),
  L([40, "CARGOS Y COMISIONES"]),
  L([40, "COMIS MENSUAL ADMINIST. DE CUENTA"], [436, "5.000,00"]),
  L([40, "TOTAL CARGOS"], [427, "$ 5.000,00"], [509, "U$D 0,00"]),
  L([40, "INTERESES"]),
  L([40, "INTERESES DE FINANCIACION"], [431, "7.000,00"]),
  L([40, "TOTAL INTERESES"], [422, "$ 7.000,00"]),
  L([40, "IMPUESTOS"]),
  L([40, "I.V.A. 21,0%"], [431, "2.520,00"]),
  L([40, "TOTAL IMPUESTOS"], [422, "$ 2.520,00"], [509, "U$D 0,00"]),
  L([267, "FIN DEL DETALLE"]),
  L([50, "precios en dólares al tipo de cambio del Banco de la Nación Argentina"]),
];

const r = parseLines(lines);
const find = (d: string) => r.rows.find((x) => x.description === d);

test("datos del resumen", () => {
  assert.equal(r.bank, "cencosud");
  assert.equal(r.close_date, "2026-10-29");
  assert.equal(r.due_date, "2026-11-11");
  assert.equal(r.next_close_date, "2026-11-26");
  assert.equal(r.balance_ars, "400000.50");
  assert.equal(r.balance_usd, "12.34");
  assert.equal(r.min_payment, "100000.00");
});

test("consumos con cupón antes de la fecha", () => {
  assert.equal(find("DLO*RAPPI")?.amount, "7820.00");
  assert.equal(find("DLO*RAPPI")?.date, "2026-10-09");
  assert.equal(find("DLO*RAPPI")?.suggested_category, "resto");
  assert.equal(find("DLO*DIDI")?.suggested_category, "transp");
  assert.equal(find("MERPAGO*DIA")?.suggested_category, "super");
});

test("cuotas 'NN/NN' sueltas, sin la tasa en el nombre y con la fecha de cierre", () => {
  const f = find("PR.FINANCIACION");
  assert.deepEqual(f?.installment, { n: 8, of: 12 });
  assert.equal(f?.kind, "installment");
  assert.equal(f?.date, "2026-10-29");
  assert.deepEqual(find("INTERESES")?.installment, { n: 8, of: 12 });
});

test("cargo de un plan con fecha vieja va al cierre", () => {
  assert.equal(find("SEGURO AP")?.date, "2026-10-29");
  assert.equal(find("SEGURO AP")?.kind, "fee");
});

test("cargos, intereses e impuestos sin fecha (una sola vez, no el recuadro)", () => {
  assert.equal(find("COMIS MENSUAL ADMINIST. DE CUENTA")?.amount, "5000.00");
  assert.equal(find("INTERESES DE FINANCIACION")?.amount, "7000.00");
  assert.equal(find("I.V.A. 21,0%")?.kind, "tax");
  assert.equal(r.rows.filter((x) => x.amount === "5000.00").length, 1);
});

test("el pago es pago y el total cierra", () => {
  assert.equal(find("SU PAGO")?.kind, "payment");
  const total = r.rows.filter((x) => x.kind !== "payment").reduce((s, x) => s + Number(x.amount), 0);
  assert.equal(Math.round(total * 100) / 100, 73000 + 38120 + 5000 + 7000 + 2520);
});
