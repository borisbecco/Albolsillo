// Tipos de los datos de la app (bootstrap, borradores y la API de useData).

import type { UserDto } from "@/lib/auth/session";
import type { AccountDto, BillDto, CardDto, InstallmentDto, PersonDto, TxDto } from "@/lib/dto";
import type { ParsedRow } from "@/lib/import/statement";
import type { GoalDto, InvestmentDto } from "@/lib/savings";
import type { SharedDto } from "@/lib/shared";
import type { LoanDto } from "@/lib/loans";
import type { DetectedDto } from "@/lib/auto/detected";
import type { Currency } from "@/lib/money";

export type Bootstrap = {
  user: UserDto;
  accounts: AccountDto[];
  cards: CardDto[];
  people: PersonDto[];
  transactions: TxDto[];
  bills: BillDto[];
  bill_payments: BillPayment[];
  budgets: BudgetRow[];
  goals: GoalDto[];
  investments: InvestmentDto[];
  shared: SharedDto[];
  installments: InstallmentDto[];
  loans: LoanDto[];
  detected: DetectedDto[];
  merchant_rules?: { key: string; category_id: string }[];
};

export type LoanDraft = { lender: string | null; name: string; installment: string; due_day: number; n: number; of: number; tna: string; balance: string; paid_this_month?: boolean };

export type ImportPreview = {
  import_id: string;
  bank: string | null;
  period: string | null;
  balance_ars: string | null;
  min_payment: string | null;
  due_date: string | null;
  /** learned: la categoría viene de una que elegiste antes para ese comercio. */
  rows: (ParsedRow & { duplicate: boolean; learned?: boolean })[];
};

export type SharedDraft = {
  description: string;
  date: string;
  category_id: string;
  total: string;
  currency: Currency;
  paid_by: string;
  participants: string[];
  account_id?: string | null;
  card_id?: string | null;
};

export type IpcRow = { month: string; value: number };
export type GoalDraft = { name: string; icon: string; target: string; currency: Currency; due_month: string | null };
export type InvestmentDraft = {
  kind: InvestmentDto["kind"];
  name: string;
  amount: string;
  currency: Currency;
  tna: string | null;
  start_date: string;
  days: number | null;
  account_id: string;
};

export type BudgetRow = { month: string; category_id: string; amount: string };

export type BillPayment = { bill_id: string; month: string; transaction_id: string | null };
export type CardDraft = { name: string; balance: string; balance_usd?: string; min_payment: string; due_day: number; close_day: number; tna: string; last4: string | null };
export type BillDraft = {
  name: string;
  amount: string;
  currency: Currency;
  due_day: number;
  category_id: string;
  auto_debit: boolean;
  account_id: string | null;
  card_id: string | null;
};

export type OnboardingDraft = {
  salary: string | null;
  payday: number | null;
  usd_income: string | null;
  salary_currency?: Currency;
  other_income_currency?: Currency;
  salary_account_id?: string | null;
  salary_bank?: string | null;
  other_income_account_id?: string | null;
  other_income_bank?: string | null;
  other_income_day?: number | null;
  strategy: UserDto["pay_strategy"];
  cards: { id?: string; name: string; balance: string; min_payment: string; due_day: number; tna: string; last4: string | null }[];
  bills: { id?: string; name: string; amount: string; currency: Currency; due_day: number; category_id: string }[];
};

export type TxStatus = "synced" | "pending" | "failed";
export type Tx = TxDto & { status: TxStatus };

export type TxDraft = {
  type: "in" | "out";
  date: string;
  description: string;
  category_id: string;
  amount: string; // decimal "1234.50"
  currency: Currency;
  account_id: string | null;
  card_id: string | null;
  recurring: boolean;
  /** Compra con tarjeta en cuotas (1 = un pago). */
  installments?: number;
};

export type CardPayDraft = { amount: string; account_id: string | null; currency: Currency };
export type StatementDraft = { balance: string; balance_usd: string; minimum: string; close_day: number; due_day: number };

export type FxQuote = { buy: string; sell: string; updated_at: string };
export type FxResponse = Partial<Record<"oficial" | "blue" | "bolsa" | "tarjeta", FxQuote>> & { stale: boolean };

export type Data = {
  transactions: Tx[];
  accounts: AccountDto[];
  cards: CardDto[];
  bills: BillDto[];
  people: PersonDto[];
  saveOnboarding: (d: OnboardingDraft | { skipped: true }) => Promise<boolean>;
  billPayments: BillPayment[];
  isBillPaid: (billId: string, month: string) => boolean;
  saveCard: (id: string | null, c: CardDraft) => Promise<boolean>;
  deleteCard: (id: string) => Promise<boolean>;
  saveBill: (id: string | null, b: BillDraft) => Promise<boolean>;
  deleteBill: (id: string) => Promise<boolean>;
  payBill: (billId: string, month: string) => Promise<boolean>;
  unpayBill: (billId: string, month: string) => Promise<boolean>;
  budgets: BudgetRow[];
  /** Límite de la categoría en el mes: el guardado o el predeterminado. */
  budgetFor: (month: string, categoryId: string) => { amount: number; custom: boolean };
  saveBudget: (month: string, categoryId: string, amount: string | null) => Promise<boolean>;
  goals: GoalDto[];
  saveGoal: (id: string | null, g: GoalDraft) => Promise<boolean>;
  deleteGoal: (id: string) => Promise<boolean>;
  contribute: (goalId: string, amount: string) => Promise<GoalDto | null>;
  investments: InvestmentDto[];
  createInvestment: (i: InvestmentDraft) => Promise<boolean>;
  closeInvestment: (id: string, amount: string) => Promise<AccountDto | null | false>;
  /** Inflación mensual (%) por mes, de la API de IPC. */
  ipc: IpcRow[];
  shared: SharedDto[];
  /** mailSent/link: si se invitó (con email), si salió el mail y el link para pasarlo a mano. */
  addPerson: (name: string, email: string | null) => Promise<{ person: PersonDto; mailSent: boolean | null; link: string | null } | null>;
  /** null si falló; si no, si salió el mail y el link para pasarlo a mano. */
  invitePerson: (id: string, email?: string) => Promise<{ mailSent: boolean; link: string } | null>;
  deletePerson: (id: string) => Promise<boolean>;
  addShared: (d: SharedDraft) => Promise<boolean>;
  deleteShared: (id: string) => Promise<boolean>;
  settle: (personId: string, amount: string) => Promise<boolean>;
  /** Altas que todavía no llegaron al servidor (pendientes o con error). */
  pendingCount: number;
  /** Reintenta todas las altas pendientes (al volver la conexión). */
  retryPending: () => Promise<number>;
  installments: InstallmentDto[];
  loans: LoanDto[];
  saveLoan: (id: string | null, l: LoanDraft) => Promise<boolean>;
  deleteLoan: (id: string) => Promise<boolean>;
  payLoan: (id: string, month: string, opts?: { amount?: string; account_id?: string | null }) => Promise<boolean>;
  unpayLoan: (id: string) => Promise<boolean>;
  importStatement: (cardId: string, file: File) => Promise<ImportPreview | null>;
  confirmImport: (importId: string, rowIds: string[], categories: Record<string, string>) => Promise<number | null>;
  startMonth: (d: { month: string; budget_mode: "keep" | "infl" | "spent"; budgets: { category_id: string; amount: number }[]; drop_bills: string[] }) => Promise<boolean>;
  /** Cotizaciones del día (null mientras carga). */
  fx: FxResponse | null;
  /** Pesos por dólar según la cotización elegida (null mientras carga). */
  rate: number | null;
  /** Convierte un monto a la moneda en que el usuario eligió ver los montos. */
  toDisplay: (amount: number, currency: Currency) => number;
  createTx: (d: TxDraft) => Promise<void>;
  updateTx: (id: string, d: Partial<TxDraft>) => Promise<boolean>;
  deleteTx: (id: string) => Promise<boolean>;
  /** Borra uno o varios movimientos y ofrece Deshacer durante unos segundos. */
  deleteTxs: (ids: string[]) => Promise<boolean>;
  /** Vuelve a pedir todos los datos al servidor (después de operaciones con varios efectos). */
  reload: () => Promise<void>;
  /** Gastos detectados pendientes de confirmar. */
  detected: DetectedDto[];
  confirmDetected: (ids: string[], learn: { id: string; category_id: string }[], edits: Record<string, { category_id?: string; account_id?: string | null }>) => Promise<{ count: number; learned: number } | null>;
  discardDetected: (id: string) => Promise<boolean>;
  /** Sube un comprobante (imagen o PDF) y lo agrega a la bandeja. */
  shareReceipt: (file: Blob, name?: string) => Promise<DetectedDto | null>;
  /** Registra el pago del resumen; devuelve el id del movimiento (para deshacer). */
  payCard: (cardId: string, p: CardPayDraft) => Promise<string | null>;
  voidTx: (txId: string) => Promise<boolean>;
  /** Carga el resumen nuevo; devuelve cuántas cuotas se sumaron como gasto. */
  loadStatement: (cardId: string, st: StatementDraft) => Promise<number | null>;
  /** El recorrido guiado está mostrando el caso de ejemplo (usuario sin nada cargado). */
  demo: boolean;
  /** Categoría sugerida para un comercio: la que elegiste antes o, si no, la de la lista. */
  suggestCategory: (description: string) => string | null;
  failed: Tx | null;
  retryFailed: () => void;
  dismissFailed: () => void;
  createAccount: (a: AccountDraft) => Promise<AccountDto | null>;
  updateAccount: (id: string, a: Partial<Omit<AccountDraft, "currency">>) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
  transfer: (t: TransferDraft) => Promise<boolean>;
};

export type AccountDraft = { name: string; kind: AccountDto["kind"]; currency: Currency; balance: string };
export type TransferDraft = { from_account_id: string; to_account_id: string; amount: string; to_amount?: string };
