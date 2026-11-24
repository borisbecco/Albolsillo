"use client";

import { cardFace, type BankId, type Network } from "@/lib/banks";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT } from "@/lib/month";
import c from "./cardface.module.css";

type Props = {
  name: string;
  bank: BankId | null;
  network: Network;
  balance: number;
  last4: string | null;
  dueDay: number | null;
  index?: number;
  /** Mes del vencimiento (YYYY-MM) para mostrar "Vence 20 nov". */
  month: string;
};

/** Tarjeta de crédito con el degradado de su banco (proporción 1.586, radio 20). */
export function CardFace({ name, bank, network, balance, last4, dueDay, index = 0, month }: Props) {
  const f = cardFace(name, bank, index);
  return (
    <div className={c.card} style={{ background: f.face, boxShadow: `0 28px 50px -22px ${f.glow}, 0 2px 0 rgba(255,255,255,.18) inset`, animationDelay: `${index * -2.3}s` }}>
      <div className={c.shine} />
      <div className={c.top}>
        <span className={c.bank}>{f.label}</span>
        {network === "visa" && <span className={c.visa}>VISA</span>}
        {network === "master" && (
          <span className={c.master} aria-label="Mastercard">
            <span />
            <span />
          </span>
        )}
        {network === "amex" && <span className={c.amex}>AMEX</span>}
      </div>
      <div className={c.spacer} />
      <div className={c.label}>Saldo a pagar</div>
      <div className={c.balance}>{formatMoney(balance, "ARS")}</div>
      <div className={c.bottom}>
        <span className="mono">•••• {last4 || "0000"}</span>
        <span>
          Vence {dueDay ?? "—"} {MONTH_SHORT[Number(month.slice(5)) - 1]}
        </span>
      </div>
    </div>
  );
}
