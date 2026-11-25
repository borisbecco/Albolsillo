"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { BankId, Network } from "@/lib/banks";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT, currentMonth } from "@/lib/month";
import { VIEWS } from "@/lib/nav";
import { CardFace } from "@/components/cards/CardFace";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { useSummary } from "./useSummary";
import h from "./dashboard.module.css";

/** "Mis tarjetas": carrusel con snap, puntos y lo que conviene pagar de la tarjeta activa. */
export function CardsCarousel() {
  const { user, setDebtSheet } = useShell();
  const { cards, toDisplay } = useData();
  const { plan } = useSummary();
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const month = currentMonth();

  const goTo = (i: number) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActive(i);
  };

  const onScroll = () => {
    const t = track.current;
    if (!t) return;
    const center = t.scrollLeft + t.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    Array.from(t.children).forEach((c, i) => {
      const el = c as HTMLElement;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    if (best !== active) setActive(best);
  };

  // Sin tarjetas: un recuadro punteado del tamaño de una tarjeta que abre el alta.
  if (!cards.length) {
    return (
      <section className={h.cardsBlock}>
        <div className={h.blockHead}>
          <span className={h.blockTitle}>Mis tarjetas</span>
        </div>
        <button className={h.addCardBox} onClick={() => setDebtSheet({ kind: "card", id: null })}>
          <span className="material-symbols-rounded">add_card</span>
          Agregar tarjeta
          <small>Con el saldo y el vencimiento te decimos cuánto pagar de cada una</small>
        </button>
      </section>
    );
  }

  const c = cards[Math.min(active, cards.length - 1)];
  const row = plan.rows.find((r) => r.id === c.id);
  const single = cards.length === 1;
  const mShort = MONTH_SHORT[Number(month.slice(5)) - 1];
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), user.display_currency);
  // Estado del resumen: cuánto se pagó del total, dónde está el mínimo y cuánto falta.
  const total = row ? (row.done ? row.balance : row.balance + row.paid) : Number(c.balance);
  const paid = row?.paid ?? 0;
  const owed = Math.max(0, total - paid);
  const minimum = Number(c.min_payment);
  const pct = (v: number) => `${Math.min(100, (v / Math.max(1, total)) * 100).toFixed(1)}%`;

  const face = (card: (typeof cards)[number], i: number) => (
    <CardFace
      name={card.name}
      bank={card.bank as BankId | null}
      network={card.network as Network}
      balance={Number(card.balance)}
      usd={Number(card.balance_usd)}
      last4={card.last4}
      dueDay={card.due_day}
      index={i}
      month={month}
    />
  );

  const status = (
    <div className={h.cardStatus} data-single={single}>
      <div className={h.statusTop}>
        <span>
          Cierra el {c.close_day} · Vence {c.due_day} {mShort}
        </span>
        {row && (
          <span className={h.statusTag} style={{ color: row.tagColor }}>
            {row.tag}
          </span>
        )}
      </div>
      <div className={h.statusPaid}>
        Pagaste <strong>{fmt(paid)}</strong> de {fmt(total)}
      </div>
      <div className={h.statusTrack}>
        <div style={{ width: pct(paid) }} />
        {minimum > 0 && <span title="Pago mínimo" style={{ left: pct(minimum) }} />}
      </div>
      <div className={h.statusFoot}>
        <span>Mínimo {fmt(minimum)}</span>
        <span>{owed > 0 ? `Falta ${fmt(owed)}` : "Resumen pagado"}</span>
      </div>
      {single && (
        <button className={h.statusPay} onClick={() => setDebtSheet({ kind: "cardpay", id: c.id })}>
          {owed > 0 ? "Registrar pago" : "Registrar otro pago"}
        </button>
      )}
    </div>
  );

  return (
    <section className={h.cardsBlock}>
      <div className={h.blockHead}>
        <span className={h.blockTitle}>Mis tarjetas</span>
        <Link href={VIEWS.debts.href} className={h.more}>
          Ver todas
        </Link>
      </div>
      {single ? (
        <div className={h.singleCard}>
          <div className={h.singleFace} onClick={() => setDebtSheet({ kind: "card", id: c.id })}>
            {face(c, 0)}
          </div>
          {status}
        </div>
      ) : (
        <>
          <div className={h.carouselWrap}>
            <button className={`${h.carArrow} ${h.left} material-symbols-rounded`} title="Tarjeta anterior" disabled={active === 0} onClick={() => goTo(active - 1)}>
              chevron_left
            </button>
            <button
              className={`${h.carArrow} ${h.right} material-symbols-rounded`}
              title="Tarjeta siguiente"
              disabled={active >= cards.length - 1}
              onClick={() => goTo(active + 1)}
            >
              chevron_right
            </button>
            <div className={h.track} ref={track} onScroll={onScroll}>
              {cards.map((card, i) => (
                <div key={card.id} className={h.slide} data-active={i === active} onClick={() => (i === active ? setDebtSheet({ kind: "card", id: card.id }) : goTo(i))}>
                  {face(card, i)}
                </div>
              ))}
            </div>
          </div>
          <div className={h.dots}>
            {cards.map((card, i) => (
              <button key={card.id} className={h.dot} data-active={i === active} title={card.name} onClick={() => goTo(i)} />
            ))}
          </div>
          {status}
        </>
      )}
    </section>
  );
}
