// Utilidades de los datos: altas pendientes en el dispositivo, orden de movimientos y saldos.

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AccountDto, TxDto } from "@/lib/dto";
import type { Tx } from "./types";

export const pendingKey = (userId: string) => `ab-pending-${userId}`;

export function loadPending(userId: string): Tx[] {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(userId)) ?? "[]") as Tx[];
  } catch {
    return [];
  }
}

export function savePending(userId: string, list: Tx[]) {
  try {
    const keep = list.filter((t) => t.status !== "synced");
    if (keep.length) localStorage.setItem(pendingKey(userId), JSON.stringify(keep));
    else localStorage.removeItem(pendingKey(userId));
  } catch {}
}

export const sortTx = (list: Tx[]) =>
  [...list].sort((a, b) => (a.date === b.date ? b.updated_at.localeCompare(a.updated_at) : b.date.localeCompare(a.date)));

export function delta(t: Pick<TxDto, "type" | "gross_amount" | "account_id">, dir: 1 | -1) {
  return t.account_id ? { id: t.account_id, v: dir * (t.type === "in" ? 1 : -1) * Number(t.gross_amount) } : null;
}

/** Lo que comparten las partes de los datos: avisos, movimientos, saldos y recarga. */
export type Core = {
  flash: (message: string, pose?: "bienvenida" | "ingreso" | "gasto" | "meta" | "alerta" | "errorguardar" | "cargando", action?: { label: string; fn: () => void }) => void;
  /** Aviso de error: el mensaje del servidor o uno de respaldo. */
  fail: (e: unknown, fallback: string) => void;
  setTransactions: Dispatch<SetStateAction<Tx[]>>;
  txRef: MutableRefObject<Tx[]>;
  /** Reemplaza una cuenta con la versión que devolvió el servidor. */
  replaceAccount: (a: AccountDto | null) => void;
  moveBalances: (...ds: ReturnType<typeof delta>[]) => void;
  /** Vuelve a pedir todos los datos al servidor. */
  reload: () => Promise<void>;
}
