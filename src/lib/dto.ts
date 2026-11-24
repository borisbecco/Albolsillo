import type { Account, Bill, Card, CardInstallment, Person, Transaction } from "@prisma/client";

// Formas que devuelve la API (snake_case, montos como string decimal, fechas YYYY-MM-DD).

const day = (d: Date) => d.toISOString().slice(0, 10);

export function txDto(t: Transaction) {
  return {
    id: t.id,
    type: t.type,
    date: day(t.date),
    description: t.description,
    category_id: t.categoryId,
    amount: t.amount.toFixed(2),
    gross_amount: t.grossAmount.toFixed(2),
    currency: t.currency,
    account_id: t.accountId,
    card_id: t.cardId,
    recurring: t.recurring,
    bill_id: t.billId,
    imported: t.imported,
    shared_expense_id: t.sharedExpenseId,
    merchant_domain: t.merchantDomain,
    source: t.source,
    loan_id: t.loanId,
    installment_id: t.installmentId,
    installment_number: t.installmentNumber,
    updated_at: t.updatedAt.toISOString(),
  };
}

export function accountDto(a: Account) {
  return { id: a.id, name: a.name, kind: a.kind, currency: a.currency, balance: a.balance.toFixed(2) };
}

export function cardDto(c: Card) {
  return {
    id: c.id,
    name: c.name,
    bank: c.bank,
    network: c.network,
    last4: c.last4,
    balance: c.balance.toFixed(2),
    balance_usd: c.balanceUsd.toFixed(2),
    cycle_paid: c.cyclePaid.toFixed(2),
    cycle_paid_usd: c.cyclePaidUsd.toFixed(2),
    cycle_start: c.cycleStart ? c.cycleStart.toISOString().slice(0, 10) : null,
    min_payment: c.minPayment.toFixed(2),
    close_day: c.closeDay,
    due_day: c.dueDay,
    tna: c.tna.toFixed(2),
  };
}

export function billDto(b: Bill) {
  return {
    id: b.id,
    name: b.name,
    category_id: b.categoryId,
    amount: b.amount.toFixed(2),
    currency: b.currency,
    due_day: b.dueDay,
    auto_debit: b.autoDebit,
    recurring: b.recurring,
    card_id: b.cardId,
    account_id: b.accountId,
  };
}

export function personDto(p: Person) {
  return { id: p.id, name: p.name, email: p.email, status: p.status };
}

export type TxDto = ReturnType<typeof txDto>;
export type AccountDto = ReturnType<typeof accountDto>;
export type CardDto = ReturnType<typeof cardDto>;
export type PersonDto = ReturnType<typeof personDto>;
export type BillDto = ReturnType<typeof billDto>;

export function installmentDto(i: CardInstallment) {
  return { id: i.id, card_id: i.cardId, name: i.name, n: i.n, of: i.of, amount: i.amount.toFixed(2), first_transaction_id: i.firstTransactionId };
}
export type InstallmentDto = ReturnType<typeof installmentDto>;
