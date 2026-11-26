"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import type { AccountDto, TxDto } from "@/lib/dto";
import type { DetectedDto } from "@/lib/auto/detected";
import { sortTx, type Core } from "./helpers";
import type { Bootstrap } from "./types";

/** Carga automática: gastos detectados por mail o comprobantes compartidos. */
export function useAuto(core: Core, initial: Bootstrap) {
  const { fail, replaceAccount, setTransactions } = core;
  const [detected, setDetected] = useState<DetectedDto[]>(initial.detected ?? []);

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
    [fail, replaceAccount, setTransactions],
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

  return { detected, setDetected, confirmDetected, discardDetected, shareReceipt };
}
