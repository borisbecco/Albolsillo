import { z } from "zod";

export const AccountName = z.string().trim().min(1, "Poné un nombre para la cuenta").max(60);
export const AccountKind = z.enum(["banco", "billetera", "efectivo"]);
/** Saldo: puede ser negativo (descubierto). */
export const Balance = z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/, "Revisá el saldo");
