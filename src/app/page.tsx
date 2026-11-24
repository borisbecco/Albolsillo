import Image from "next/image";

// Pantalla provisoria: confirma que la base (tokens, fuentes, íconos, marca) está bien montada.
export default function Home() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--gutter)" }}>
      <div className="card" style={{ maxWidth: 420, textAlign: "center", display: "grid", gap: 16, justifyItems: "center" }}>
        <Image src="/brand/logo-horizontal-oscuro.svg" alt="Albolsillo" width={200} height={48} priority />
        <Image src="/bolsi/bolsi-bienvenida.svg" alt="" width={120} height={120} />
        <p style={{ color: "var(--mut)", margin: 0 }}>
          <span className="material-symbols-rounded" style={{ verticalAlign: "middle", color: "var(--pos)" }}>
            check_circle
          </span>{" "}
          Proyecto listo. Bolsi te banca.
        </p>
      </div>
    </main>
  );
}
