// Nombre del comercio normalizado para las categorías aprendidas (se usa en el servidor y en la app).

import { norm } from "@/lib/entities";

/**
 * Prefijos de procesadores de pago que los resúmenes anteponen al comercio
 * ("MERPAGO*PANALAURITA", "DLO*RAPPI", "CEN*LIBRERIA"): sin sacarlos, el mismo comercio
 * se vería distinto según cómo se pagó.
 */
const PROCESSORS = /^(?:propina|merpago|mercpago|mercadopago|mpago|mp|dlo|dlocal|cen|ebanx|payu|pagofacil|pf|paypal|pp|sq|tst|stripe)\s+/;

export const merchantKey = (m: string) => {
  // "(cuota 2/3)" no es parte del comercio.
  let k = norm(m.replace(/\(?\s*cuota\s+\d+\s*(?:\/|de)\s*\d+\s*\)?/gi, " "))
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Puede haber más de uno (p. ej. "DLO*MERPAGO*...").
  for (let i = 0; i < 2 && PROCESSORS.test(k); i++) k = k.replace(PROCESSORS, "");
  return k;
};

/** Claves demasiado genéricas para aprender ("varios", "pago", "x"). */
const GENERIC = new Set(["varios", "pago", "compra", "gasto", "otros", "transferencia", "efectivo", "sin descripcion", "debito", "credito"]);
export const learnableKey = (k: string) => k.length >= 3 && !GENERIC.has(k) && !/^\d+$/.test(k);
