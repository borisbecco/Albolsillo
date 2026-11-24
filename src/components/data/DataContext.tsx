"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import type { UserDto } from "@/lib/auth/session";
import type { AccountDto, BillDto, CardDto, PersonDto, TxDto } from "@/lib/dto";
import type { Currency } from "@/lib/money";
import { useShell } from "@/components/shell/ShellContext";

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
};

export type BillPayment = { bill_id: string; month: string; transaction_id: string | null };
export type CardDraft = { name: string; balance: string; min_payment: string; due_day: number; close_day: number; tna: string; last4: string | null };
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
};

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
  /** Cotizaciones del día (null mientras carga). */
  fx: FxResponse | null;
  /** Pesos por dólar según la cotización elegida (null mientras carga). */
  rate: number | null;
  /** Convierte un monto a la moneda en que el usuario eligió ver los montos. */
  toDisplay: (amount: number, currency: Currency) => number;
  createTx: (d: TxDraft) => Promise<void>;
  updateTx: (id: string, d: Partial<TxDraft>) => Promise<boolean>;
  deleteTx: (id: string) => Promise<boolean>;
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
  const [transactions, setTransactions] = useState<Tx[]>(() =>
    sortTx(initial.transactions.map((t) => ({ ...t, status: "synced" as const }))),
  );
  const [accounts, setAccounts] = useState(initial.accounts);
  const [fx, setFx] = useState<FxResponse | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const txRef = useRef(transactions);
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
        type: t.type,
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
        setFailedId(t.id);
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
      const t: Tx = {
        ...d,
        id: crypto.randomUUID(),
        gross_amount: d.amount,
        bill_id: null,
        imported: false,
        shared_expense_id: null,
        merchant_domain: null,
        updated_at: new Date().toISOString(),
        status: "pending",
      };
      setTransactions((list) => sortTx([t, ...list]));
      await send(t);
    },
    [send],
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
        return true;
      } catch {
        setTransactions((list) => sortTx([...list, prev]));
        flash("No pudimos eliminarlo. Probá de nuevo.", "errorguardar");
        return false;
      }
    },
    [patchTx, moveBalances, flash],
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
        return true;
      } catch (e) {
        fail(e, "No pudimos eliminar la tarjeta. Probá de nuevo.");
        return false;
      }
    },
    [fail],
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

  const failed = transactions.find((t) => t.id === failedId && t.status === "failed") ?? null;

  const value: Data = {
    transactions,
    accounts,
    cards,
    bills,
    people: initial.people,
    saveOnboarding,
    billPayments,
    isBillPaid,
    saveCard,
    deleteCard,
    saveBill,
    deleteBill,
    payBill,
    unpayBill,
    fx,
    rate,
    toDisplay,
    createTx,
    updateTx,
    deleteTx,
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
