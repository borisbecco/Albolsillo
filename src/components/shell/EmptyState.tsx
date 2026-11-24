"use client";

import { useRouter } from "next/navigation";
import { EMPTY, VIEWS, type EmptyAction, type EmptyCopy, type ViewId } from "@/lib/nav";
import { useShell } from "./ShellContext";
import e from "./empty.module.css";

const LATER: Record<Exclude<EmptyAction, "newTx" | "toDebts" | "newAccount" | "newCard" | "newBill" | "onboarding" | "newGoal" | "simulate">, string> = {
  import: "Importar resumen",
  newPerson: "Agregar contactos",
};

export function EmptyState({ copy }: { copy: EmptyCopy }) {
  const router = useRouter();
  const { openNewTx, setAccountFormOpen, setDebtSheet, flash, force } = useShell();

  const run = (a: EmptyAction) => {
    if (a === "newTx") return openNewTx();
    if (a === "onboarding") return router.push("/bienvenida");
    if (a === "newGoal") return force("goals");
    if (a === "simulate") return force("inv");
    if (a === "toDebts") return router.push(VIEWS.debts.href);
    if (a === "newCard" || a === "newBill") return setDebtSheet({ kind: a === "newCard" ? "card" : "bill", id: null });
    if (a === "newAccount") {
      setAccountFormOpen(true);
      return router.push(VIEWS.acc.href);
    }
    flash(`${LATER[a]} llega en un próximo paso.`);
  };

  return (
    <section className={e.box}>
      <div className={e.halo}>
        <span className={e.glow} />
        <span className={`${e.badge} material-symbols-rounded`}>{copy.icon}</span>
      </div>
      <h2 className={e.title}>{copy.title}</h2>
      <p className={e.text}>{copy.text}</p>
      <div className={e.actions}>
        <button className={e.primary} onClick={() => run(copy.cta.action)}>
          <span className="material-symbols-rounded">{copy.cta.icon}</span>
          {copy.cta.label}
        </button>
        {copy.cta2 && (
          <button className={e.secondary} onClick={() => run(copy.cta2!.action)}>
            <span className="material-symbols-rounded">{copy.cta2.icon}</span>
            {copy.cta2.label}
          </button>
        )}
      </div>
      {copy.tips && (
        <div className={e.tips}>
          {copy.tips.map((t) => (
            <div key={t.t} className={e.tip}>
              <span className="material-symbols-rounded">{t.icon}</span>
              <span>{t.t}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Estado vacío de una vista, con los textos del prototipo. */
export function ViewEmpty({ view }: { view: ViewId }) {
  const copy = EMPTY[view];
  return copy ? <EmptyState copy={copy} /> : null;
}
