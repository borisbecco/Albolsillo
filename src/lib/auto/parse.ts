// Lectura de avisos de pago (mails reenviados y comprobantes compartidos).
// Un parser por remitente con la misma interfaz: parse(texto) → { amount, currency, merchant, date }.
// Los formatos reales cambian seguido: los parsers por billetera prueban primero sus frases y,
// si no encuentran nada, cae en el genérico (el usuario siempre confirma antes de sumar).

import { AR_ENTITIES, norm, type Entity } from "@/lib/entities";

export type Parsed = { amount: number; currency: "ARS" | "USD"; merchant: string | null; date: string | null };

/** Bancos, billeteras y tarjetas que reconocemos por el remitente (payment_senders). */
export type Sender = { wallet: string; domain: string; kind: Entity["kind"]; from: RegExp; words: string[]; match: RegExp; phrases?: RegExp[] };

// Palabras con las que aparece cada entidad en la dirección del remitente (además de la raíz del dominio).
const ALIASES: Record<string, string[]> = {
  "Mercado Pago": ["mercadopago", "mercadolibre"],
  "Naranja X": ["naranjax", "naranja"],
  Galicia: ["bancogalicia", "galicia"],
  Macro: ["macro", "bancomacro"],
  "Banco Provincia": ["bancoprovincia", "bapro"],
  Prex: ["prexcard", "prex"],
  Cencosud: ["tarjetacencosud", "cencosud"],
  "American Express": ["americanexpress", "amex", "aexp"],
  Visa: ["visa", "prismamediosdepago"],
};

// Frases propias de algunos avisos (si no aparecen, se usa el lector genérico).
const PHRASES: Record<string, RegExp[]> = {
  "Mercado Pago": [/(?:pagaste|tu pago|pago aprobado)[^$]{0,80}?(?:a|en)\s+([^\n$]{2,50}?)\s+(?:por|de)\s/i],
  Ualá: [/(?:compra|pago)\s+(?:en|a)\s+([^\n$]{2,50}?)\s+(?:por|de)\s/i],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Billeteras primero: un comprobante de Mercado Pago que menciona "Visa" es de Mercado Pago.
const ORDER: Entity["kind"][] = ["billetera", "banco", "tarjeta"];
const seen = new Set<string>();

// Billeteras de un banco con el mismo dominio (BNA+, Mi Banco Ciudad Wallet): los mails son del banco.
const bankDomains = new Set(AR_ENTITIES.filter((e) => e.kind === "banco").map((e) => e.domain));

export const PAYMENT_SENDERS: Sender[] = ORDER.flatMap((kind) => AR_ENTITIES.filter((e) => e.kind === kind))
  .filter((e) => e.kind === "banco" || !bankDomains.has(e.domain))
  .map((e) => {
    // Palabras sin repetir (BNA+ y Banco Nación comparten bna.com.ar: queda la primera).
    const words = (ALIASES[e.name] ?? [e.domain.split(".")[0]]).filter((w) => !seen.has(w));
    words.forEach((w) => seen.add(w));
    return { e, words };
  })
  .filter(({ words }) => words.length > 0)
  .map(({ e, words }) => ({
    wallet: e.name,
    domain: e.domain,
    kind: e.kind,
    words,
    // La palabra como parte del dominio: info@mercadopago.com, avisos@mails.bancogalicia.com.ar.
    from: new RegExp(`[@.\\-](?:${words.map(esc).join("|")})[.\\-]`, "i"),
    // En el texto de un comprobante: los nombres cortos (MODO, Tap, Visa…) solo tal cual, para no confundirlos con palabras comunes.
    match: e.name.replace(/[^\p{L}\d]/gu, "").length <= 4 ? new RegExp(`(?<![\\p{L}\\d])${esc(e.name)}(?![\\p{L}\\d])`, "u") : e.match,
    phrases: PHRASES[e.name],
  }));

export const senderFor = (from: string) => PAYMENT_SENDERS.find((s) => s.from.test(from)) ?? null;

/**
 * Filtro para pegar en Gmail: from:(mercadopago OR uala OR ...). Va por palabra y no por dominio completo:
 * Mercado Pago escribe desde @mercadopago.com (sin .ar) y los bancos usan subdominios (mails.bancogalicia.com.ar).
 */
export const GMAIL_FILTER = `from:(${PAYMENT_SENDERS.flatMap((s) => s.words).join(" OR ")})`;

/** "1.234,56" / "1234.56" / "1,234.56" → número. */
export function parseArNumber(raw: string): number {
  let s = raw.replace(/\s/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && /\.\d{3}$/.test(s) && lastComma < 0) s = s.replace(/\./g, "");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const AMOUNT = /(US\$|U\$S|USD|ARS|\$)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
const KEYWORDS = /(pagaste|pago de|compra de|compraste|monto|total|importe|transferiste|abonaste|cobro de|débito de|debito de)/i;

function findAmount(text: string): { amount: number; currency: "ARS" | "USD" } | null {
  const all = [...text.matchAll(AMOUNT)].map((m) => ({
    i: m.index ?? 0,
    currency: /US|USD/i.test(m[1]) ? ("USD" as const) : ("ARS" as const),
    amount: parseArNumber(m[2]),
  }));
  const valid = all.filter((a) => a.amount > 0);
  if (!valid.length) return null;
  const kw = text.search(KEYWORDS);
  // El monto más cercano después de una palabra clave; si no, el primero.
  const best = kw >= 0 ? (valid.find((a) => a.i >= kw) ?? valid[0]) : valid[0];
  return { amount: best.amount, currency: best.currency };
}

const MERCHANT_RES = [
  // "Pagaste $ 18.450 a Rappi", "Compra de $ 3.000 en Coto"
  /(?:pagaste|compraste|pago|compra|transferiste|abonaste)\s+(?:de\s+|por\s+)?(?:US\$|U\$S|USD|ARS|\$)\s?[\d.,]+\s+(?:a|en)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9&'´.\- ]{2,50}?)(?=\s+(?:por|de|con|fue|se|ya)\s|\s*[.$\n,]|$)/i,
  /(?:pagaste|compraste|pago|compra|transferiste|abonaste)\s+(?:a|en)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9&'´.\- ]{2,50}?)(?=\s+(?:por|de|con|fue|se|ya)\s|\s*[.$\n,]|$)/i,
  /(?:comercio|destinatario|para|establecimiento)\s*:?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ0-9&'´.\- ]{2,50})/i,
];

function findMerchant(text: string, phrases: RegExp[] = []): string | null {
  for (const re of [...phrases, ...MERCHANT_RES]) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = m[1].replace(/\s+/g, " ").trim().replace(/[.,]$/, "");
      if (v.length >= 2 && !/^(tu|su|la|el|un|una)$/i.test(v)) return v.slice(0, 60);
    }
  }
  return null;
}

/** Fechas tipo 24/11/2026, 24-11-26 o "24 de noviembre". */
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function findDate(text: string, fallbackYear: number): string | null {
  const m = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const t = norm(text).match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?/);
  if (t) {
    const mo = MONTHS.indexOf(t[2]) + 1;
    return `${t[3] ?? fallbackYear}-${String(mo).padStart(2, "0")}-${String(Number(t[1])).padStart(2, "0")}`;
  }
  return null;
}

/** Lee monto, moneda, comercio y fecha de un aviso. Devuelve null si no hay un monto. */
export function parseNotice(text: string, sender: Sender | null, fallbackYear = new Date().getFullYear()): Parsed | null {
  const clean = text.replace(/ /g, " ").replace(/[ \t]+/g, " ");
  const money = findAmount(clean);
  if (!money) return null;
  return { ...money, merchant: findMerchant(clean, sender?.phrases), date: findDate(clean, fallbackYear) };
}

/** La billetera, banco o tarjeta de un comprobante, por lo que dice el texto. */
export const walletFromText = (text: string) => PAYMENT_SENDERS.find((s) => s.match.test(text)) ?? null;
