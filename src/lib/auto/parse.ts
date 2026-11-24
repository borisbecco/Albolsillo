// Lectura de avisos de pago (mails reenviados y comprobantes compartidos).
// Un parser por remitente con la misma interfaz: parse(texto) → { amount, currency, merchant, date }.
// Los formatos reales cambian seguido: los parsers por billetera prueban primero sus frases y,
// si no encuentran nada, cae en el genérico (el usuario siempre confirma antes de sumar).

import { norm } from "@/lib/entities";

export type Parsed = { amount: number; currency: "ARS" | "USD"; merchant: string | null; date: string | null };

/** Billeteras y bancos que reconocemos por el remitente (payment_senders). */
export type Sender = { wallet: string; domain: string; from: RegExp; phrases?: RegExp[] };

export const PAYMENT_SENDERS: Sender[] = [
  {
    wallet: "Mercado Pago",
    domain: "mercadopago.com.ar",
    from: /mercadopago\.com|mercadolibre\.com/i,
    phrases: [/(?:pagaste|tu pago|pago aprobado)[^$]{0,80}?(?:a|en)\s+([^\n$]{2,50}?)\s+(?:por|de)\s/i],
  },
  { wallet: "Ualá", domain: "uala.com.ar", from: /uala\.com/i, phrases: [/(?:compra|pago)\s+(?:en|a)\s+([^\n$]{2,50}?)\s+(?:por|de)\s/i] },
  { wallet: "Naranja X", domain: "naranjax.com", from: /naranjax\.com|naranja\.com/i },
  { wallet: "MODO", domain: "modo.com.ar", from: /modo\.com\.ar/i },
  { wallet: "Personal Pay", domain: "personalpay.com.ar", from: /personalpay\.com/i },
  { wallet: "Brubank", domain: "brubank.com", from: /brubank\.com/i },
  { wallet: "Galicia", domain: "bancogalicia.com", from: /bancogalicia\.com|galicia\.com\.ar/i },
  { wallet: "Santander", domain: "santander.com.ar", from: /santander\.com\.ar/i },
  { wallet: "BBVA", domain: "bbva.com.ar", from: /bbva\.com\.ar/i },
  { wallet: "Lemon", domain: "lemon.me", from: /lemon\.me/i },
  { wallet: "Prex", domain: "prexcard.com.ar", from: /prex/i },
  { wallet: "Cuenta DNI", domain: "cuentadni.com.ar", from: /cuentadni|bancoprovincia\.com/i },
];

export const senderFor = (from: string) => PAYMENT_SENDERS.find((s) => s.from.test(from)) ?? null;

/** Filtro para pegar en Gmail: from:(dominio1 OR dominio2 ...). */
export const GMAIL_FILTER = `from:(${[...new Set(PAYMENT_SENDERS.slice(0, 8).map((s) => s.domain))].join(" OR ")})`;

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

/** La billetera de un comprobante, por lo que dice el texto. */
export const walletFromText = (text: string) => PAYMENT_SENDERS.find((s) => new RegExp(s.wallet.replace(/\s+/g, "\\s*"), "i").test(text)) ?? null;
