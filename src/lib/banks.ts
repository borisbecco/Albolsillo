// Los 11 bancos (MARCA.md): detección por nombre, degradado de la tarjeta y color de brillo.

export type BankId = "galicia" | "bbva" | "santander" | "icbc" | "nacion" | "ciudad" | "macro" | "supervielle" | "patagonia" | "credicoop" | "naranjax" | "cencosud";
export type Network = "visa" | "master" | "amex";

type Bank = { id: BankId; name: string; match: RegExp; face: string; glow: string };

const g = (...stops: string[]) => `linear-gradient(140deg, ${stops.join(", ")})`;

export const BANKS: Bank[] = [
  { id: "galicia", name: "Galicia", match: /galicia/i, face: g("oklch(0.76 0.16 58)", "oklch(0.58 0.19 38) 60%", "oklch(0.45 0.16 28)"), glow: "oklch(0.65 0.18 45)" },
  { id: "bbva", name: "BBVA", match: /bbva|franc[eé]s/i, face: g("oklch(0.45 0.15 262)", "oklch(0.33 0.12 266) 55%", "oklch(0.64 0.13 222)"), glow: "oklch(0.55 0.16 250)" },
  { id: "icbc", name: "ICBC", match: /icbc/i, face: g("oklch(0.6 0.22 25)", "oklch(0.38 0.15 20)"), glow: "oklch(0.58 0.21 25)" },
  { id: "nacion", name: "Nación", match: /naci[oó]n|bna/i, face: g("oklch(0.55 0.11 230)", "oklch(0.34 0.09 240)"), glow: "oklch(0.52 0.11 230)" },
  { id: "ciudad", name: "Ciudad", match: /ciudad/i, face: g("oklch(0.6 0.13 210)", "oklch(0.38 0.1 220)"), glow: "oklch(0.58 0.12 210)" },
  { id: "supervielle", name: "Supervielle", match: /supervielle/i, face: g("oklch(0.55 0.2 15)", "oklch(0.33 0.12 280)"), glow: "oklch(0.5 0.18 10)" },
  { id: "patagonia", name: "Patagonia", match: /patagonia/i, face: g("oklch(0.5 0.14 255)", "oklch(0.3 0.1 260)"), glow: "oklch(0.48 0.14 255)" },
  { id: "credicoop", name: "Credicoop", match: /credicoop/i, face: g("oklch(0.6 0.12 175)", "oklch(0.38 0.09 190)"), glow: "oklch(0.56 0.12 175)" },
  { id: "santander", name: "Santander", match: /santander/i, face: g("oklch(0.64 0.21 28)", "oklch(0.42 0.17 22)"), glow: "oklch(0.6 0.2 27)" },
  { id: "macro", name: "Macro", match: /macro/i, face: g("oklch(0.5 0.13 245)", "oklch(0.32 0.1 250)"), glow: "oklch(0.5 0.13 245)" },
  { id: "cencosud", name: "Cencosud", match: /cencosud|cencopay/i, face: g("oklch(0.46 0.21 272)", "oklch(0.3 0.17 270) 60%", "oklch(0.58 0.2 0)"), glow: "oklch(0.5 0.21 272)" },
  { id: "naranjax", name: "Naranja X", match: /naranja/i, face: g("oklch(0.75 0.18 50)", "oklch(0.55 0.2 20)"), glow: "oklch(0.68 0.19 40)" },
];

/** Si el banco no se reconoce, violeta o verde azulado, alternando. */
const FALLBACK_FACES = [
  { face: g("oklch(0.55 0.16 292)", "oklch(0.34 0.1 272)"), glow: "oklch(0.55 0.16 292)" },
  { face: g("oklch(0.62 0.13 170)", "oklch(0.4 0.1 200)"), glow: "oklch(0.6 0.13 175)" },
];

export const BANK_BY_ID = Object.fromEntries(BANKS.map((b) => [b.id, b])) as Record<BankId, Bank>;

export const detectBank = (name: string): BankId | null => BANKS.find((b) => b.match.test(name))?.id ?? null;

export const detectNetwork = (name: string): Network => (/master/i.test(name) ? "master" : /amex|american/i.test(name) ? "amex" : "visa");

/** Cara de la tarjeta: degradado, brillo y el nombre que se muestra arriba a la izquierda. */
export function cardFace(name: string, bank: BankId | null, index = 0) {
  const b = bank ? BANK_BY_ID[bank] : null;
  const fb = FALLBACK_FACES[index % FALLBACK_FACES.length];
  const label = b?.name ?? (name.replace(/visa|mastercard|master|amex|american express/gi, "").trim() || name || "Tarjeta");
  return { face: b?.face ?? fb.face, glow: b?.glow ?? fb.glow, label };
}

/** Día de cierre estimado si no se conoce: unos 10 días antes del vencimiento. */
export const estimateCloseDay = (dueDay: number) => ((dueDay - 10 - 1 + 31) % 31) + 1;
