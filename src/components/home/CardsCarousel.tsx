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

  if (!cards.length) {
    return (
      <section className={h.cardsBlock}>
        <div className={h.blockHead}>
          <span className={h.blockTitle}>Mis tarjetas</span>
        </div>
        <button className={h.noCards} onClick={() => setDebtSheet({ kind: "card", id: null })}>
          <span className="material-symbols-rounded">add_card</span>
          Sumá tus tarjetas para ver qué pagar de cada una
        </button>
      </section>
    );
  }

  const c = cards[Math.min(active, cards.length - 1)];
  const row = plan.rows.find((r) => r.id === c.id);

  return (
    <section className={h.cardsBlock}>
      <div className={h.blockHead}>
        <span className={h.blockTitle}>Mis tarjetas</span>
        <Link href={VIEWS.debts.href} className={h.more}>
          Ver todas
        </Link>
      </div>
      <div className={h.carouselWrap}>
        {cards.length > 1 && (
          <>
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
          </>
        )}
        <div className={h.track} ref={track} onScroll={onScroll}>
          {cards.map((card, i) => (
            <div key={card.id} className={h.slide} data-active={i === active} onClick={() => (i === active ? setDebtSheet({ kind: "card", id: card.id }) : goTo(i))}>
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
            </div>
          ))}
        </div>
      </div>
      {cards.length > 1 && (
        <div className={h.dots}>
          {cards.map((card, i) => (
            <button key={card.id} className={h.dot} data-active={i === active} title={card.name} onClick={() => goTo(i)} />
          ))}
        </div>
      )}
      <div className={h.chips}>
        <span className={h.chipStrong}>
          <span>Pagar este mes</span>
          <strong>{formatMoney(toDisplay(row?.pay ?? Number(c.min_payment), "ARS"), user.display_currency)}</strong>
        </span>
        {row && (
          <span className={h.chip} style={{ color: row.tagColor, fontWeight: 600 }}>
            {row.tag}
          </span>
        )}
        {row && row.paid > 0 && (
          <span className={h.chip}>
            Pagaste {formatMoney(toDisplay(row.paid, "ARS"), user.display_currency)} · falta {formatMoney(toDisplay(row.done ? 0 : row.balance, "ARS"), user.display_currency)}
          </span>
        )}
        <span className={h.chip}>
          Vence {c.due_day} {MONTH_SHORT[Number(month.slice(5)) - 1]}
        </span>
      </div>
    </section>
  );
}
