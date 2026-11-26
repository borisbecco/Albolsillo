"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import type { AccountDto, BillDto, CardDto, InstallmentDto, TxDto } from "@/lib/dto";
import type { LoanDto } from "@/lib/loans";
import { todayAR } from "@/lib/month";
import { sortTx, type Core } from "./helpers";
import type { BillDraft, BillPayment, Bootstrap, CardDraft, CardPayDraft, ImportPreview, LoanDraft, StatementDraft } from "./types";

/** Tarjetas, gastos fijos, préstamos, pagos y resúmenes de tarjeta, e importación de resúmenes. */
export function useDebts(core: Core, initial: Bootstrap) {
  const { fail, flash, replaceAccount, setTransactions, reload } = core;
  const [cards, setCards] = useState(initial.cards);
  const [bills, setBills] = useState(initial.bills);
  const [billPayments, setBillPayments] = useState<BillPayment[]>(initial.bill_payments);
  const [installments, setInstallments] = useState(initial.installments);
  const [loans, setLoans] = useState(initial.loans);

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

  const payBill = useCallback(
    async (billId: string, month: string) => {
      try {
        const res = await api<{ transaction: TxDto; account: AccountDto | null }>(`/bills/${billId}/pay`, {
          method: "POST",
          body: JSON.stringify({ month, today: todayAR() }),
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
    [fail, replaceAccount, setTransactions],
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
    [fail, billPayments, replaceAccount, setTransactions],
  );

  const isBillPaid = useCallback((billId: string, month: string) => billPayments.some((p) => p.bill_id === billId && p.month === month), [billPayments]);

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
          body: JSON.stringify({ month, ...opts, today: todayAR() }),
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
    [fail, replaceAccount, setTransactions],
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
    [fail, replaceAccount, setTransactions],
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
    [fail, replaceAccount, setTransactions],
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
        const res = await api<{ card: CardDto; transactions: TxDto[]; installments: InstallmentDto[]; undo_token: string }>(`/cards/${cardId}/statements`, {
          method: "POST",
          body: JSON.stringify(st),
        });
        setCards((l) => l.map((c) => (c.id === cardId ? res.card : c)));
        setInstallments((l) => [...l.filter((q) => q.card_id !== cardId), ...res.installments]);
        if (res.transactions.length) setTransactions((l) => sortTx([...res.transactions.map((t) => ({ ...t, status: "synced" as const })), ...l]));
        const n = res.transactions.length;
        flash(n ? `Resumen de ${res.card.name} cargado. Sumamos ${n} ${n === 1 ? "cuota" : "cuotas"} como gasto` : `Resumen de ${res.card.name} cargado`, "gasto", {
          label: "Deshacer",
          fn: async () => {
            try {
              const r = await api<{ card: CardDto; installments: InstallmentDto[]; removed: string[] }>(`/cards/${cardId}/statements/undo`, {
                method: "POST",
                body: JSON.stringify({ undo_token: res.undo_token }),
              });
              setCards((l) => l.map((c) => (c.id === cardId ? r.card : c)));
              setInstallments((l) => [...l.filter((q) => q.card_id !== cardId), ...r.installments]);
              setTransactions((l) => l.filter((t) => !r.removed.includes(t.id)));
              flash("Listo, volvimos al resumen anterior");
            } catch (e) {
              fail(e, "No pudimos deshacerlo.");
            }
          },
        });
        return n;
      } catch (e) {
        fail(e, "No pudimos guardar el resumen. Probá de nuevo.");
        return null;
      }
    },
    [fail, flash, setTransactions],
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
    [fail, setTransactions],
  );

  return {
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
  };
}
