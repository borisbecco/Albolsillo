"use client";

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type { AccountDto } from "@/lib/dto";
import type { Dispatch, SetStateAction } from "react";
import type { Core } from "./helpers";
import type { AccountDraft, TransferDraft } from "./types";

/** Cuentas y transferencias (se espera la respuesta del servidor; no son optimistas). */
export function useAccountActions(core: Core, setAccounts: Dispatch<SetStateAction<AccountDto[]>>) {
  const { fail } = core;
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
    [fail, setAccounts],
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
    [fail, setAccounts],
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
    [fail, setAccounts],
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
    [fail, setAccounts],
  );

  return { createAccount, updateAccount, deleteAccount, transfer };
}
