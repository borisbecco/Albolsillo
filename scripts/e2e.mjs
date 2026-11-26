// Pruebas de pantalla: arma la app, la levanta en el puerto 3123 contra la base de desarrollo,
// corre tests/e2e/*.e2e.mjs y al final borra los usuarios de prueba (@test.local).
//
//   npm run test:e2e                → build + todas
//   npm run test:e2e -- tarjetas    → solo las que tengan "tarjetas" en el nombre
//   npm run test:e2e -- --no-build  → usa el último build
//
// Necesita Google Chrome instalado (E2E_CHANNEL=msedge para usar Edge; E2E_HEADED=1 para verlo).
import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const PORT = 3123;
const BASE = `http://localhost:${PORT}`;
const args = process.argv.slice(2);
const filters = args.filter((a) => !a.startsWith("--"));
const dir = "tests/e2e";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl) {
  console.error("Falta DATABASE_URL en .env");
  process.exit(1);
}
if (process.env.PROD_DATABASE_URL && process.env.PROD_DATABASE_URL === dbUrl) {
  console.error("DATABASE_URL apunta a producción: las pruebas crean y borran usuarios, se corren solo contra desarrollo.");
  process.exit(1);
}

// La de seguridad agota los límites de intentos de entrar: va última.
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".e2e.mjs"))
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
  .sort((a, b) => (a.startsWith("seguridad") ? 1 : 0) - (b.startsWith("seguridad") ? 1 : 0) || a.localeCompare(b));
if (!files.length) {
  console.error("No hay pruebas que coincidan con", filters.join(", "));
  process.exit(1);
}

const up = () =>
  fetch(BASE + "/entrar")
    .then((r) => r.ok)
    .catch(() => false);

let server = null;
const stop = () => {
  if (!server) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill();
  server = null;
};

async function cleanup() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
  try {
    const { count } = await db.user.deleteMany({ where: { email: { endsWith: "@test.local" } } });
    console.log(`Usuarios de prueba borrados: ${count}`);
  } finally {
    await db.$disconnect();
  }
}

try {
  if (await up()) {
    console.log(`Ya hay algo corriendo en ${BASE}: lo uso (tiene que tener REGISTRATION_OPEN=1 e INBOX_DEV_ENDPOINT=1).`);
  } else {
    if (!args.includes("--no-build")) {
      const b = spawnSync("npm", ["run", "build"], { stdio: "inherit", shell: true });
      if (b.status !== 0) throw new Error("Falló el build");
    }
    server = spawn("npx", ["next", "start", "-p", String(PORT)], {
      shell: true,
      stdio: "ignore",
      env: { ...process.env, REGISTRATION_OPEN: "1", INBOX_DEV_ENDPOINT: "1" },
    });
    const t0 = Date.now();
    while (!(await up())) {
      if (Date.now() - t0 > 60_000) throw new Error("La app no arrancó en 60 s");
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const failed = [];
  for (const f of files) {
    const r = spawnSync(process.execPath, [`${dir}/${f}`], { stdio: "inherit", env: { ...process.env, E2E_BASE: BASE } });
    if (r.status !== 0) failed.push(f);
    console.log("");
  }
  console.log(failed.length ? `Fallaron ${failed.length} de ${files.length}: ${failed.join(", ")}` : `Pasaron las ${files.length} pruebas.`);
  process.exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  stop();
  await cleanup().catch((e) => console.error("No se pudieron borrar los usuarios de prueba:", e.message));
}
