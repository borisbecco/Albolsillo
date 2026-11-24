// Detección de comercio a partir de la descripción: sugiere categoría y dominio (para el logo).
// Reglas tomadas del prototipo; se usan al cargar a mano y al importar resúmenes.

const CATEGORY_RULES: [RegExp, string][] = [
  [/alquiler|expensas|consorcio|inmobiliaria/i, "alquiler"],
  [/\babl\b|agip|arba|patente|inmobiliario|monotributo|ganancias|bienes personales/i, "impuestos"],
  [/gimnasio|\bgym\b|prepaga|obra social/i, "salud"],
  [/coto|\bd[ií]a\b|carrefour|jumbo|disco|vea\b|chino/i, "super"],
  [/rappi|pedidosya|starbucks|caf[eé]|mostaza|mc ?donald|restaurant/i, "resto"],
  [/uber|cabify|shell|ypf|axion|nafta|sube|peaje|didi/i, "transp"],
  [/netflix|spotify|disney|hbo|youtube|chatgpt|openai|icloud/i, "subs"],
  [/farmacity|farmacia|osde|swiss|m[eé]dic/i, "salud"],
  [/zara|nike|adidas|dafiti/i, "ropa"],
  [/easy|sodimac|mercado ?libre|ikea/i, "hogar"],
  [/steam|cine|ticketek|recital|playstation/i, "ocio"],
  [/sellos|\biva\b|percep|impuesto|afip|arca/i, "impuestos"],
  [/edenor|edesur|metrogas|personal|telecentro|movistar|claro|aysa/i, "servicios"],
  [/sueldo|salario|haberes/i, "sueldo"],
  [/freelance|honorarios|factura/i, "freelance"],
];

const MERCHANT_DOMAINS: [RegExp, string][] = [
  [/coto/i, "coto.com.ar"],
  [/^d[ií]a\b/i, "supermercadosdia.com.ar"],
  [/carrefour/i, "carrefour.com.ar"],
  [/jumbo/i, "jumbo.com.ar"],
  [/rappi/i, "rappi.com.ar"],
  [/pedidosya/i, "pedidosya.com.ar"],
  [/uber/i, "uber.com"],
  [/netflix/i, "netflix.com"],
  [/spotify/i, "spotify.com"],
  [/chatgpt|openai/i, "openai.com"],
  [/disney/i, "disneyplus.com"],
  [/edenor/i, "edenor.com"],
  [/metrogas/i, "metrogas.com.ar"],
  [/fibertel|personal/i, "personal.com.ar"],
  [/aysa/i, "aysa.com.ar"],
  [/farmacity/i, "farmacity.com"],
  [/zara/i, "zara.com"],
  [/nike/i, "nike.com"],
  [/mercado libre/i, "mercadolibre.com.ar"],
  [/^easy/i, "easy.com.ar"],
  [/steam/i, "steampowered.com"],
  [/santander/i, "santander.com.ar"],
  [/galicia/i, "bancogalicia.com"],
  [/bbva/i, "bbva.com.ar"],
  [/monotributo|afip|arca/i, "arca.gob.ar"],
  [/abl|agip/i, "agip.gob.ar"],
  [/nafta|ypf/i, "ypf.com"],
  [/sube/i, "argentina.gob.ar"],
  [/cine/i, "cinemarkhoyts.com.ar"],
  [/recital/i, "ticketek.com.ar"],
];

export const guessCategory = (description: string): string | null =>
  CATEGORY_RULES.find(([re]) => re.test(description))?.[1] ?? null;

export const merchantDomain = (description: string): string | null =>
  MERCHANT_DOMAINS.find(([re]) => re.test(description.trim()))?.[1] ?? null;
