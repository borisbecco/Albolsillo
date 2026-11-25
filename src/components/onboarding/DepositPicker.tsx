"use client";

import type { AccountDto } from "@/lib/dto";
import { entityDomain, norm, type EntityKind } from "@/lib/entities";
import type { Currency } from "@/lib/money";
import { EntityCombo } from "@/components/debts/EntityCombo";
import { Logo } from "@/components/shell/Logo";
import o from "./onboarding.module.css";

const KINDS: EntityKind[] = ["banco", "billetera"];

/** Cuenta donde entra un ingreso: una de las tuyas (de esa moneda) o un banco/billetera nuevo (se crea al guardar). */
export type Deposit = { acc: string | null; bank: string };

export function DepositPicker({
  label,
  accounts,
  currency,
  value,
  onChange,
  hint,
}: {
  label: string;
  accounts: AccountDto[];
  currency: Currency;
  value: Deposit;
  onChange: (d: Deposit) => void;
  hint: string;
}) {
  const options = accounts.filter((a) => a.currency === currency && a.kind !== "efectivo");
  const pickBank = (v: string) => {
    const same = options.find((a) => norm(a.name) === norm(v));
    onChange(same ? { acc: same.id, bank: "" } : { acc: null, bank: v });
  };
  return (
    <div className={`${o.field} ${o.depositRow}`}>
      <span className={o.fieldHead}>{label}</span>
      {options.length > 0 && (
        <div className={o.depositChips} role="group" aria-label={label}>
          {options.map((a) => (
            <button
              key={a.id}
              type="button"
              className={o.depositChip}
              aria-pressed={value.acc === a.id}
              onClick={() => onChange({ acc: value.acc === a.id ? null : a.id, bank: "" })}
            >
              <Logo domain={entityDomain(a.name)} icon="account_balance" size={24} />
              {a.name}
            </button>
          ))}
        </div>
      )}
      <EntityCombo key={value.acc ?? "nuevo"} value={value.acc ? "" : value.bank} onChange={pickBank} kinds={KINDS} />
      <span className={o.depositHint}>
        {value.bank && !value.acc ? `Creamos la cuenta ${value.bank} en ${currency === "USD" ? "dólares" : "pesos"} con saldo 0. Después cargá su saldo en Cuentas.` : hint}
      </span>
    </div>
  );
}

/** Lo que se manda al guardar: la cuenta (si sigue siendo de esa moneda) o el banco a crear. */
export const depositPayload = (d: Deposit, accounts: AccountDto[], currency: Currency) => ({
  account_id: d.acc && accounts.some((a) => a.id === d.acc && a.currency === currency) ? d.acc : null,
  bank: d.acc ? null : d.bank.trim() || null,
});
