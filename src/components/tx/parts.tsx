"use client";

import { logoUrl } from "@/lib/logos";
import { entityDomain } from "@/lib/entities";
import { Logo } from "@/components/shell/Logo";

import { CATEGORY_BY_ID, catColor, catTint } from "@/lib/categories";
import type { AccountDto, CardDto } from "@/lib/dto";
import type { Currency } from "@/lib/money";

export const ACC_ICON: Record<AccountDto["kind"], string> = {
  banco: "account_balance",
  billetera: "account_balance_wallet",
  efectivo: "payments",
};

/** Opciones de "Pagado con" / "Entra en": cuentas de la misma moneda y, para gastos, tarjetas. */
export function sourceOptions(accounts: AccountDto[], cards: CardDto[], type: "in" | "out", currency: Currency) {
  return [
    ...accounts
      .filter((a) => a.currency === currency)
      .map((a) => ({ key: a.id, label: a.name, icon: ACC_ICON[a.kind], card: false, domain: a.kind === "efectivo" ? null : entityDomain(a.name) })),
    ...(type === "out" ? cards.map((c) => ({ key: `card:${c.id}`, label: c.name, icon: "credit_card", card: true, domain: entityDomain(c.name) })) : []),
  ];
}

export const splitSource = (key: string | null) =>
  !key ? { account_id: null, card_id: null } : key.startsWith("card:") ? { account_id: null, card_id: key.slice(5) } : { account_id: key, card_id: null };

export const sourceKey = (t: { account_id: string | null; card_id: string | null }) =>
  t.card_id ? `card:${t.card_id}` : t.account_id;

/** Ícono redondo de la categoría con su color. */
export function CatIcon({ id, size = 40, className }: { id: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-rounded ${className ?? ""}`}
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: catTint(id),
        color: catColor(id),
        fontSize: Math.round(size / 2),
        flex: "none",
      }}
    >
      {CATEGORY_BY_ID[id]?.icon ?? "category"}
    </span>
  );
}

/** Hoy en Argentina, YYYY-MM-DD. */
export function todayAR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** Logo del comercio si lo tenemos; si no, el ícono de la categoría. */
export function TxIcon({ categoryId, domain, size = 40 }: { categoryId: string; domain: string | null; size?: number }) {
  return logoUrl(domain) ? <Logo domain={domain} icon="storefront" size={size} /> : <CatIcon id={categoryId} size={size} />;
}
