import { EmptyState } from "@/components/shell/EmptyState";

// Provisorio: Inicio muestra "Primeros pasos" y el resumen del mes cuando estén las piezas.
export default function InicioPage() {
  return (
    <EmptyState
      copy={{
        icon: "waving_hand",
        title: "Armemos tu mes",
        text: "Contanos tus ingresos, tarjetas y gastos fijos y Bolsi arma tu plan de pagos. Mientras tanto, podés cargar tu primer movimiento.",
        cta: { label: "Armar mi plan", icon: "route", action: "onboarding" },
        cta2: { label: "Cargar movimiento", icon: "add", action: "newTx" },
      }}
    />
  );
}
