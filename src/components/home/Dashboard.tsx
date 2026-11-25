"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { VIEWS } from "@/lib/nav";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { Activity } from "./Activity";
import { CardsCarousel } from "./CardsCarousel";
import { FirstSteps, useFirstSteps } from "./FirstSteps";
import { FxCard } from "./FxCard";
import { DetectedBanner } from "@/components/auto/DetectedBanner";
import { Hero } from "./Hero";
import { SalaryBanner } from "./SalaryBanner";
import { RecurringBanner } from "./RecurringBanner";
import { Numbers } from "./Numbers";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

/** Inicio: "Primeros pasos" hasta completar 3 de 5; después, el resumen del mes. */
export function Home() {
  const { done } = useFirstSteps();
  return done < 3 ? (
    <div className={h.wrap}>
      <SalaryBanner />
      <RecurringBanner />
      <FirstSteps />
    </div>
  ) : (
    <Dashboard />
  );
}

function Dashboard() {
  const { user } = useShell();
  const { toDisplay } = useData();
  const { plan } = useSummary();
  return (
    <div className={h.wrap}>
      <DetectedBanner />
      <SalaryBanner />
      <RecurringBanner />
      <Hero />
      <div className={h.row2} style={{ alignItems: "center" }}>
        <CardsCarousel />
        <FxCard />
      </div>
      <Numbers />
      {plan.short && (
        <Link href={VIEWS.plan.href} className={h.shortAlert} role="alert">
          <span className="material-symbols-rounded">warning</span>
          El dinero libre no alcanza para cubrir los mínimos de tarjetas (faltan {formatMoney(toDisplay(plan.shortBy, "ARS"), user.display_currency)}). Revisá el plan de pagos.
        </Link>
      )}
      <Activity />
    </div>
  );
}
