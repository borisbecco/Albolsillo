// Helpers de campos de los formularios.

/** Solo dígitos, hasta max caracteres (días, cuotas, últimos 4 de la tarjeta). */
export const digits = (v: string, max = 2) => v.replace(/\D/g, "").slice(0, max);

/** Día del mes válido (1 a 31). */
export const dayOk = (v: string) => Number(v) >= 1 && Number(v) <= 31;
