"use client";

import { useState } from "react";
import { catColor } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { CatIcon, todayAR } from "@/components/tx/parts";
import { daysInMonth, dueInfo, useObligations, type Obligation } from "./obligations";
import c from "./calendar.module.css";

const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WD_HEAD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WD_HEAD_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
const CARD_COLOR = "var(--blue)";

const dot = (o: Obligation) => (o.kind === "card" ? CARD_COLOR : catColor(o.categoryId ?? "otros"));

export function CalendarView() {
  const { month, isPastMonth, flash, setDebtSheet } = useShell();
  const { cards, bills, payBill, unpayBill } = useData();
  const obligations = useObligations(month);
  const today = todayAR();
  const isCurrent = today.startsWith(month);
  const [selected, setSelected] = useState<{ month: string; day: number }>({ month, day: isCurrent ? Number(today.slice(8)) : 1 });
  // Al cambiar de mes en el encabezado, la selección vuelve a hoy o al 1.
  const selDay = selected.month === month ? selected.day : isCurrent ? Number(today.slice(8)) : 1;

  if (!cards.length && !bills.length) return <EmptyState copy={EMPTY.cal!} />;

  const [y, m] = month.split("-").map(Number);
  const last = daysInMonth(month);
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes primero
  const prevLast = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const total = Math.ceil((offset + last) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => {
    const n = i - offset + 1;
    const inMonth = n >= 1 && n <= last;
    return { n: inMonth ? n : n < 1 ? prevLast + n : n - last, inMonth, events: inMonth ? obligations.filter((o) => o.day === n) : [] };
  });
  const todayN = isCurrent ? Number(today.slice(8)) : -1;
  const selEvents = obligations.filter((o) => o.day === selDay);
  const selDate = new Date(Date.UTC(y, m - 1, selDay));

  const toggle = async (o: Obligation) => {
    if (isPastMonth) return flash("En un mes pasado no se puede cargar nada.");
    const ok = o.paid ? await unpayBill(o.id, month) : await payBill(o.id, month);
    if (ok && !o.paid) flash(`${o.name} marcado como pagado`, "gasto");
  };

  return (
    <div className={c.wrap}>
      <section className={c.calendar} aria-label={`Calendario de ${MONTH_FULL[m - 1]}`}>
        <div className={c.head}>
          {WD_HEAD.map((d, i) => (
            <div key={d}>
              <span className={c.long}>{d}</span>
              <span className={c.short}>{WD_HEAD_SHORT[i]}</span>
            </div>
          ))}
        </div>
        <div className={c.grid}>
          {cells.map((cell, i) => (
            <button
              key={i}
              className={c.cell}
              data-out={!cell.inMonth}
              aria-pressed={cell.inMonth && cell.n === selDay}
              disabled={!cell.inMonth}
              onClick={() => setSelected({ month, day: cell.n })}
              aria-label={cell.inMonth ? `${cell.n} de ${MONTH_FULL[m - 1].toLowerCase()}${cell.events.length ? `, ${cell.events.length} vencimientos` : ""}` : undefined}
            >
              <span className={c.num} data-today={cell.inMonth && cell.n === todayN}>
                {cell.n}
              </span>
              {cell.events.slice(0, 3).map((e) => (
                <span key={e.key} className={c.event} data-paid={e.paid}>
                  <span className={c.dot} style={{ background: dot(e) }} />
                  <span className={c.eventName}>{e.name}</span>
                </span>
              ))}
              {cell.events.length > 3 && <span className={c.more}>+{cell.events.length - 3}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className={c.side}>
        <div className={c.sideTitle}>
          {WD[selDate.getUTCDay()]} {selDay} de {MONTH_FULL[m - 1].toLowerCase()}
        </div>
        {selEvents.map((o) => {
          const due = dueInfo(month, o.day, o.paid);
          return (
            <div key={o.key} className={c.item}>
              {o.kind === "card" ? (
                <span className={`${c.cardIcon} material-symbols-rounded`}>credit_card</span>
              ) : (
                <CatIcon id={o.categoryId ?? "otros"} />
              )}
              <button className={c.itemMain} onClick={() => setDebtSheet({ kind: o.kind, id: o.id })}>
                <span>{o.name}</span>
                <span style={{ color: due.color, fontSize: 12 }}>{due.label}</span>
              </button>
              <span className={c.itemAmount}>{formatMoney(o.amount, o.currency)}</span>
              {o.kind === "bill" && (
                <button className={c.pay} aria-pressed={o.paid} disabled={isPastMonth} onClick={() => toggle(o)} title={o.paid ? "Deshacer el pago" : "Marcar como pagado"}>
                  <span className="material-symbols-rounded">{o.paid ? "check_circle" : "radio_button_unchecked"}</span>
                </button>
              )}
            </div>
          );
        })}
        {!selEvents.length && <div className={c.empty}>Sin vencimientos este día.</div>}
      </section>
    </div>
  );
}
