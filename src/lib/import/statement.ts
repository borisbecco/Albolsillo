// Lectura de resúmenes de tarjeta en PDF (formato común a los bancos argentinos).
//
// API.md pide un parser por banco con tests sobre resúmenes reales. Mientras no haya muestras,
// este parser general cubre el formato que comparten: una fila por movimiento con fecha,
// descripción, cuota opcional (C.06/12 o CUOTA 6 DE 12) y montos en columnas de pesos y dólares.
// La columna de cada monto se decide por su posición horizontal respecto de los encabezados.
// Probado con resúmenes reales de Cencosud (cupón antes de la fecha, cuotas "08/12" sueltas,
// cargos e impuestos sin fecha en su propia sección y próximo cierre en el texto).

import { getDocumentProxy } from "unpdf";
import { BANKS, type BankId } from "@/lib/banks";
import { guessCategory } from "@/lib/merchants";

export type RowKind = "purchase" | "installment" | "tax" | "fee" | "payment";

export type ParsedRow = {
  row_id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: string; // decimal, positivo
  currency: "ARS" | "USD";
  suggested_category: string;
  kind: RowKind;
  installment: { n: number; of: number } | null;
};

export type ParsedStatement = {
  bank: BankId | null;
  period: string | null; // YYYY-MM del cierre
  close_date: string | null;
  due_date: string | null;
  /** Próximo cierre, si el resumen lo informa (es el día de cierre que queda en la tarjeta). */
  next_close_date: string | null;
  balance_ars: string | null;
  balance_usd: string | null;
  min_payment: string | null;
  rows: ParsedRow[];
};

export type Item = { str: string; x: number; w: number };
export type Line = { y: number; items: Item[]; text: string };

const MONTHS: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
const AMOUNT = /^-?\$?\s?-?\d{1,3}(?:\.\d{3})*,\d{2}-?$/;
const DATE = /^(\d{1,2})[-/. ](\d{1,2}|[A-Za-zé]{3})[-/. ](\d{2}|\d{4})$/;

/** "1.234,56" / "-1.234,56" / "1.234,56-" → número. */
const toNumber = (s: string) => {
  const neg = s.includes("-");
  const n = Number(s.replace(/[$\s-]/g, "").replace(/\./g, "").replace(",", "."));
  return neg ? -n : n;
};

function toIsoDate(s: string): string | null {
  const m = s.match(DATE);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTHS[m[2].toLowerCase().slice(0, 3)];
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (!mo || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Agrupa los textos del PDF en líneas (por coordenada vertical) con su posición horizontal. */
async function readLines(data: Uint8Array): Promise<Line[]> {
  const pdf = await getDocumentProxy(data);
  const lines: Line[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, Item[]>();
    for (const it of content.items as { str: string; transform: number[]; width: number }[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2 - p * 10_000; // las páginas siguientes quedan debajo
      const arr = byY.get(y) ?? [];
      arr.push({ str: it.str.trim(), x: it.transform[4], w: it.width });
      byY.set(y, arr);
    }
    for (const [y, items] of [...byY].sort((a, b) => b[0] - a[0])) {
      items.sort((a, b) => a.x - b.x);
      lines.push({ y, items, text: items.map((i) => i.str).join(" ") });
    }
  }
  return lines;
}

const TAX = /IMPUESTO|SELLOS|PERCEP|\bI\.?V\.?A\.?(?=\s|$)|DB\.?\s?RG|RG\s?\d{4}|IIBB|INGRESOS BRUTOS/i;
const FEE = /COMISI[OÓ]N|\bCOMIS\b|CARGO|MANTENIMIENTO|SEGURO|RENOVACI[OÓ]N|INTERESES/i;
const PAYMENT = /SU PAGO|PAGO EN PESOS|PAGO EN D[OÓ]LARES|PAGO RECIBIDO|GRACIAS POR SU PAGO/i;
const INSTALLMENT = /\bC\.?\s?(\d{1,2})\/(\d{1,2})\b|CUOTA\s+(\d{1,2})\s+DE\s+(\d{1,2})|(?:^|\s)(\d{2})\/(\d{2})(?=\s|$)/i;
/** Número de cupón o comprobante antes de la fecha (Cencosud y otros). */
const COUPON = /^\d{3,7}$/;
/** Secciones con cargos sin fecha (se fechan con el cierre). */
const CHARGE_SECTION = /^(CARGOS Y COMISIONES|COMISIONES|INTERESES|IMPUESTOS)$/i;
const DATE_IN_TEXT = /(\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3})[-/. ]\d{2,4})/;

export function detectBankFromText(text: string): BankId | null {
  // Por nombre del emisor (y CUIT de los más comunes).
  const byCuit: [RegExp, BankId][] = [
    [/30-50000173-5/, "galicia"],
    [/30-50000319-3/, "bbva"],
    [/30-50000845-4/, "santander"],
    [/30-50001091-2/, "nacion"],
  ];
  for (const [re, id] of byCuit) if (re.test(text)) return id;
  // Emisores que no son bancos, antes de los nombres de bancos (el texto legal suele mencionar al Banco Nación).
  if (/CENCOSUD|cencopay|30-59036076-3/i.test(text)) return "cencosud";
  if (/Banco de la Naci[oó]n Argentina/i.test(text)) return "nacion";
  if (/Banco Ciudad/i.test(text)) return "ciudad";
  if (/Banco Macro/i.test(text)) return "macro";
  if (/Banco Patagonia/i.test(text)) return "patagonia";
  if (/Banco de Galicia|Galicia/i.test(text)) return "galicia";
  return BANKS.find((b) => b.match.test(text))?.id ?? null;
}

function findAmountAfter(text: string, label: RegExp): { ars: string | null; usd: string | null } {
  const all = text.split("\n");
  const i = all.findIndex((l) => label.test(l));
  if (i < 0) return { ars: null, usd: null };
  const hasNum = (l: string) => /\d{1,3}(?:\.\d{3})*,\d{2}/.test(l.replace(label, ""));
  // A veces el monto queda en la línea de abajo (otra altura en el PDF).
  const line = hasNum(all[i]) ? all[i].replace(label, " ") : (all[i + 1] ?? "");
  const nums = [...line.matchAll(/(U\$S|U\$D|USD|US\$)?\s?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/g)];
  let ars: string | null = null;
  let usd: string | null = null;
  for (const m of nums) {
    const v = toNumber(m[2]).toFixed(2);
    if (m[1]) usd ??= v;
    else ars ??= v;
  }
  return { ars, usd };
}

export async function parseStatement(data: Uint8Array): Promise<ParsedStatement & { text: string }> {
  return parseLines(await readLines(data));
}

/** Interpreta las líneas del PDF (separado de la lectura para poder probarlo). */
export function parseLines(lines: Line[]): ParsedStatement & { text: string } {
  const text = lines.map((l) => l.text).join("\n");
  // Cierre: "CIERRE ACTUAL 29/10/26" o "Este es el resumen de tu tarjeta ... al día 29/10/2026".
  const closeMatch =
    text.match(/CIERRE(?: ACTUAL)?:?\s+(\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3})[-/. ]\d{2,4})/i) ?? text.match(/resumen de tu tarjeta[^\n]*?al d[ií]a\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const close = closeMatch ? toIsoDate(closeMatch[1]) : null;

  // Columnas de montos según los encabezados (PESOS / DÓLARES).
  let pesosX: number | null = null;
  let dollarsX: number | null = null;
  // Centro horizontal de una palabra dentro de un texto (los encabezados suelen venir en un solo bloque).
  const wordCenter = (items: Item[], re: RegExp) => {
    for (const i of items) {
      const m = i.str.match(re);
      if (m && m.index !== undefined) return i.x + (i.w * (m.index + m[0].length / 2)) / i.str.length;
    }
    return null;
  };
  for (const l of lines) {
    const p = wordCenter(l.items, /\bPESOS\b/i);
    const d = wordCenter(l.items, /\bD[OÓ]LARES\b|U\$S|\bUSD\b/i);
    if (p !== null && d !== null && d > p) {
      pesosX = p;
      dollarsX = d;
      break;
    }
  }

  // Columnas por posición: los montos están alineados a la derecha. Si los bordes derechos forman
  // dos grupos separados, el de la derecha es dólares (mismo orden que los encabezados PESOS · DÓLARES).
  // Si la fila empieza con un cupón, la fecha es el elemento siguiente.
  const startOf = (l: Line) => (COUPON.test(l.items[0]?.str ?? "") && toIsoDate((l.items[1]?.str ?? "").split(" ")[0]) ? 1 : 0);
  const dated = lines.filter((l) => toIsoDate((l.items[startOf(l)]?.str ?? "").split(" ")[0]));
  const edges = dated.flatMap((l) => l.items.filter((i) => AMOUNT.test(i.str)).map((i) => i.x + i.w)).sort((a, b) => a - b);
  let usdFrom: number | null = null;
  let bestGap = 25;
  for (let i = 1; i < edges.length; i++) {
    if (edges[i] - edges[i - 1] > bestGap) {
      bestGap = edges[i] - edges[i - 1];
      usdFrom = (edges[i] + edges[i - 1]) / 2;
    }
  }

  const rows: ParsedRow[] = [];
  let section: string | null = null;
  for (const l of lines) {
    const s0 = startOf(l);
    const first = l.items[s0]?.str ?? "";
    const date = toIsoDate(first.split(" ")[0]);
    const amounts = l.items.filter((i) => AMOUNT.test(i.str));

    // Cargos sin fecha dentro de su sección del detalle (el recuadro de la página 1 trae montos en la misma línea del título, así que no abre sección).
    if (!date) {
      if (CHARGE_SECTION.test(l.text.trim()) && !amounts.length) section = l.text.trim().toUpperCase();
      else if (/^(TOTAL|FIN DEL DETALLE)/i.test(l.text.trim())) section = null;
      else if (section && amounts.length === 1 && close) {
        const desc = l.items.slice(0, l.items.indexOf(amounts[0])).map((i) => i.str).join(" ").trim();
        const value = toNumber(amounts[0].str);
        if (desc && value) {
          const tax = section === "IMPUESTOS" || TAX.test(desc);
          rows.push({ row_id: `r${rows.length + 1}`, date: close, description: desc, amount: Math.abs(value).toFixed(2), currency: "ARS", suggested_category: "impuestos", kind: tax ? "tax" : "fee", installment: null });
        }
      }
      continue;
    }
    if (!amounts.length) continue;

    // Descripción: lo que hay entre la fecha y el primer monto.
    const firstAmountIdx = l.items.indexOf(amounts[0]);
    let description = l.items
      .slice(s0 + 1, firstAmountIdx)
      .map((i) => i.str)
      .join(" ")
      .trim();
    if (!description) description = first.split(" ").slice(1).join(" ");
    const inst = description.match(INSTALLMENT);
    let installment = inst ? { n: Number(inst[1] ?? inst[3] ?? inst[5]), of: Number(inst[2] ?? inst[4] ?? inst[6]) } : null;
    if (installment && !(installment.n >= 1 && installment.n <= installment.of && installment.of <= 99)) installment = null;
    if (installment) description = description.replace(INSTALLMENT, " ").replace(/\s{2,}/g, " ").trim();
    // La tasa no es parte del nombre ("PR.FINANCIACION TNA 86,96%").
    description = description.replace(/\bTNA\s*\d{1,3}(?:,\d{1,2})?\s*%/i, "").replace(/\s{2,}/g, " ").trim();
    // Una cuota 2 o más es un cargo de este resumen: va con la fecha de cierre (no la de la compra original).
    // Lo mismo con cargos de un plan que traen una fecha de hace meses (p. ej. "SEGURO AP" con la fecha del plan).
    const old = close && Date.parse(close) - Date.parse(date) > 60 * 86_400_000;
    const rowDate = close && ((installment && installment.n > 1) || old) ? close : date;

    for (const a of amounts) {
      const center = a.x + a.w / 2;
      let currency: "ARS" | "USD" = "ARS";
      if (usdFrom !== null) currency = a.x + a.w > usdFrom ? "USD" : "ARS";
      else if (amounts.length >= 2) currency = a === amounts[amounts.length - 1] ? "USD" : "ARS";
      else if (pesosX !== null && dollarsX !== null) currency = Math.abs(center - dollarsX) < Math.abs(center - pesosX) ? "USD" : "ARS";
      else if (/U\$S|USD/i.test(description)) currency = "USD";
      // Con más de dos montos en la fila, solo cuentan la primera y la última columna.
      if (amounts.length > 2 && a !== amounts[0] && a !== amounts[amounts.length - 1]) continue;

      const value = toNumber(a.str);
      const kind: RowKind = PAYMENT.test(description) || value < 0 ? "payment" : TAX.test(description) ? "tax" : FEE.test(description) ? "fee" : installment ? "installment" : "purchase";
      const suggested = kind === "tax" || kind === "fee" ? "impuestos" : (guessCategory(description) ?? "otros");
      rows.push({
        row_id: `r${rows.length + 1}`,
        date: rowDate,
        description,
        amount: Math.abs(value).toFixed(2),
        currency,
        suggested_category: CATEGORY_OUT.has(suggested) ? suggested : "otros",
        kind,
        installment,
      });
      if (amounts.length < 2) break;
    }
  }

  const dueLine = text.match(/VENCIMIENTO(?: ACTUAL)?:?\s+(\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3})[-/. ]\d{2,4})/i);
  const nextClose = text.match(/pr[oó]ximo cierre[^\n]*?/i) ? text.match(new RegExp(`pr[oó]ximo cierre[^\\n]*?${DATE_IN_TEXT.source}`, "i")) : null;
  const balance = findAmountAfter(text, /SALDO ACTUAL|TOTAL A PAGAR|SALDO A PAGAR|SALDO EN PESOS/i);
  if (!balance.usd) balance.usd = findAmountAfter(text, /SALDO EN D[OÓ]LARES/i).usd;
  const min = findAmountAfter(text, /PAGO M[IÍ]NIMO/i);
  const lastRow = rows.map((r) => r.date).sort().at(-1);

  return {
    text,
    bank: detectBankFromText(text),
    period: (close ?? lastRow ?? null)?.slice(0, 7) ?? null,
    close_date: close,
    due_date: dueLine ? toIsoDate(dueLine[1]) : null,
    next_close_date: nextClose ? toIsoDate(nextClose[1]) : null,
    balance_ars: balance.ars,
    balance_usd: balance.usd,
    min_payment: min.ars,
    rows,
  };
}

const CATEGORY_OUT = new Set(["super", "resto", "transp", "hogar", "salud", "ocio", "viajes", "ropa", "servicios", "alquiler", "subs", "impuestos", "otros"]);
