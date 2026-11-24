// Bancos y billeteras de Argentina (lista AR_ENTITIES del prototipo): nombre, dominio del logo, tipo y cómo reconocerlo.

export type EntityKind = "banco" | "billetera";
export type Entity = {
  name: string;
  domain: string;
  kind: EntityKind;
  match: RegExp;
};

const E = (
  name: string,
  domain: string,
  kind: EntityKind,
  match: RegExp,
): Entity => ({ name, domain, kind, match });

export const AR_ENTITIES: Entity[] = [
  E("Banco Nación", "bna.com.ar", "banco", /naci[oó]n|\bbna\b/i),
  E(
    "Banco Provincia",
    "bancoprovincia.com.ar",
    "banco",
    /provincia(?!.*neuqu)|bapro/i,
  ),
  E("Banco Ciudad", "bancociudad.com.ar", "banco", /ciudad/i),
  E("Galicia", "bancogalicia.com", "banco", /galicia(?!\s*m[aá]s)/i),
  E(
    "Galicia Más (ex HSBC)",
    "galiciamas.com.ar",
    "banco",
    /galicia\s*m[aá]s|hsbc/i,
  ),
  E("Santander", "santander.com.ar", "banco", /santander/i),
  E("BBVA", "bbva.com.ar", "banco", /bbva|franc[eé]s/i),
  E("Macro", "macro.com.ar", "banco", /macro|ita[uú]/i),
  E("ICBC", "icbc.com.ar", "banco", /icbc/i),
  E("Credicoop", "bancocredicoop.coop", "banco", /credicoop/i),
  E("Banco Patagonia", "bancopatagonia.com.ar", "banco", /patagonia/i),
  E("Supervielle", "supervielle.com.ar", "banco", /supervielle/i),
  E("Comafi", "comafi.com.ar", "banco", /comafi/i),
  E("Banco Hipotecario", "hipotecario.com.ar", "banco", /hipotecario/i),
  E("Banco Columbia", "bancocolumbia.com.ar", "banco", /columbia/i),
  E("BIND Banco Industrial", "bind.com.ar", "banco", /\bbind\b|industrial/i),
  E("Bancor (Córdoba)", "bancor.com.ar", "banco", /bancor\b|c[oó]rdoba/i),
  E(
    "Banco de Santa Fe",
    "bancosantafe.com.ar",
    "banco",
    /banco\s*(de\s*)?santa\s*fe/i,
  ),
  E("Banco Entre Ríos", "bancoentrerios.com.ar", "banco", /entre\s*r[ií]os/i),
  E("Banco San Juan", "bancosanjuan.com", "banco", /san\s*juan/i),
  E("Banco de Corrientes", "bancodecorrientes.com.ar", "banco", /corrientes/i),
  E("Banco del Chubut", "bancochubut.com.ar", "banco", /chubut/i),
  E("Banco de La Pampa", "blp.com.ar", "banco", /la\s*pampa/i),
  E(
    "Banco Provincia del Neuquén",
    "bpn.com.ar",
    "banco",
    /neuqu[eé]n|\bbpn\b/i,
  ),
  E(
    "Banco Tierra del Fuego",
    "bancotdf.com.ar",
    "banco",
    /tierra\s*del\s*fuego/i,
  ),
  E("Nuevo Banco del Chaco", "nbch.com.ar", "banco", /chaco/i),
  E("Banco de Formosa", "bancoformosa.com.ar", "banco", /formosa/i),
  E(
    "Banco Santiago del Estero",
    "bse.com.ar",
    "banco",
    /santiago\s*del\s*estero/i,
  ),
  E("Banco Rioja", "bancorioja.com.ar", "banco", /rioja/i),
  E("Banco Santa Cruz", "bancosantacruz.com", "banco", /santa\s*cruz/i),
  E(
    "Banco Municipal de Rosario",
    "bmros.com.ar",
    "banco",
    /municipal|rosario/i,
  ),
  E("Banco del Sol", "bancodelsol.com", "banco", /banco\s*del\s*sol/i),
  E("Banco Masventas", "bancomasventas.com.ar", "banco", /masventas/i),
  E("Brubank", "brubank.com", "banco", /brubank/i),
  E("Openbank", "openbank.com.ar", "banco", /openbank/i),
  E("Wilobank", "wilobank.com", "banco", /wilo/i),
  E("Reba", "reba.com.ar", "banco", /\breba\b/i),
  E("Mercado Pago", "mercadopago.com.ar", "billetera", /mercado\s*pago/i),
  E("Ualá", "uala.com.ar", "billetera", /ual[aá]/i),
  E("Naranja X", "naranjax.com", "billetera", /naranja/i),
  E("MODO", "modo.com.ar", "billetera", /\bmodo\b/i),
  E("Cuenta DNI", "cuentadni.com.ar", "billetera", /cuenta\s*dni/i),
  E("Personal Pay", "personalpay.com.ar", "billetera", /personal\s*pay/i),
  E("Claro Pay", "claropay.com.ar", "billetera", /claro\s*pay/i),
  E("Lemon", "lemon.me", "billetera", /lemon/i),
  E("Belo", "belo.app", "billetera", /\bbelo\b/i),
  E("Prex", "prexcard.com.ar", "billetera", /\bprex\b/i),
  E("Cocos", "cocos.capital", "billetera", /cocos/i),
  E("Buenbit", "buenbit.com", "billetera", /buenbit/i),
  E("Ripio", "ripio.com", "billetera", /ripio/i),
  E("Fiwind", "fiwind.io", "billetera", /fiwind/i),
  E("AstroPay", "astropay.com", "billetera", /astropay/i),
  E("Yacaré", "yacare.com", "billetera", /yacar[eé]/i),
  E(
    "Billetera Santa Fe",
    "billeterasantafe.com.ar",
    "billetera",
    /billetera\s*santa\s*fe/i,
  ),
  E("BNA+", "bna.com.ar", "billetera", /bna\s*\+|bna\s*mas/i),
  E(
    "Mi Banco Ciudad Wallet",
    "bancociudad.com.ar",
    "billetera",
    /ciudad\s*wallet/i,
  ),
  E("Tap", "tap.com.ar", "billetera", /\btap\b/i),
];

/** Billeteras primero (más específicas: "Cuenta DNI" antes que "Provincia"). */
const ORDERED = [
  ...AR_ENTITIES.filter((e) => e.kind === "billetera"),
  ...AR_ENTITIES.filter((e) => e.kind === "banco"),
];

/** Marcas que no están en la lista pero tienen logo. */
const EXTRA: [RegExp, string][] = [[/hsbc/i, "hsbc.com.ar"]];

/** Entidad que corresponde a un nombre libre ("Cuenta Galicia", "MP"...). */
export const findEntity = (name: string | null | undefined): Entity | null =>
  name ? (ORDERED.find((e) => e.match.test(name)) ?? null) : null;

/** Dominio del logo de una cuenta, préstamo o billetera según su nombre. */
export function entityDomain(name: string | null | undefined): string | null {
  if (!name) return null;
  const e = findEntity(name);
  if (e) return e.domain;
  return EXTRA.find(([re]) => re.test(name))?.[1] ?? null;
}

export const sortedEntities = (kind: EntityKind) =>
  AR_ENTITIES.filter((e) => e.kind === kind).sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );

/** Para buscar sin tildes ni mayúsculas. */
export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
