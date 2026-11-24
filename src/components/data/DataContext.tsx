"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import type { UserDto } from "@/lib/auth/session";
import type { AccountDto, BillDto, CardDto, InstallmentDto, PersonDto, TxDto } from "@/lib/dto";
import type { ParsedRow } from "@/lib/import/statement";
import type { GoalDto, InvestmentDto } from "@/lib/savings";
import type { SharedDto } from "@/lib/shared";
import type { LoanDto } from "@/lib/loans";
import type { DetectedDto } from "@/lib/auto/detected";
import type { Currency } from "@/lib/money";
import { useShell } from "@/components/shell/ShellContext";
import { currentMonth } from "@/lib/month";
import { CATEGORY_BY_ID } from "@/lib/categories";

// Datos de la app (bootstrap) y operaciones sobre movimientos.
// Regla: nunca se pierde lo cargado. Un alta que no llega al servidor queda en el dispositivo
// (localStorage) marcada como "failed" y se puede reintentar. La sincronización completa
// sin conexión (POST /sync + IndexedDB) llega más adelante.

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
};

export type LoanDraft = { lender: string | null; name: string; installment: string; due_day: number; n: number; of: number; tna: string; balance: string };

export type ImportPreview = {
  import_id: string;
  bank: string | null;
  period: string | null;
  balance_ars: string | null;
  min_payment: string | null;
  due_date: string | null;
  rows: (ParsedRow & { duplicate: boolean })[];
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

type Data = {
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
  addPerson: (name: string, email: string | null) => Promise<PersonDto | null>;
  invitePerson: (id: string, email?: string) => Promise<boolean>;
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

const Ctx = createContext<Data | null>(null);

const pendingKey = (userId: string) => `ab-pending-${userId}`;

function loadPending(userId: string): Tx[] {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(userId)) ?? "[]") as Tx[];
  } catch {
    return [];
  }
}

function savePending(userId: string, list: Tx[]) {
  try {
    const keep = list.filter((t) => t.status !== "synced");
    if (keep.length) localStorage.setItem(pendingKey(userId), JSON.stringify(keep));
    else localStorage.removeItem(pendingKey(userId));
  } catch {}
}

const sortTx = (list: Tx[]) =>
  [...list].sort((a, b) => (a.date === b.date ? b.updated_at.localeCompare(a.updated_at) : b.date.localeCompare(a.date)));

function delta(t: Pick<TxDto, "type" | "gross_amount" | "account_id">, dir: 1 | -1) {
  return t.account_id ? { id: t.account_id, v: dir * (t.type === "in" ? 1 : -1) * Number(t.gross_amount) } : null;
}

export function DataProvider({ initial, children }: { initial: Bootstrap; children: ReactNode }) {
  const { user, flash, setUser } = useShell();
  const [cards, setCards] = useState(initial.cards);
  const [bills, setBills] = useState(initial.bills);
  const [billPayments, setBillPayments] = useState(initial.bill_payments);
  const [budgets, setBudgets] = useState(initial.budgets);
  const [goals, setGoals] = useState(initial.goals);
  const [investments, setInvestments] = useState(initial.investments);
  const [ipc, setIpc] = useState<IpcRow[]>([]);
  const [people, setPeople] = useState(initial.people);
  const [shared, setShared] = useState(initial.shared);
  const [installments, setInstallments] = useState(initial.installments);
  const [loans, setLoans] = useState(initial.loans);
  const [detected, setDetected] = useState<DetectedDto[]>(initial.detected ?? []);
  const [transactions, setTransactions] = useState<Tx[]>(() =>
    sortTx(initial.transactions.map((t) => ({ ...t, status: "synced" as const }))),
  );
  const [accounts, setAccounts] = useState(initial.accounts);
  const [fx, setFx] = useState<FxResponse | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const txRef = useRef(transactions);
  const reloadRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    txRef.current = transactions;
    savePending(user.id, transactions);
  }, [transactions, user.id]);

  const patchTx = useCallback((id: string, fn: (t: Tx) => Tx | null) => {
    setTransactions((list) => sortTx(list.flatMap((t) => (t.id === id ? (fn(t) ?? []) : [t]))));
  }, []);

  const moveBalances = useCallback((...ds: (ReturnType<typeof delta>)[]) => {
    const real = ds.filter(Boolean) as { id: string; v: number }[];
    if (!real.length) return;
    setAccounts((list) =>
      list.map((a) => {
        const sum = real.filter((d) => d.id === a.id).reduce((s, d) => s + d.v, 0);
        return sum ? { ...a, balance: (Number(a.balance) + sum).toFixed(2) } : a;
      }),
    );
  }, []);

  // Altas en viaje al servidor, por id. Editar o borrar espera a que terminen, para no mandar
  // un segundo alta con el mismo id (el servidor devolvería la versión vieja).
  const inflight = useRef(new Map<string, Promise<Tx | null>>());

  const post = useCallback(
    async (t: Tx): Promise<Tx | null> => {
      const body: TxDraft & { id: string } = {
        id: t.id,
        type: t.type === "in" ? "in" : "out",
        date: t.date,
        description: t.description,
        category_id: t.category_id,
        amount: t.gross_amount,
        currency: t.currency,
        account_id: t.account_id,
        card_id: t.card_id,
        recurring: t.recurring,
      };
      try {
        const res = await api<{ transaction: TxDto }>("/transactions", { method: "POST", body: JSON.stringify(body) });
        const synced: Tx = { ...res.transaction, status: "synced" };
        patchTx(t.id, () => synced);
        moveBalances(delta(res.transaction, 1));
        return synced;
      } catch (e) {
        // Error de validación: no tiene sentido reintentar. Se descarta y se avisa.
        if (e instanceof ApiClientError && e.status === 400) {
          patchTx(t.id, () => null);
          flash(e.message, "errorguardar");
          return null;
        }
        const failedTx: Tx = { ...t, status: "failed" };
        patchTx(t.id, () => failedTx);
        // Sin conexión lo explica la banda de arriba; el aviso de error es para fallas del servidor.
        if (navigator.onLine) setFailedId(t.id);
        return failedTx;
      }
    },
    [patchTx, moveBalances, flash],
  );

  /** Manda el alta (una sola a la vez por id). Devuelve cómo quedó: synced, failed o null si se descartó. */
  const send = useCallback(
    (t: Tx) => {
      const p = post(t).finally(() => inflight.current.delete(t.id));
      inflight.current.set(t.id, p);
      return p;
    },
    [post],
  );

  /** Última versión de un movimiento, esperando el alta en curso si la hay. */
  const settled = useCallback(async (id: string) => {
    const fly = inflight.current.get(id);
    return fly ? await fly : (txRef.current.find((t) => t.id === id) ?? null);
  }, []);

  // Al abrir: suma lo que quedó pendiente en el dispositivo y lo reintenta.
  useEffect(() => {
    const pending = loadPending(user.id).filter((p) => !initial.transactions.some((t) => t.id === p.id));
    if (!pending.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions((list) => sortTx([...list, ...pending.map((p) => ({ ...p, status: "pending" as const }))]));
    pending.forEach((p) => void send({ ...p, status: "pending" }));
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<FxResponse>("/rates/fx").then(setFx).catch(() => {});
    api<{ ipc: IpcRow[] }>("/rates/ipc?from=2020-01").then((r) => setIpc(r.ipc)).catch(() => {});
  }, []);

  const rate = useMemo(() => {
    if (user.rate_type === "manual") return user.manual_rate ? Number(user.manual_rate) : null;
    const q = fx?.[user.rate_type];
    return q ? Number(q.sell) : null;
  }, [fx, user.rate_type, user.manual_rate]);

  const toDisplay = useCallback(
    (amount: number, currency: Currency) => {
      const target = user.display_currency;
      if (currency === target || !rate) return amount;
      return target === "USD" ? amount / rate : amount * rate;
    },
    [user.display_currency, rate],
  );

  const createTx = useCallback(
    async (d: TxDraft) => {
      if ((d.installments ?? 1) > 1) {
        // En cuotas: lo arma el servidor (compra en la tarjeta + gasto de la cuota 1), sin modo sin conexión.
        try {
          const res = await api<{ transaction: TxDto }>("/transactions", { method: "POST", body: JSON.stringify({ ...d, id: crypto.randomUUID() }) });
          setTransactions((list) => sortTx([{ ...res.transaction, status: "synced" }, ...list]));
          void reloadRef.current();
        } catch (e) {
          flash(e instanceof ApiClientError ? e.message : "Para cargar una compra en cuotas necesitás conexión.", "errorguardar");
        }
        return;
      }
      const { installments: _i, ...plain } = d;
      void _i;
      const t: Tx = {
        ...plain,
        ...d,
        id: crypto.randomUUID(),
        gross_amount: d.amount,
        bill_id: null,
        source: "manual",
        loan_id: null,
        installment_id: null,
        installment_number: null,
        imported: false,
        shared_expense_id: null,
        merchant_domain: null,
        updated_at: new Date().toISOString(),
        status: "pending",
      };
      setTransactions((list) => sortTx([t, ...list]));
      await send(t);
    },
    [send, flash],
  );

  const updateTx = useCallback(
    async (id: string, d: Partial<TxDraft>) => {
      const prev = await settled(id);
      if (!prev) return false;
      if (prev.status !== "synced") {
        // No llegó al servidor: se edita en el dispositivo y se reintenta el alta con los datos nuevos.
        const next: Tx = { ...prev, ...d, gross_amount: d.amount ?? prev.gross_amount, amount: d.amount ?? prev.amount, status: "pending" };
        patchTx(id, () => next);
        return (await send(next)) !== null;
      }
      patchTx(id, (t) => ({ ...t, ...d, gross_amount: d.amount ?? t.gross_amount, amount: d.amount ?? t.amount }));
      try {
        const res = await api<{ transaction: TxDto }>(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(d) });
        patchTx(id, () => ({ ...res.transaction, status: "synced" }));
        moveBalances(delta(prev, -1), delta(res.transaction, 1));
        return true;
      } catch (e) {
        patchTx(id, () => prev);
        flash(e instanceof ApiClientError ? e.message : "No pudimos guardar el cambio. Probá de nuevo.", "errorguardar");
        return false;
      }
    },
    [patchTx, send, settled, moveBalances, flash],
  );

  const deleteTx = useCallback(
    async (id: string) => {
      const before = txRef.current.find((t) => t.id === id) ?? null;
      patchTx(id, () => null); // se saca de la lista ya; el borrado en el servidor puede esperar al alta
      const fly = inflight.current.get(id);
      const prev = fly ? await fly : before;
      if (!prev || prev.status !== "synced") return true; // nunca llegó al servidor
      try {
        await api(`/transactions/${id}`, { method: "DELETE" });
        moveBalances(delta(prev, -1));
        // Si era el pago de un gasto fijo, vuelve a quedar pendiente.
        if (prev.bill_id) setBillPayments((l) => l.filter((p) => p.transaction_id !== id));
        if (prev.category_id === "prestamo") api<{ loans: LoanDto[] }>("/loans").then((r) => setLoans(r.loans)).catch(() => {});
        return true;
      } catch {
        setTransactions((list) => sortTx([...list, prev]));
        flash("No pudimos eliminarlo. Probá de nuevo.", "errorguardar");
        return false;
      }
    },
    [patchTx, moveBalances, flash],
  );

  const reload = useCallback(async () => {
    try {
      const b = await api<Bootstrap>(`/me/bootstrap?month=${currentMonth()}`);
      setCards(b.cards);
      setBills(b.bills);
      setBillPayments(b.bill_payments);
      setBudgets(b.budgets);
      setGoals(b.goals);
      setInvestments(b.investments);
      setPeople(b.people);
      setShared(b.shared);
      setInstallments(b.installments);
      setLoans(b.loans);
      setDetected(b.detected ?? []);
      setAccounts(b.accounts);
      // Lo que todavía no llegó al servidor se conserva.
      setTransactions((list) =>
        sortTx([...b.transactions.map((t) => ({ ...t, status: "synced" as const })), ...list.filter((t) => t.status !== "synced")]),
      );
    } catch {}
  }, []);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  const deleteTxs = useCallback(
    async (ids: string[]) => {
      const set = new Set(ids);
      const removed = txRef.current.filter((t) => set.has(t.id));
      if (!removed.length) return false;
      setTransactions((list) => list.filter((t) => !set.has(t.id)));
      // Si alguno está en viaje al servidor, se espera a que termine.
      const settled = await Promise.all(removed.map(async (t) => (inflight.current.get(t.id) ? await inflight.current.get(t.id)! : t)));
      const remote = settled.filter((t): t is Tx => !!t && t.status === "synced");
      const local = settled.filter((t): t is Tx => !!t && t.status !== "synced");
      const putBackLocal = () => local.length && setTransactions((list) => sortTx([...list, ...local]));
      const cuotas = removed.some((t) => t.installment_number === 1);
      const msg =
        removed.length === 1
          ? cuotas
            ? "Eliminamos la compra y cancelamos las cuotas que faltaban"
            : "Movimiento eliminado"
          : `Eliminamos ${removed.length} movimientos`;
      let token: string | null = null;
      if (remote.length) {
        try {
          const r = await api<{ undo_token: string }>("/transactions/bulk-delete", { method: "POST", body: JSON.stringify({ ids: remote.map((t) => t.id) }) });
          token = r.undo_token;
        } catch {
          setTransactions((list) => sortTx([...list, ...remote]));
          putBackLocal();
          flash("No pudimos eliminarlo. Probá de nuevo.", "errorguardar");
          return false;
        }
        await reload();
      }
      flash(msg, "bienvenida", {
        label: "Deshacer",
        fn: async () => {
          putBackLocal();
          if (token) {
            try {
              await api("/transactions/restore", { method: "POST", body: JSON.stringify({ undo_token: token }) });
              await reload();
            } catch {
              return flash("No pudimos recuperarlo.", "errorguardar");
            }
          }
          flash("Listo, lo recuperamos");
        },
      });
      return true;
    },
    [flash, reload],
  );

  // ─── Cuentas: se espera la respuesta del servidor (no son optimistas) ───

  const fail = useCallback(
    (e: unknown, fallback: string) => flash(e instanceof ApiClientError ? e.message : fallback, "errorguardar"),
    [flash],
  );

  const createAccount = useCallback(
    async (a: AccountDraft) => {
      try {
        const res = await api<{ account: AccountDto }>("/accounts", { method: "POST", body: JSON.stringify(a) });
        setAccounts((list) => [...list, res.account]);
        return res.account;
      } catch (e) {
        fail(e, "No pudimos agregar la cuenta. Probá de nuevo.");
        return null;
      }
    },
    [fail],
  );

  const updateAccount = useCallback(
    async (id: string, a: Partial<Omit<AccountDraft, "currency">>) => {
      try {
        const res = await api<{ account: AccountDto }>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(a) });
        setAccounts((list) => list.map((x) => (x.id === id ? res.account : x)));
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar la cuenta. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      try {
        await api(`/accounts/${id}`, { method: "DELETE" });
        setAccounts((list) => list.filter((x) => x.id !== id));
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminar la cuenta. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const transfer = useCallback(
    async (t: TransferDraft) => {
      try {
        const res = await api<{ accounts: AccountDto[] }>("/transfers", { method: "POST", body: JSON.stringify(t) });
        setAccounts((list) => list.map((x) => res.accounts.find((u) => u.id === x.id) ?? x));
        return true;
      } catch (e) {
        fail(e, "No pudimos hacer la transferencia. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const saveOnboarding = useCallback(
    async (d: OnboardingDraft | { skipped: true }) => {
      try {
        const res = await api<{ user: UserDto; cards?: CardDto[]; bills?: BillDto[] }>("/me/onboarding", {
          method: "POST",
          body: JSON.stringify(d),
        });
        setUser(res.user);
        if (res.cards) setCards(res.cards);
        if (res.bills) setBills(res.bills);
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar tu plan. Probá de nuevo.");
        return false;
      }
    },
    [fail, setUser],
  );

  // ─── Tarjetas y gastos fijos (se espera al servidor) ───

  const saveCard = useCallback(
    async (id: string | null, c: CardDraft) => {
      try {
        const res = await api<{ card: CardDto }>(id ? `/cards/${id}` : "/cards", { method: id ? "PATCH" : "POST", body: JSON.stringify(c) });
        setCards((l) => (id ? l.map((x) => (x.id === id ? res.card : x)) : [...l, res.card]));
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar la tarjeta. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      try {
        await api(`/cards/${id}`, { method: "DELETE" });
        setCards((l) => l.filter((x) => x.id !== id));
        flash("Tarjeta eliminada", "bienvenida", {
          label: "Deshacer",
          fn: async () => {
            try {
              const r = await api<{ card: CardDto }>(`/cards/${id}/restore`, { method: "POST" });
              setCards((l) => [...l, r.card]);
              flash("Listo, la recuperamos");
            } catch (e) {
              fail(e, "No pudimos recuperarla.");
            }
          },
        });
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminar la tarjeta. Probá de nuevo.");
        return false;
      }
    },
    [fail, flash],
  );

  const saveBill = useCallback(
    async (id: string | null, b: BillDraft) => {
      try {
        const res = await api<{ bill: BillDto }>(id ? `/bills/${id}` : "/bills", { method: id ? "PATCH" : "POST", body: JSON.stringify(b) });
        setBills((l) => (id ? l.map((x) => (x.id === id ? res.bill : x)) : [...l, res.bill]).sort((a, z) => a.due_day - z.due_day));
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar el gasto fijo. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const deleteBill = useCallback(
    async (id: string) => {
      try {
        await api(`/bills/${id}`, { method: "DELETE" });
        setBills((l) => l.filter((x) => x.id !== id));
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminar el gasto fijo. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const replaceAccount = useCallback((a: AccountDto | null) => {
    if (a) setAccounts((l) => l.map((x) => (x.id === a.id ? a : x)));
  }, []);

  const payBill = useCallback(
    async (billId: string, month: string) => {
      try {
        const res = await api<{ transaction: TxDto; account: AccountDto | null }>(`/bills/${billId}/pay`, {
          method: "POST",
          body: JSON.stringify({ month, today: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()) }),
        });
        setBillPayments((l) => [...l.filter((p) => !(p.bill_id === billId && p.month === month)), { bill_id: billId, month, transaction_id: res.transaction.id }]);
        setTransactions((l) => sortTx([{ ...res.transaction, status: "synced" }, ...l]));
        replaceAccount(res.account);
        return true;
      } catch (e) {
        fail(e, "No pudimos marcarlo como pagado. Probá de nuevo.");
        return false;
      }
    },
    [fail, replaceAccount],
  );

  const unpayBill = useCallback(
    async (billId: string, month: string) => {
      const p = billPayments.find((x) => x.bill_id === billId && x.month === month);
      try {
        const res = await api<{ account: AccountDto | null }>(`/bills/${billId}/pay?month=${month}`, { method: "DELETE" });
        setBillPayments((l) => l.filter((x) => !(x.bill_id === billId && x.month === month)));
        if (p?.transaction_id) setTransactions((l) => l.filter((t) => t.id !== p.transaction_id));
        replaceAccount(res.account);
        return true;
      } catch (e) {
        fail(e, "No pudimos deshacer el pago. Probá de nuevo.");
        return false;
      }
    },
    [fail, billPayments, replaceAccount],
  );

  const isBillPaid = useCallback((billId: string, month: string) => billPayments.some((p) => p.bill_id === billId && p.month === month), [billPayments]);

  const budgetFor = useCallback(
    (month: string, categoryId: string) => {
      const row = budgets.find((b) => b.month === month && b.category_id === categoryId);
      return row ? { amount: Number(row.amount), custom: true } : { amount: CATEGORY_BY_ID[categoryId]?.budget ?? 0, custom: false };
    },
    [budgets],
  );

  const saveBudget = useCallback(
    async (month: string, categoryId: string, amount: string | null) => {
      try {
        const res = await api<{ budget: BudgetRow | null }>("/budgets", { method: "PUT", body: JSON.stringify({ month, category_id: categoryId, amount }) });
        setBudgets((l) => [...l.filter((b) => !(b.month === month && b.category_id === categoryId)), ...(res.budget ? [res.budget] : [])]);
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar el límite. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  // ─── Metas e inversiones ───

  const saveGoal = useCallback(
    async (id: string | null, g: GoalDraft) => {
      try {
        const res = await api<{ goal: GoalDto }>(id ? `/goals/${id}` : "/goals", { method: id ? "PATCH" : "POST", body: JSON.stringify(g) });
        setGoals((l) => (id ? l.map((x) => (x.id === id ? res.goal : x)) : [...l, res.goal]));
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar la meta. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      try {
        await api(`/goals/${id}`, { method: "DELETE" });
        setGoals((l) => l.filter((x) => x.id !== id));
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminar la meta. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const contribute = useCallback(
    async (goalId: string, amount: string) => {
      try {
        const res = await api<{ goal: GoalDto; account: AccountDto | null }>(`/goals/${goalId}/contributions`, { method: "POST", body: JSON.stringify({ amount }) });
        setGoals((l) => l.map((x) => (x.id === goalId ? res.goal : x)));
        replaceAccount(res.account);
        return res.goal;
      } catch (e) {
        fail(e, "No pudimos sumar el aporte. Probá de nuevo.");
        return null;
      }
    },
    [fail, replaceAccount],
  );

  const createInvestment = useCallback(
    async (i: InvestmentDraft) => {
      try {
        const res = await api<{ investment: InvestmentDto; account: AccountDto }>("/investments", { method: "POST", body: JSON.stringify(i) });
        setInvestments((l) => [...l, res.investment]);
        replaceAccount(res.account);
        return true;
      } catch (e) {
        fail(e, "No pudimos registrar la inversión. Probá de nuevo.");
        return false;
      }
    },
    [fail, replaceAccount],
  );

  const closeInvestment = useCallback(
    async (id: string, amount: string) => {
      try {
        const res = await api<{ account: AccountDto | null }>(`/investments/${id}/close`, { method: "POST", body: JSON.stringify({ amount }) });
        setInvestments((l) => l.filter((x) => x.id !== id));
        replaceAccount(res.account);
        return res.account;
      } catch (e) {
        fail(e, "No pudimos cerrar la inversión. Probá de nuevo.");
        return false as const;
      }
    },
    [fail, replaceAccount],
  );

  // ─── Contactos y gastos compartidos ───

  const addPerson = useCallback(
    async (name: string, email: string | null) => {
      try {
        const res = await api<{ person: PersonDto }>("/people", { method: "POST", body: JSON.stringify({ name, email }) });
        setPeople((l) => [...l, res.person]);
        return res.person;
      } catch (e) {
        fail(e, "No pudimos agregar el contacto. Probá de nuevo.");
        return null;
      }
    },
    [fail],
  );

  const invitePerson = useCallback(
    async (id: string, email?: string) => {
      try {
        const res = await api<{ person: PersonDto }>(`/people/${id}/invite`, { method: "POST", body: JSON.stringify(email ? { email } : {}) });
        setPeople((l) => l.map((p) => (p.id === id ? res.person : p)));
        return true;
      } catch (e) {
        fail(e, "No pudimos mandar la invitación. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const deletePerson = useCallback(
    async (id: string) => {
      try {
        await api(`/people/${id}`, { method: "DELETE" });
        setPeople((l) => l.filter((p) => p.id !== id));
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminar el contacto. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const addShared = useCallback(
    async (d: SharedDraft) => {
      try {
        const res = await api<{ shared: SharedDto; transaction: TxDto | null; account: AccountDto | null }>("/shared", { method: "POST", body: JSON.stringify(d) });
        setShared((l) => [res.shared, ...l]);
        if (res.transaction) setTransactions((l) => sortTx([{ ...res.transaction!, status: "synced" }, ...l]));
        replaceAccount(res.account);
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar el gasto compartido. Probá de nuevo.");
        return false;
      }
    },
    [fail, replaceAccount],
  );

  const deleteShared = useCallback(
    async (id: string) => {
      try {
        await api(`/shared/${id}`, { method: "DELETE" });
        setShared((l) => l.filter((x) => x.id !== id));
        const removed = txRef.current.filter((t) => t.shared_expense_id === id);
        setTransactions((l) => l.filter((t) => t.shared_expense_id !== id));
        moveBalances(...removed.map((t) => delta(t, -1)));
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminarlo. Probá de nuevo.");
        return false;
      }
    },
    [fail, moveBalances],
  );

  const settle = useCallback(
    async (personId: string, amount: string) => {
      try {
        const res = await api<{ shared: SharedDto }>("/shared/settle", { method: "POST", body: JSON.stringify({ person_id: personId, amount }) });
        setShared((l) => [res.shared, ...l]);
        return true;
      } catch (e) {
        fail(e, "No pudimos registrar el pago. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const pendingCount = transactions.filter((t) => t.status !== "synced").length;

  const retryPending = useCallback(async () => {
    const list = txRef.current.filter((t) => t.status === "failed");
    setFailedId(null);
    const results = await Promise.all(list.map((t) => send({ ...t, status: "pending" })));
    return results.filter((r) => r?.status === "synced").length;
  }, [send]);

  const startMonth = useCallback(
    async (d: { month: string; budget_mode: "keep" | "infl" | "spent"; budgets: { category_id: string; amount: number }[]; drop_bills: string[] }) => {
      try {
        const res = await api<{ user: UserDto; budgets: BudgetRow[]; bills: BillDto[] }>("/me/month/start", { method: "POST", body: JSON.stringify(d) });
        setUser(res.user);
        setBudgets((l) => [...l.filter((b) => b.month !== d.month), ...res.budgets]);
        setBills(res.bills);
        return true;
      } catch (e) {
        fail(e, "No pudimos arrancar el mes. Probá de nuevo.");
        return false;
      }
    },
    [fail, setUser],
  );

  // ─── Préstamos ───

  const saveLoan = useCallback(
    async (id: string | null, l: LoanDraft) => {
      try {
        const res = await api<{ loan: LoanDto }>(id ? `/loans/${id}` : "/loans", { method: id ? "PATCH" : "POST", body: JSON.stringify(l) });
        setLoans((list) => (id ? list.map((x) => (x.id === id ? res.loan : x)) : [...list, res.loan]));
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar el préstamo. Probá de nuevo.");
        return false;
      }
    },
    [fail],
  );

  const deleteLoan = useCallback(
    async (id: string) => {
      try {
        await api(`/loans/${id}`, { method: "DELETE" });
        setLoans((list) => list.filter((x) => x.id !== id));
        flash("Préstamo eliminado", "bienvenida", {
          label: "Deshacer",
          fn: async () => {
            try {
              const r = await api<{ loan: LoanDto }>(`/loans/${id}/restore`, { method: "POST" });
              setLoans((list) => [...list, r.loan]);
              flash("Listo, lo recuperamos");
            } catch (e) {
              fail(e, "No pudimos recuperarlo.");
            }
          },
        });
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminar el préstamo. Probá de nuevo.");
        return false;
      }
    },
    [fail, flash],
  );

  const payLoan = useCallback(
    async (id: string, month: string, opts: { amount?: string; account_id?: string | null } = {}) => {
      try {
        const res = await api<{ loan: LoanDto; transaction: TxDto; account: AccountDto | null }>(`/loans/${id}/pay`, {
          method: "POST",
          body: JSON.stringify({ month, ...opts, today: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()) }),
        });
        setLoans((list) => list.map((x) => (x.id === id ? res.loan : x)));
        setTransactions((l) => sortTx([{ ...res.transaction, status: "synced" }, ...l]));
        replaceAccount(res.account);
        return true;
      } catch (e) {
        fail(e, "No pudimos registrar la cuota. Probá de nuevo.");
        return false;
      }
    },
    [fail, replaceAccount],
  );

  const unpayLoan = useCallback(
    async (id: string) => {
      try {
        const res = await api<{ loan: LoanDto; removed_transaction_id: string | null; account: AccountDto | null }>(`/loans/${id}/pay`, { method: "DELETE" });
        setLoans((list) => list.map((x) => (x.id === id ? res.loan : x)));
        if (res.removed_transaction_id) setTransactions((l) => l.filter((t) => t.id !== res.removed_transaction_id));
        replaceAccount(res.account);
        return true;
      } catch (e) {
        fail(e, "No pudimos deshacer el pago. Probá de nuevo.");
        return false;
      }
    },
    [fail, replaceAccount],
  );

  // ─── Pagos y resúmenes de tarjeta ───

  const payCard = useCallback(
    async (cardId: string, p: CardPayDraft) => {
      try {
        const res = await api<{ card: CardDto; transaction: TxDto; account: AccountDto | null }>(`/cards/${cardId}/payments`, { method: "POST", body: JSON.stringify(p) });
        setCards((l) => l.map((c) => (c.id === cardId ? res.card : c)));
        setTransactions((l) => sortTx([{ ...res.transaction, status: "synced" }, ...l]));
        replaceAccount(res.account);
        return res.transaction.id;
      } catch (e) {
        fail(e, "No pudimos registrar el pago. Probá de nuevo.");
        return null;
      }
    },
    [fail, replaceAccount],
  );

  /** Anula un pago (o cualquier movimiento) sin el aviso genérico; vuelve a pedir los datos. */
  const voidTx = useCallback(
    async (txId: string) => {
      try {
        await api(`/transactions/${txId}`, { method: "DELETE" });
        await reload();
        return true;
      } catch (e) {
        fail(e, "No pudimos anularlo.");
        return false;
      }
    },
    [fail, reload],
  );

  const loadStatement = useCallback(
    async (cardId: string, st: StatementDraft) => {
      try {
        const res = await api<{ card: CardDto; transactions: TxDto[]; installments: InstallmentDto[] }>(`/cards/${cardId}/statements`, {
          method: "POST",
          body: JSON.stringify(st),
        });
        setCards((l) => l.map((c) => (c.id === cardId ? res.card : c)));
        setInstallments((l) => [...l.filter((q) => q.card_id !== cardId), ...res.installments]);
        if (res.transactions.length) setTransactions((l) => sortTx([...res.transactions.map((t) => ({ ...t, status: "synced" as const })), ...l]));
        return res.transactions.length;
      } catch (e) {
        fail(e, "No pudimos guardar el resumen. Probá de nuevo.");
        return null;
      }
    },
    [fail],
  );

  // ─── Carga automática: gastos detectados ───

  const confirmDetected = useCallback(
    async (ids: string[], learn: { id: string; category_id: string }[], edits: Record<string, { category_id?: string; account_id?: string | null }>) => {
      try {
        const r = await api<{ transactions: TxDto[]; accounts: AccountDto[]; learned: number; pending: DetectedDto[] }>("/detected/confirm", {
          method: "POST",
          body: JSON.stringify({ ids, learn, edits }),
        });
        setTransactions((l) => sortTx([...r.transactions.map((t) => ({ ...t, status: "synced" as const })), ...l]));
        r.accounts.forEach((a) => replaceAccount(a));
        setDetected(r.pending);
        return { count: r.transactions.length, learned: r.learned };
      } catch (e) {
        fail(e, "No pudimos sumar los gastos. Probá de nuevo.");
        return null;
      }
    },
    [fail, replaceAccount],
  );

  const discardDetected = useCallback(
    async (id: string) => {
      const prev = detected;
      setDetected((l) => l.filter((d) => d.id !== id));
      try {
        await api(`/detected/${id}/discard`, { method: "POST" });
        return true;
      } catch (e) {
        setDetected(prev);
        fail(e, "No pudimos descartarlo.");
        return false;
      }
    },
    [detected, fail],
  );

  const shareReceipt = useCallback(
    async (file: Blob, name = "comprobante") => {
      const form = new FormData();
      form.append("file", file, name);
      try {
        const r = await api<{ detected: DetectedDto }>("/detected/share", { method: "POST", body: form });
        setDetected((l) => [r.detected, ...l]);
        return r.detected;
      } catch (e) {
        fail(e, "No pudimos leer el comprobante.");
        return null;
      }
    },
    [fail],
  );

  // ─── Importar resumen ───

  const importStatement = useCallback(
    async (cardId: string, file: File) => {
      const form = new FormData();
      form.append("card_id", cardId);
      form.append("file", file);
      try {
        return await api<ImportPreview>("/imports", { method: "POST", body: form });
      } catch (e) {
        fail(e, "No pudimos leer el resumen. Probá de nuevo.");
        return null;
      }
    },
    [fail],
  );

  const confirmImport = useCallback(
    async (importId: string, rowIds: string[], categories: Record<string, string>) => {
      try {
        const res = await api<{ imported: number; transactions: TxDto[]; card: CardDto; installments: InstallmentDto[] }>(`/imports/${importId}/confirm`, {
          method: "POST",
          body: JSON.stringify({ row_ids: rowIds, categories }),
        });
        setTransactions((l) => sortTx([...res.transactions.map((t) => ({ ...t, status: "synced" as const })), ...l]));
        setCards((l) => l.map((c) => (c.id === res.card.id ? res.card : c)));
        setInstallments((l) => [...l.filter((i) => i.card_id !== res.card.id), ...res.installments]);
        return res.imported;
      } catch (e) {
        fail(e, "No pudimos importar los movimientos. Probá de nuevo.");
        return null;
      }
    },
    [fail],
  );

  const failed = transactions.find((t) => t.id === failedId && t.status === "failed") ?? null;

  const value: Data = {
    transactions,
    accounts,
    cards,
    bills,
    people,
    saveOnboarding,
    billPayments,
    isBillPaid,
    saveCard,
    deleteCard,
    saveBill,
    deleteBill,
    payBill,
    unpayBill,
    budgets,
    budgetFor,
    saveBudget,
    goals,
    saveGoal,
    deleteGoal,
    contribute,
    investments,
    createInvestment,
    closeInvestment,
    ipc,
    shared,
    addPerson,
    invitePerson,
    deletePerson,
    addShared,
    deleteShared,
    settle,
    pendingCount,
    retryPending,
    startMonth,
    installments,
    loans,
    saveLoan,
    deleteLoan,
    payLoan,
    unpayLoan,
    importStatement,
    confirmImport,
    fx,
    rate,
    toDisplay,
    createTx,
    updateTx,
    deleteTx,
    deleteTxs,
    reload,
    detected,
    confirmDetected,
    discardDetected,
    shareReceipt,
    payCard,
    voidTx,
    loadStatement,
    failed,
    retryFailed: () => {
      if (!failed) return;
      setFailedId(null);
      patchTx(failed.id, (t) => ({ ...t, status: "pending" }));
      void send({ ...failed, status: "pending" }).then((r) => r?.status === "synced" && flash("Guardado", failed.type === "in" ? "ingreso" : "gasto"));
    },
    dismissFailed: () => setFailedId(null),
    createAccount,
    updateAccount,
    deleteAccount,
    transfer,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData fuera de DataProvider");
  return c;
}
