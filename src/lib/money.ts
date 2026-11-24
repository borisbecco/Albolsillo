// Montos: se tipean en formato es-AR ("1.234,56"), viajan como string decimal ("1234.56")
// y se muestran como "$ 1.234" o "US$ 1.234", con "−" (U+2212) como signo negativo.

export type Currency = "ARS" | "USD";

/** "1.234,56" → 1234.56. Devuelve 0 si no se puede leer. */
export function parseAmount(v: string): number {
  const n = Number.parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Número → string decimal con 2 decimales para la API. */
export const toDecimal = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** "1234.50" (de la API) → "1.234,5" para editar. */
export function toInput(decimal: string | number): string {
  const n = typeof decimal === "number" ? decimal : Number(decimal);
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: true });
}

const NEG = "−";

export function formatMoney(n: number, cur: Currency, opts: { sign?: boolean; decimals?: boolean } = {}): string {
  const abs = Math.abs(n);
  const body = abs.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
  const prefix = cur === "USD" ? "US$ " : "$ ";
  const sign = n < 0 ? NEG : opts.sign && n > 0 ? "+" : "";
  return `${sign}${prefix}${body}`;
}

/** Limpia lo que se tipea en un campo de monto: dígitos y una coma, máx. 2 decimales, con puntos de miles. */
export function maskAmountInput(raw: string): string {
  let s = raw.replace(/[^\d,]/g, "");
  const i = s.indexOf(",");
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, "").slice(0, 2);
  const [int, dec] = s.split(",");
  const intClean = int.replace(/^0+(?=\d)/, "").slice(0, 11);
  const grouped = intClean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec !== undefined ? `${grouped || "0"},${dec}` : grouped;
}

/**
 * Igual que maskAmountInput, pero desde el evento del input: después de reacomodar
 * los puntos de miles deja el cursor donde estaba (si no, salta al final y corregir
 * un dígito del medio rompe el número).
 */
export function maskAmountEvent(e: { target: HTMLInputElement }): string {
  const el = e.target;
  const raw = el.value;
  const masked = maskAmountInput(raw);
  const caret = el.selectionStart ?? raw.length;
  // Cuántos dígitos/comas había antes del cursor: el cursor va después del mismo carácter en el valor formateado.
  const keep = raw.slice(0, caret).replace(/[^\d,]/g, "").replace(/^0+(?=\d)/, "").length;
  let pos = 0;
  for (let seen = 0; pos < masked.length && seen < keep; pos++) if (/[\d,]/.test(masked[pos])) seen++;
  if (typeof window !== "undefined" && document.activeElement === el) {
    requestAnimationFrame(() => {
      if (document.activeElement === el) el.setSelectionRange(pos, pos);
    });
  }
  return masked;
}
