// Encabezados de seguridad y límites de intentos. Va última: agota los intentos de entrar por un minuto.
import { BASE, run } from "./lib.mjs";

run("Seguridad", async ({ check }) => {
  const h = (await fetch(BASE + "/entrar")).headers;
  check(
    "encabezados de seguridad",
    h.get("x-frame-options") === "DENY" &&
      h.get("x-content-type-options") === "nosniff" &&
      /frame-ancestors 'none'/.test(h.get("content-security-policy") ?? "") &&
      !!h.get("strict-transport-security") &&
      !!h.get("permissions-policy"),
  );
  // Códigos de invitación: 30 por minuto por conexión, aunque se invente la IP
  let last = 0;
  for (let i = 0; i < 32; i++) last = (await fetch(BASE + "/api/v1/invites/ABCD-EFGH", { headers: { "x-forwarded-for": `10.0.0.${i}, 9.9.9.9` } })).status;
  check("límite al probar códigos (inventar la IP no lo saltea)", last === 429, String(last));
  // Entrar: 30 por minuto por conexión, con emails distintos
  for (let i = 0; i < 32; i++)
    last = (
      await fetch(BASE + "/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `1.2.3.${i}, 8.8.8.8` },
        body: JSON.stringify({ email: `nadie${i}@test.local`, password: "x" }),
      })
    ).status;
  check("entrar: límite por conexión con muchas cuentas", last === 429, String(last));
});
