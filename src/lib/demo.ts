// Caso de ejemplo para el recorrido guiado de un usuario nuevo: sin esto, el recorrido señala
// partes de la pantalla que todavía no existen (saldo, movimientos, plan). Solo vive en memoria
// mientras dura el recorrido: no se guarda ni se manda al servidor.

import type { AccountDto, CardDto, TxDto } from "@/lib/dto";

const pad = (n: number) => String(n).padStart(2, "0");

export function demoData(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const cur = today.slice(0, 7);
  const lastDay = new Date(y, m, 0).getDate();
  // Días del mes que ya pasaron (los gastos de ejemplo no pueden ser del futuro).
  const at = (day: number) => `${cur}-${pad(Math.max(1, Math.min(day, d)))}`;
  const dueSoon = Math.min(lastDay, d + 4);
  const dueLater = Math.min(lastDay, d + 12);

  const accounts: AccountDto[] = [
    { id: "demo-acc-1", name: "Galicia", kind: "banco", currency: "ARS", balance: "854300.00" },
    { id: "demo-acc-2", name: "Mercado Pago", kind: "billetera", currency: "ARS", balance: "126500.00" },
  ];

  const card = (id: string, name: string, bank: CardDto["bank"], network: CardDto["network"], balance: number, min: number, due: number, tna: number): CardDto => ({
    id,
    name,
    bank,
    network,
    last4: id.endsWith("1") ? "4821" : "1093",
    balance: balance.toFixed(2),
    balance_usd: "0.00",
    cycle_paid: "0.00",
    cycle_paid_usd: "0.00",
    cycle_start: null,
    min_payment: min.toFixed(2),
    close_day: Math.max(1, due - 8),
    due_day: due,
    tna: tna.toFixed(2),
  });
  const cards: CardDto[] = [
    card("demo-card-1", "Visa Galicia", "galicia", "visa", 420000, 63000, dueSoon, 85),
    card("demo-card-2", "Mastercard Santander", "santander", "master", 185000, 27750, dueLater, 79),
  ];

  let n = 0;
  const tx = (date: string, description: string, category_id: string, amount: number, o: Partial<TxDto> = {}): TxDto & { status: "synced" } => ({
    id: `demo-tx-${++n}`,
    type: "out",
    date,
    description,
    category_id,
    amount: amount.toFixed(2),
    gross_amount: amount.toFixed(2),
    currency: "ARS",
    account_id: "demo-acc-1",
    card_id: null,
    recurring: false,
    bill_id: null,
    imported: false,
    shared_expense_id: null,
    merchant_domain: null,
    source: "manual",
    loan_id: null,
    installment_id: null,
    installment_number: null,
    updated_at: new Date().toISOString(),
    ...o,
    status: "synced",
  });

  const transactions = [
    tx(at(1), "Sueldo", "sueldo", 1500000, { type: "in" }),
    tx(at(2), "Coto", "super", 48300, { merchant_domain: "coto.com.ar" }),
    tx(at(3), "Netflix", "subs", 9000, { card_id: "demo-card-1", account_id: null, recurring: true, merchant_domain: "netflix.com" }),
    tx(at(4), "Edenor", "servicios", 22400, { merchant_domain: "edenor.com" }),
    tx(at(6), "Rappi", "resto", 12400, { account_id: "demo-acc-2", merchant_domain: "rappi.com.ar" }),
    tx(at(7), "Uber", "transp", 6800, { account_id: "demo-acc-2", merchant_domain: "uber.com" }),
    tx(at(9), "Farmacity", "salud", 15600, { card_id: "demo-card-2", account_id: null, merchant_domain: "farmacity.com" }),
    tx(at(11), "Jumbo", "super", 61200, { card_id: "demo-card-1", account_id: null, merchant_domain: "jumbo.com.ar" }),
    tx(at(13), "Cine", "ocio", 14000, { account_id: "demo-acc-2" }),
    tx(at(d), "Café", "resto", 4200, { account_id: "demo-acc-2" }),
    // Mes pasado, para la comparación del saldo
    tx(`${prev}-01`, "Sueldo", "sueldo", 1450000, { type: "in" }),
    tx(`${prev}-03`, "Coto", "super", 52100, { merchant_domain: "coto.com.ar" }),
    tx(`${prev}-03`, "Netflix", "subs", 9000, { card_id: "demo-card-1", account_id: null, recurring: true, merchant_domain: "netflix.com" }),
    tx(`${prev}-10`, "Rappi", "resto", 23800, { account_id: "demo-acc-2", merchant_domain: "rappi.com.ar" }),
    tx(`${prev}-18`, "Uber", "transp", 9400, { account_id: "demo-acc-2", merchant_domain: "uber.com" }),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { accounts, cards, transactions };
}
