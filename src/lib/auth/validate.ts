// Validaciones y textos de error compartidos entre los formularios y la API.
// Sin dependencias de servidor: se importa desde componentes cliente.

export const MSG = {
  loginEmail: "Ingresá tu email",
  loginPass: "Ingresá tu contraseña",
  regName: "Contanos cómo te llamás",
  regEmail: "Revisá el email",
  regPass: "La contraseña necesita al menos 8 caracteres",
  regTerms: "Aceptá los términos para seguir",
  forgotEmail: "Ingresá el email de tu cuenta",
  resetPass: "Usá al menos 8 caracteres",
  resetMatch: "Las contraseñas no coinciden",
} as const;

export const MIN_PASSWORD = 8;

export const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export type PasswordLevel = 0 | 1 | 2 | 3 | 4;

/** Medidor de 4 niveles: Débil, Media, Buena, Fuerte (igual que el prototipo). */
export function passwordLevel(p: string): PasswordLevel {
  if (!p) return 0;
  const score =
    [p.length >= MIN_PASSWORD, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean)
      .length + (p.length < MIN_PASSWORD ? -1 : 0);
  return Math.max(1, score) as PasswordLevel;
}

export const PASSWORD_LABELS = ["", "Débil", "Media", "Buena", "Fuerte"] as const;
