// Meses en formato "YYYY-MM", calculados en hora de Argentina.

export const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MONTH_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Fecha de hoy en Argentina (YYYY-MM-DD). */
export const todayAR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);

/** Mes actual en Argentina. */
export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Meses navegables: los últimos 6, terminando en el actual. */
export function navigableMonths(now = new Date(), count = 6): string[] {
  const cur = currentMonth(now);
  return Array.from({ length: count }, (_, i) => addMonths(cur, i - (count - 1)));
}

export function monthLabel(ym: string, short = false): string {
  const [y, m] = ym.split("-");
  return short ? `${MONTH_SHORT[+m - 1]} ${y.slice(2)}` : `${MONTH_FULL[+m - 1]} ${y}`;
}
