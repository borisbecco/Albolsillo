"use client";

import Link from "next/link";
import { cardFace, type BankId, type Network } from "@/lib/banks";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT, currentMonth } from "@/lib/month";
import { EMPTY, VIEWS } from "@/lib/nav";
import type { Strategy } from "@/lib/plan";
import { CardFace } from "@/components/cards/CardFace";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { dueInfo } from "@/components/debts/obligations";
import { useSummary } from "@/components/home/useSummary";
import { CatIcon } from "@/components/tx/parts";
import p from "./plan.module.css";

const STRATS: { id: Strategy; label: string; prio: string; icon: string; how: string }[] = [
  {
    id: "intereses",
    label: "Evitar intereses",
    prio: "Prioriza el vencimiento",
    icon: "event_available",
    how: "Después de cubrir todos los mínimos, el resto va a la tarjeta que vence primero, para pagarla completa y no generar interés este mes.",
  },
  {
    id: "avalancha",
    label: "Avalancha",
    prio: "Prioriza la tasa más alta",
    icon: "trending_down",
    how: "Después de los mínimos, el resto va a la tarjeta con la tasa (TNA) más alta. Es la forma de pagar menos interés en total.",
  },
  {
    id: "bola",
    label: "Bola de nieve",
    prio: "Prioriza el saldo más chico",
    icon: "ac_unit",
    how: "Después de los mínimos, el resto va a la tarjeta con el saldo más chico. Cerrás deudas más rápido y ganás motivación.",
  },
];

export function PlanView() {
  const { user, updatePrefs, flash } = useShell();
  const { cards, bills, loans, toDisplay, payBill, payLoan } = useData();
  const { plan, interest, income, C, pendingFixed, pendingBills, pendingLoans, reserve } = useSummary();
  const cur = user.display_currency;
  const fmt = (n: number) => formatMoney(toDisplay(n, "ARS"), cur);
  const month = currentMonth();
  const mShort = MONTH_SHORT[Number(month.slice(5)) - 1];

  if (!cards.length && !bills.length && !loans.length) return <EmptyState copy={EMPTY.plan!} />;

  const avoided = plan.rows.reduce((s, r) => s + r.avoidedInterest, 0);
  const paying = plan.rows.reduce((s, r) => s + r.nextInterest, 0);
  const best = Math.min(interest.intereses, interest.avalancha, interest.bola);
  const differs = new Set(Object.values(interest).map((v) => Math.round(v))).size > 1;
  const sel = STRATS.find((s) => s.id === user.pay_strategy) ?? STRATS[0];
  const bestLabel = STRATS.find((s) => interest[s.id] === best)?.label ?? "";
  const diff = interest[sel.id] - best;

  const flow = (
    [
      ["Ya gastado", C.out, "var(--dim)", "none"],
      ["Fijos pendientes", pendingFixed, "var(--deep)", "none"],
      ["Reserva variable", reserve, "color-mix(in oklch, var(--acc2) 55%, transparent)", "none"],
      ["Tarjetas", plan.cardsTotal, "var(--acc)", "0 0 16px -2px var(--acc)"],
      ["Sobrante", plan.leftover, "var(--pos)", "0 0 14px -4px var(--pos)"],
    ] as const
  ).filter((f) => f[1] > 0);
  const flowTotal = Math.max(income, flow.reduce((s, f) => s + f[1], 0)) || 1;

  const why = (r: (typeof plan.rows)[number]) =>
    sel.id === "avalancha" ? `TNA ${r.tna}%` : sel.id === "bola" ? fmt(r.balance) : `vence ${r.dueDay}`;
  const order = plan.rows;

  return (
    <div className={p.wrap}>
      <section className={p.hero}>
        <div className={p.heroGlow} />
        <div className={p.heroTop}>
          <div className={p.heroMain}>
            <span>Para tarjetas este mes</span>
            <strong style={{ color: plan.short ? "var(--red)" : "var(--fg)" }}>{fmt(Math.max(0, plan.available))}</strong>
          </div>
          <div className={p.badges}>
            <div className={p.badge} data-tone="pos">
              <span className="material-symbols-rounded">savings</span>
              <span>
                <small>Interés que evitás</small>
                <strong>{fmt(avoided)}</strong>
              </span>
            </div>
            <div className={p.badge} data-tone="red">
              <span className="material-symbols-rounded">local_fire_department</span>
              <span>
                <small>Interés que pagás</small>
                <strong>{fmt(paying)}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className={p.flow} role="img" aria-label="Cómo se reparte el ingreso del mes">
          {flow.map(([label, v, bg, sh]) => (
            <div key={label} title={`${label} · ${fmt(v)}`} style={{ width: `${(v / flowTotal) * 100}%`, background: bg, boxShadow: sh }} />
          ))}
        </div>
        <div className={p.flowLegend}>
          {flow.map(([label, v, bg]) => (
            <span key={label}>
              <i style={{ background: bg }} />
              <span>{label}</span>
              <strong>{fmt(v)}</strong>
            </span>
          ))}
        </div>
        {plan.short && (
          <div className={p.short} role="alert">
            <span className="material-symbols-rounded">warning</span>
            Faltan {fmt(plan.shortBy)} para cubrir los mínimos
          </div>
        )}
      </section>

      {plan.rows.length > 0 && (
        <>
          <div className={p.strats} role="radiogroup" aria-label="Estrategia de pago">
            {STRATS.map((s) => (
              <button key={s.id} className={p.strat} role="radio" aria-checked={user.pay_strategy === s.id} onClick={() => updatePrefs({ pay_strategy: s.id })}>
                <span className={`${p.stratIcon} material-symbols-rounded`}>{s.icon}</span>
                <span className={p.stratText}>
                  <strong>{s.label}</strong>
                  <span>{s.prio}</span>
                  <span style={{ color: interest[s.id] === best ? "var(--pos)" : "var(--fg)", fontWeight: 600 }}>
                    {interest[s.id] > 0.5 ? `~${fmt(interest[s.id])} de interés` : "Sin interés"}
                  </span>
                </span>
                {differs && interest[s.id] === best && <span className={p.best}>MENOS INTERÉS</span>}
              </button>
            ))}
          </div>

          <section className={p.how}>
            <div className={p.howHead}>
              <span className="material-symbols-rounded">lightbulb</span>
              <div>
                <strong>Con {sel.label}</strong>
                <p>{sel.how}</p>
              </div>
            </div>
            <div className={p.order}>
              {order.map((r, i) => (
                <span key={r.id} className={p.orderItem}>
                  <span className={p.orderChip}>
                    <span className={p.orderN} style={{ background: cardFace(r.name, (cards.find((c) => c.id === r.id)?.bank as BankId) ?? null, i).face }}>
                      {i + 1}
                    </span>
                    {r.name}
                    <span className={p.dim}>{why(r)}</span>
                  </span>
                  {i < order.length - 1 && <span className={`${p.arrow} material-symbols-rounded`}>arrow_forward</span>}
                </span>
              ))}
            </div>
            <div className={p.diff} style={{ color: diff > 0.5 ? "var(--amb)" : "var(--pos)" }}>
              {diff > 0.5 ? `Pagás ${fmt(diff)} más de interés que con ${bestLabel}` : "Es la opción con menos interés para tu situación"}
            </div>
          </section>

          <section className={p.block}>
            <div className={p.blockHead}>
              <span>Tus tarjetas, en este orden</span>
              <span className={p.mut}>{fmt(plan.cardsTotal)}</span>
            </div>
            <div className={p.cards}>
              {plan.rows.map((r, i) => {
                const c = cards.find((x) => x.id === r.id)!;
                const cover = r.balance > 0 ? Math.min(1, r.pay / r.balance) : 1;
                return (
                  <div key={r.id} className={p.cardCol}>
                    <div className={p.cardWrap}>
                      <CardFace
                        name={c.name}
                        bank={c.bank as BankId | null}
                        network={c.network as Network}
                        balance={r.balance}
                        last4={c.last4}
                        dueDay={c.due_day}
                        index={cards.indexOf(c)}
                        month={month}
                      />
                      <span className={p.idx}>{i + 1}</span>
                      <div className={p.payPill}>
                        <span>
                          <small>Pagar</small>
                          <strong>{fmt(r.pay)}</strong>
                        </span>
                        <span className={p.tag} style={{ color: r.tagColor, background: `color-mix(in oklch, ${r.tagColor} 18%, transparent)` }}>
                          {r.tag}
                        </span>
                      </div>
                    </div>
                    <div className={p.cover}>
                      <div className={p.coverTrack}>
                        <div style={{ width: `${cover * 100}%`, background: r.tagColor, boxShadow: `0 0 10px -2px ${r.tagColor}` }} />
                      </div>
                      <span>{cover >= 1 ? "Saldo completo" : `Cubre ${Math.round(cover * 100)}%`}</span>
                    </div>
                    <div className={p.note}>
                      {r.tag === "Pago total"
                        ? `Pagás el total y evitás ~${fmt(r.avoidedInterest)} de intereses`
                        : `Quedan ${fmt(r.left)} → ~${fmt(r.nextInterest)} de intereses el próximo mes`}
                      {` · vence ${c.due_day} ${mShort} · mínimo ${fmt(r.min)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className={p.block}>
        <div className={p.blockHead}>
          <span>Pagos fijos pendientes</span>
          <span className={p.mut}>{fmt(pendingFixed)}</span>
        </div>
        {pendingBills.length || pendingLoans.length ? (
          <div className={p.fixed}>
            {pendingBills.map((b) => {
              const due = dueInfo(month, b.due_day, false);
              return (
                <div key={b.id} className={p.fixedItem}>
                  <div className={p.fixedTop}>
                    <CatIcon id={b.category_id} />
                    <button
                      className={`${p.check} material-symbols-rounded`}
                      title="Marcar como pagado"
                      onClick={async () => (await payBill(b.id, month)) && flash(`${b.name} marcado como pagado`, "gasto")}
                    >
                      check
                    </button>
                  </div>
                  <span className={p.fixedName}>{b.name}</span>
                  <div className={p.fixedBottom}>
                    <strong>{formatMoney(Number(b.amount), b.currency)}</strong>
                    <span style={{ color: due.color }}>{due.label}</span>
                  </div>
                </div>
              );
            })}
            {pendingLoans.map((l) => {
              const due = dueInfo(month, l.due_day, false);
              return (
                <div key={l.id} className={p.fixedItem}>
                  <div className={p.fixedTop}>
                    <CatIcon id="prestamo" />
                    <button
                      className={`${p.check} material-symbols-rounded`}
                      title="Marcar la cuota como pagada"
                      onClick={async () => (await payLoan(l.id, month)) && flash(`Cuota de ${l.name} pagada`, "gasto")}
                    >
                      check
                    </button>
                  </div>
                  <span className={p.fixedName}>
                    {l.name} · {l.n + 1}/{l.of}
                  </span>
                  <div className={p.fixedBottom}>
                    <strong>{formatMoney(Number(l.installment), "ARS")}</strong>
                    <span style={{ color: due.color }}>{due.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={p.allPaid}>Todo pago este mes.</div>
        )}
      </section>

      <section className={p.leftover}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bolsi/bolsi-bienvenida.svg" alt="" width={52} height={57} />
        <div>
          <strong style={{ color: plan.short ? "var(--red)" : plan.leftover > 0 ? "var(--pos)" : "var(--fg)" }}>
            {plan.short ? "No alcanza para los mínimos" : plan.leftover > 0 ? `Te sobran ${fmt(plan.leftover)}` : "Todo va a tarjetas"}
          </strong>
          <span>
            {plan.short
              ? "Recortá gastos variables o usá ahorros para no entrar en mora."
              : plan.leftover > 0
                ? "Después de pagar todo. Podés apartarlo para una meta de ahorro."
                : "Este mes no queda sobrante."}
          </span>
        </div>
        {!plan.short && plan.leftover > 0 && (
          <Link href={VIEWS.goals.href} className={p.goalsBtn}>
            Ir a metas
          </Link>
        )}
      </section>
    </div>
  );
}
