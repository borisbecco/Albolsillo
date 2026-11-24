"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT, currentMonth } from "@/lib/month";
import { VIEWS } from "@/lib/nav";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { dueInfo, useObligations } from "@/components/debts/obligations";
import { CatIcon, todayAR } from "@/components/tx/parts";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

/** Recientes / Próximos vencimientos y "Qué pagar este mes". */
export function Activity() {
  const { month, user, setDetailId, setDebtSheet } = useShell();
  const { transactions, toDisplay } = useData();
  const { plan, pendingFixed } = useSummary();
  const [tab, setTab] = useState<"recent" | "upcoming">("recent");
  const cur = user.display_currency;
  const nowMonth = currentMonth();
  const today = Number(todayAR().slice(8));

  const recent = transactions.filter((t) => t.date.startsWith(month)).slice(0, 6);
  const obligations = useObligations(nowMonth);
  const upcoming = obligations.filter((o) => !o.paid && o.day >= today).slice(0, 6);
  const urgent = obligations.filter((o) => !o.paid && o.day - today <= 7).length;

  return (
    <div className={h.row2} style={{ alignItems: "start" }}>
      <section className={h.listPanel}>
        <div className={h.listHead}>
          <div className={h.tabs} role="tablist">
            <button role="tab" aria-selected={tab === "recent"} onClick={() => setTab("recent")}>
              Recientes
            </button>
            <button role="tab" aria-selected={tab === "upcoming"} onClick={() => setTab("upcoming")}>
              Próximos
              {urgent > 0 && <span className={h.tabBadge}>{urgent}</span>}
            </button>
          </div>
          <Link href={tab === "recent" ? VIEWS.mov.href : VIEWS.cal.href} className={h.more}>
            {tab === "recent" ? "Ver todos" : "Calendario"}
          </Link>
        </div>
        {tab === "recent" ? (
          <div className={h.fade} key="recent">
            {recent.map((t) => (
              <button key={t.id} className={h.item} onClick={() => setDetailId(t.id)}>
                <CatIcon id={t.category_id} />
                <span className={h.itemName}>{t.description}</span>
                <span className={h.itemDate}>
                  {Number(t.date.slice(8))} {MONTH_SHORT[Number(t.date.slice(5, 7)) - 1]}
                </span>
                <span className={h.itemAmount} style={{ color: t.type === "in" ? "var(--pos)" : "var(--fg)" }}>
                  {t.type === "in" ? "+" : "−"}
                  {formatMoney(Number(t.amount), t.currency)}
                </span>
              </button>
            ))}
            {!recent.length && <div className={h.emptyList}>Sin movimientos en este mes.</div>}
          </div>
        ) : (
          <div className={h.fade} key="upcoming">
            {upcoming.map((o) => {
              const d = dueInfo(nowMonth, o.day, o.paid);
              return (
                <button key={o.key} className={h.item} onClick={() => setDebtSheet({ kind: o.kind, id: o.id })}>
                  {o.kind === "card" ? <span className={`${h.cardIcon} material-symbols-rounded`}>credit_card</span> : <CatIcon id={o.categoryId ?? "otros"} />}
                  <span className={h.itemName}>{o.name}</span>
                  <span className={h.itemDate} style={{ color: d.color }}>
                    {d.label}
                  </span>
                  <span className={h.itemAmount}>{formatMoney(o.amount, o.currency)}</span>
                </button>
              );
            })}
            {!upcoming.length && <div className={h.emptyList}>Nada por vencer en lo que queda del mes.</div>}
          </div>
        )}
      </section>

      <section className={h.listPanel}>
        <div className={h.listHead}>
          <strong>Qué pagar este mes</strong>
          <Link href={VIEWS.plan.href} className={h.more}>
            Ver plan →
          </Link>
        </div>
        {plan.rows.map((r) => (
          <div key={r.id} className={h.planRow}>
            <span className={h.itemName}>{r.name}</span>
            <span className={h.planTag} style={{ color: r.tagColor }}>
              {r.tag}
            </span>
            <span className={h.itemAmount}>{formatMoney(toDisplay(r.pay, "ARS"), cur)}</span>
          </div>
        ))}
        {!plan.rows.length && <div className={h.emptyList}>Sin tarjetas con saldo a pagar.</div>}
        <div className={h.planFoot}>
          <span>Obligaciones fijas pendientes</span>
          <strong>{formatMoney(toDisplay(pendingFixed, "ARS"), cur)}</strong>
        </div>
      </section>
    </div>
  );
}
