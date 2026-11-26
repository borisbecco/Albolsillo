"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import type { AccountDto, PersonDto, TxDto } from "@/lib/dto";
import type { SharedDto } from "@/lib/shared";
import { delta, sortTx, type Core } from "./helpers";
import type { Bootstrap, SharedDraft } from "./types";

/** Contactos y gastos compartidos. */
export function useShared(core: Core, initial: Bootstrap) {
  const { fail, replaceAccount, setTransactions, moveBalances, txRef } = core;
  const [people, setPeople] = useState(initial.people);
  const [shared, setShared] = useState(initial.shared);

  // ─── Contactos y gastos compartidos ───

  const addPerson = useCallback(
    async (name: string, email: string | null) => {
      try {
        const res = await api<{ person: PersonDto; mail_sent: boolean | null; link: string | null }>("/people", { method: "POST", body: JSON.stringify({ name, email }) });
        setPeople((l) => [...l, res.person]);
        return { person: res.person, mailSent: res.mail_sent, link: res.link };
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
        const res = await api<{ person: PersonDto; mail_sent: boolean; link: string }>(`/people/${id}/invite`, { method: "POST", body: JSON.stringify(email ? { email } : {}) });
        setPeople((l) => l.map((p) => (p.id === id ? res.person : p)));
        return { mailSent: res.mail_sent, link: res.link };
      } catch (e) {
        fail(e, "No pudimos mandar la invitación. Probá de nuevo.");
        return null;
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
    [fail, replaceAccount, setTransactions],
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
    [fail, moveBalances, setTransactions, txRef],
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

  return { people, shared, setPeople, setShared, addPerson, invitePerson, deletePerson, addShared, deleteShared, settle };
}
