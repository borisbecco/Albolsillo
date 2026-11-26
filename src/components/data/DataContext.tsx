"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import type { UserDto } from "@/lib/auth/session";
import type { AccountDto, BillDto, CardDto, TxDto } from "@/lib/dto";
import type { LoanDto } from "@/lib/loans";
import type { Currency } from "@/lib/money";
import { useShell } from "@/components/shell/ShellContext";
import { currentMonth, todayAR } from "@/lib/month";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { demoData } from "@/lib/demo";
import { learnableKey, merchantKey } from "@/lib/merchant-key";
import { guessCategory } from "@/lib/merchants";
import { delta, loadPending, savePending, sortTx, type Core } from "./helpers";
import type { Bootstrap, BudgetRow, Data, FxResponse, OnboardingDraft, Tx, TxDraft } from "./types";
import { useAccountActions } from "./accounts";
import { useAuto } from "./auto";
import { useDebts } from "./debts";
import { useSavings } from "./savings";
import { useShared } from "./shared";

// Los tipos se siguen importando desde acá.
export type * from "./types";

// Datos de la app (bootstrap) y operaciones sobre movimientos.
// Regla: nunca se pierde lo cargado. Un alta que no llega al servidor queda en el dispositivo
// (localStorage) marcada como "failed" y se puede reintentar. La sincronización completa
// sin conexión (POST /sync + IndexedDB) llega más adelante.
//
// Este archivo es el núcleo (movimientos y su sincronización, cotización, categorías aprendidas,
// recarga y recorrido). Cada tema tiene su parte: debts.ts, savings.ts, shared.ts, auto.ts y accounts.ts.


const Ctx = createContext<Data | null>(null);


export function DataProvider({ initial, children }: { initial: Bootstrap; children: ReactNode }) {
  const { user, flash, setUser, tourStep } = useShell();
  // Categorías aprendidas (comercio normalizado → categoría). Se actualizan al elegir una a mano.
  const [rules, setRules] = useState<Record<string, string>>(() => Object.fromEntries((initial.merchant_rules ?? []).map((r) => [r.key, r.category_id])));
  const learn = useCallback((description: string, categoryId: string) => {
    const k = merchantKey(description);
    if (!learnableKey(k) || categoryId === "otros" || categoryId === "otros_in") return;
    setRules((r) => (r[k] === categoryId ? r : { ...r, [k]: categoryId }));
  }, []);
  const suggestCategory = useCallback((description: string) => rules[merchantKey(description)] ?? guessCategory(description), [rules]);
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

  const fail = useCallback(
    (e: unknown, fallback: string) => flash(e instanceof ApiClientError ? e.message : fallback, "errorguardar"),
    [flash],
  );
  const replaceAccount = useCallback((a: AccountDto | null) => {
    if (a) setAccounts((l) => l.map((x) => (x.id === a.id ? a : x)));
  }, []);
  const reloadAll = useCallback(() => reloadRef.current(), []);
  const core: Core = useMemo(
    () => ({ flash, fail, setTransactions, txRef, replaceAccount, moveBalances, reload: reloadAll }),
    [flash, fail, replaceAccount, moveBalances, reloadAll],
  );

  // Cada tema con su estado y sus acciones.
  const {
    cards,
    bills,
    billPayments,
    installments,
    loans,
    setCards,
    setBills,
    setBillPayments,
    setInstallments,
    setLoans,
    saveCard,
    deleteCard,
    saveBill,
    deleteBill,
    payBill,
    unpayBill,
    isBillPaid,
    saveLoan,
    deleteLoan,
    payLoan,
    unpayLoan,
    payCard,
    voidTx,
    loadStatement,
    importStatement,
    confirmImport,
  } = useDebts(core, initial);
  const { budgets, goals, investments, ipc, setBudgets, setGoals, setInvestments, budgetFor, saveBudget, saveGoal, deleteGoal, contribute, createInvestment, closeInvestment } =
    useSavings(core, initial);
  const { people, shared, setPeople, setShared, addPerson, invitePerson, deletePerson, addShared, deleteShared, settle } = useShared(core, initial);
  const { detected, setDetected, confirmDetected, discardDetected, shareReceipt } = useAuto(core, initial);
  const { createAccount, updateAccount, deleteAccount, transfer } = useAccountActions(core, setAccounts);

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
      if (d.type === "out" && d.description) learn(d.description, d.category_id);
      await send(t);
    },
    [send, flash, learn],
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
        const res = await api<{ transaction: TxDto; similar?: number }>(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(d) });
        patchTx(id, () => ({ ...res.transaction, status: "synced" }));
        moveBalances(delta(prev, -1), delta(res.transaction, 1));
        const t = res.transaction;
        const changedCat = d.category_id && d.category_id !== prev.category_id;
        if (changedCat && t.type === "out") learn(t.description, t.category_id);
        const n = res.similar ?? 0;
        if (changedCat && n > 0) {
          const catName = CATEGORY_BY_ID[t.category_id]?.name ?? "esa categoría";
          flash(`Movimiento actualizado. Hay ${n} más de «${t.description}» en Otros`, "ingreso", {
            label: `Pasar a ${catName}`,
            fn: async () => {
              try {
                const r = await api<{ transactions: TxDto[] }>("/transactions/recategorize", { method: "POST", body: JSON.stringify({ transaction_id: t.id, category_id: t.category_id }) });
                const byId = new Map(r.transactions.map((x) => [x.id, x]));
                setTransactions((list) => list.map((x) => (byId.has(x.id) ? { ...byId.get(x.id)!, status: "synced" as const } : x)));
                flash(`Listo: ${r.transactions.length} ${r.transactions.length === 1 ? "movimiento pasó" : "movimientos pasaron"} a ${catName}`);
              } catch (e) {
                flash(e instanceof ApiClientError ? e.message : "No pudimos cambiarlos. Probá de nuevo.", "errorguardar");
              }
            },
          });
        } else flash("Movimiento actualizado");
        return true;
      } catch (e) {
        patchTx(id, () => prev);
        flash(e instanceof ApiClientError ? e.message : "No pudimos guardar el cambio. Probá de nuevo.", "errorguardar");
        return false;
      }
    },
    [patchTx, send, settled, moveBalances, flash, learn],
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
    [patchTx, moveBalances, flash, setBillPayments, setLoans],
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
      if (b.merchant_rules) setRules(Object.fromEntries(b.merchant_rules.map((r) => [r.key, r.category_id])));
      setAccounts(b.accounts);
      // Lo que todavía no llegó al servidor se conserva.
      setTransactions((list) =>
        sortTx([...b.transactions.map((t) => ({ ...t, status: "synced" as const })), ...list.filter((t) => t.status !== "synced")]),
      );
    } catch {}
  }, [setCards, setBills, setBillPayments, setBudgets, setGoals, setInvestments, setPeople, setShared, setInstallments, setLoans, setDetected]);

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



  const saveOnboarding = useCallback(
    async (d: OnboardingDraft | { skipped: true }) => {
      try {
        const res = await api<{ user: UserDto; cards?: CardDto[]; bills?: BillDto[]; accounts?: AccountDto[] }>("/me/onboarding", {
          method: "POST",
          body: JSON.stringify(d),
        });
        setUser(res.user);
        if (res.cards) setCards(res.cards);
        if (res.bills) setBills(res.bills);
        const added = res.accounts ?? [];
        if (added.length) setAccounts((list) => [...list, ...added]);
        return true;
      } catch (e) {
        fail(e, "No pudimos guardar tu plan. Probá de nuevo.");
        return false;
      }
    },
    [fail, setUser, setCards, setBills],
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
    [fail, setUser, setBudgets, setBills],
  );




  const failed = transactions.find((t) => t.id === failedId && t.status === "failed") ?? null;

  const value: Omit<Data, "demo"> = {
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
    suggestCategory,
  };

  // Recorrido guiado: si los datos reales no alcanzan para que existan las partes que señala
  // (el resumen de Inicio aparece con 3 de los "Primeros pasos", Movimientos necesita gastos del mes
  // y el plan una tarjeta), las pantallas muestran un caso de ejemplo. Solo en memoria; al terminar
  // el recorrido vuelven los datos reales.
  const tourMonth = todayAR().slice(0, 7);
  const txThisMonth = transactions.some((t) => t.date.startsWith(tourMonth));
  const firstStepsDone = [txThisMonth, accounts.length > 0, cards.length > 0 || bills.length > 0, budgets.some((b) => b.month === tourMonth), goals.length > 0].filter(Boolean).length;
  const realIsEnough = txThisMonth && cards.length > 0 && firstStepsDone >= 3;
  const demo = tourStep !== null && !realIsEnough;
  const demoSet = useMemo(() => (demo ? demoData(todayAR()) : null), [demo]);
  const shown: Data = demoSet ? { ...value, ...demoSet, demo: true } : { ...value, demo: false };

  return <Ctx.Provider value={shown}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData fuera de DataProvider");
  return c;
}
