import type { AccountDto } from "@/lib/dto";

export const ACCOUNT_KINDS: Record<AccountDto["kind"], { icon: string; label: string; hue: number }> = {
  banco: { icon: "account_balance", label: "Banco", hue: 250 },
  billetera: { icon: "account_balance_wallet", label: "Billetera virtual", hue: 200 },
  efectivo: { icon: "payments", label: "Efectivo", hue: 150 },
};

export const kindTint = (k: AccountDto["kind"]) => `oklch(0.76 0.15 ${ACCOUNT_KINDS[k].hue} / .14)`;
export const kindColor = (k: AccountDto["kind"]) => `oklch(0.76 0.15 ${ACCOUNT_KINDS[k].hue})`;
