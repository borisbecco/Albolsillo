// Configuración de Prisma 7: dónde está el schema, las migraciones, el seed y la base.
import { defineConfig } from "prisma/config";

// Prisma 7 ya no lee el .env solo. En Railway no hay .env: las variables vienen del servicio.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Vacío al armar la app sin base (prisma generate no la necesita).
    url: process.env.DATABASE_URL ?? "",
  },
});
