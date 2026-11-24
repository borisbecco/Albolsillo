import { hash, verify } from "@node-rs/argon2";

// argon2id con los parámetros recomendados por OWASP (19 MiB, 2 iteraciones).
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => hash(password, OPTS);

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash fijo para comparar cuando el usuario no existe y no revelar por el tiempo de respuesta. */
let dummy: Promise<string> | null = null;
export function dummyHash() {
  dummy ??= hashPassword("albolsillo-dummy-password");
  return dummy;
}
