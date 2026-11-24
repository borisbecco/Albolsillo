"use client";

import { useRouter } from "next/navigation";
import { VIEWS } from "@/lib/nav";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import f from "./firststeps.module.css";

type Step = { done: boolean; icon: string; title: string; sub: string; go: () => void };

/** Los 5 primeros pasos y cuántos están hechos. */
export function useFirstSteps() {
  const router = useRouter();
  const { month, openNewTx, setAccountFormOpen, setOnboardingStep } = useShell();
  const { transactions, accounts, cards, bills, budgets } = useData();

  const steps: Step[] = [
    {
      done: transactions.some((t) => t.date.startsWith(month)),
      icon: "add",
      title: "Cargá tu primer gasto",
      sub: "O un ingreso. Tocá + desde cualquier pantalla.",
      go: openNewTx,
    },
    {
      done: accounts.length > 0,
      icon: "account_balance",
      title: "Agregá tus cuentas",
      sub: "Banco, billetera o efectivo.",
      go: () => {
        setAccountFormOpen(true);
        router.push(VIEWS.acc.href);
      },
    },
    {
      done: cards.length > 0 || bills.length > 0,
      icon: "credit_card",
      title: "Sumá tarjetas y gastos fijos",
      sub: "Para avisarte antes de cada vencimiento.",
      go: () => {
        setOnboardingStep(1);
        router.push("/bienvenida");
      },
    },
    // Metas se marca cuando esté su pantalla.
    { done: budgets.some((b) => b.month === month), icon: "donut_large", title: "Poné un límite por categoría", sub: "Te avisamos al llegar al 80%.", go: () => router.push(VIEWS.budget.href) },
    { done: false, icon: "flag", title: "Creá una meta de ahorro", sub: "Te decimos cuánto apartar por mes.", go: () => router.push(VIEWS.goals.href) },
  ];
  return { steps, done: steps.filter((s) => s.done).length };
}

/** "Primeros pasos" de Inicio (se reemplaza por el resumen del mes cuando estén 3 de 5). */
export function FirstSteps() {
  const { user } = useShell();
  const { steps, done } = useFirstSteps();
  const firstName = user.name.split(" ")[0] || "hola";

  return (
    <section className={f.box}>
      <div className={f.head}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bolsi/bolsi-bienvenida.svg" alt="" width={60} height={66} className={f.bolsi} />
        <div className={f.headText}>
          <h2>Hola, {firstName}. Arranquemos.</h2>
          <p>Con estos pasos Albolsillo ya puede armarte el plan del mes.</p>
        </div>
        <div className={f.progress}>
          <span>
            {done} de {steps.length}
          </span>
          <div className={f.track}>
            <div className={f.fill} style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className={f.list}>
        {steps.map((s) => (
          <button key={s.title} className={f.step} data-done={s.done} onClick={s.go}>
            <span className={`${f.icon} material-symbols-rounded`}>{s.done ? "check" : s.icon}</span>
            <span className={f.text}>
              <strong>{s.title}</strong>
              <span>{s.sub}</span>
            </span>
            {!s.done && <span className={`${f.arrow} material-symbols-rounded`}>chevron_right</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
