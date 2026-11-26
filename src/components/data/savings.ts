"use client";

import { useCallback, useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import type { AccountDto } from "@/lib/dto";
import type { GoalDto, InvestmentDto } from "@/lib/savings";
import { CATEGORY_BY_ID } from "@/lib/categories";
import type { Core } from "./helpers";
import type { Bootstrap, BudgetRow, GoalDraft, InvestmentDraft, IpcRow } from "./types";

/** Presupuestos, metas de ahorro, inversiones e inflación (IPC). */
export function useSavings(core: Core, initial: Bootstrap) {
  const { fail, replaceAccount } = core;
  const [budgets, setBudgets] = useState(initial.budgets);
  const [goals, setGoals] = useState(initial.goals);
  const [investments, setInvestments] = useState(initial.investments);
  const [ipc, setIpc] = useState<IpcRow[]>([]);

  useEffect(() => {
    api<{ ipc: IpcRow[] }>("/rates/ipc?from=2020-01").then((r) => setIpc(r.ipc)).catch(() => {});
  }, []);

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

  return {
    budgets,
    goals,
    investments,
    ipc,
    setBudgets,
    setGoals,
    setInvestments,
    budgetFor,
    saveBudget,
    saveGoal,
    deleteGoal,
    contribute,
    createInvestment,
    closeInvestment,
  };
}
