"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID, catColor } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL, MONTH_SHORT } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import { useData, type Tx } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { ACCOUNT_KINDS } from "@/components/accounts/kinds";
import { ExportMenu } from "./ExportMenu";
import { TxIcon, todayAR } from "./parts";
import m from "./movements.module.css";
import { Bolsi } from "@/components/bolsi/Bolsi";

const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
type TypeFilter = "all" | "out" | "in";

function dayLabel(ymd: string) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const wd = WD[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${wd} ${d} ${MONTH_SHORT[mo - 1]}${ymd === todayAR() ? " · Hoy" : ""}`;
}

export function MovementsView() {
  const { month, user, setDetailId, movAccount, setMovAccount, setAutoSheet } = useShell();
  const { transactions, accounts, toDisplay, deleteTxs, detected } = useData();
  const accFilter = accounts.find((x) => x.id === movAccount) ?? null;
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [cat, setCat] = useState("all");
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSel = () => {
    setSelMode(false);
    setSel(new Set());
  };
  const removeSelected = async () => {
    const ids = [...sel];
    exitSel();
    await deleteTxs(ids);
  };

  const inMonth = useMemo(
    () => transactions.filter((t) => t.date.startsWith(month)),
    [transactions, month],
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inMonth.filter(
      (t) =>
        (!accFilter || t.account_id === accFilter.id) &&
        (type === "all" || t.type === type) &&
        (cat === "all" || t.category_id === cat) &&
        (!needle ||
          t.description.toLowerCase().includes(needle) ||
          CATEGORY_BY_ID[t.category_id]?.name.toLowerCase().includes(needle)),
    );
  }, [inMonth, q, type, cat, accFilter]);

  const cur = user.display_currency;
  const sumOf = (list: Tx[], ty: "in" | "out") =>
    list
      .filter((t) => t.type === ty)
      .reduce((s, t) => s + toDisplay(Number(t.amount), t.currency), 0);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()].map(([date, rows]) => ({
      date,
      rows,
      net: rows.reduce(
        (s, t) =>
          s +
          (t.type === "in" ? 1 : t.type === "out" ? -1 : 0) *
            toDisplay(Number(t.amount), t.currency),
        0,
      ),
    }));
  }, [filtered, toDisplay]);

  if (!transactions.length) return <EmptyState copy={EMPTY.mov!} />;

  if (!inMonth.length) {
    const name = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();
    return (
      <EmptyState
        copy={{
          ...EMPTY.mov!,
          title: `Sin movimientos en ${name}`,
          text: "Cambiá de mes arriba o cargá un gasto de este mes.",
          cta2: undefined,
          tips: undefined,
        }}
      />
    );
  }

  return (
    <div className={m.wrap}>
      <div className={m.toolbar}>
        <label className={m.search}>
          <span className="material-symbols-rounded">search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar movimiento o comercio"
            aria-label="Buscar"
          />
        </label>
        <div className={m.typeSeg} role="group" aria-label="Tipo">
          {(
            [
              ["all", "Todos"],
              ["out", "Gastos"],
              ["in", "Ingresos"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              aria-pressed={type === v}
              onClick={() => setType(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          className={m.exportBtn}
          data-tour="select"
          aria-pressed={selMode}
          style={
            selMode
              ? {
                  borderColor: "var(--acc)",
                  background:
                    "color-mix(in oklch, var(--acc) 12%, var(--panel))",
                }
              : undefined
          }
          onClick={() => (selMode ? exitSel() : setSelMode(true))}
        >
          <span className="material-symbols-rounded">
            {selMode ? "close" : "checklist"}
          </span>
          {selMode ? "Cancelar" : "Seleccionar"}
        </button>
        <button className={m.exportBtn} data-tour="auto" onClick={() => setAutoSheet(detected.length ? "detected" : "sources")}>
          <span className="material-symbols-rounded" style={{ color: "var(--acc)" }}>
            bolt
          </span>
          Carga automática
          {detected.length > 0 && <span className={m.autoCount}>{detected.length}</span>}
        </button>
        <ExportMenu
          query={{
            type: type === "all" ? undefined : type,
            category: cat === "all" ? undefined : cat,
            q: q.trim() || undefined,
            account: accFilter?.id,
          }}
        />
      </div>

      {accFilter && (
        <div>
          <button
            className={m.accFilter}
            onClick={() => setMovAccount(null)}
            title="Quitar filtro"
          >
            <span className="material-symbols-rounded">
              {ACCOUNT_KINDS[accFilter.kind].icon}
            </span>
            {accFilter.name}
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
      )}

      <div className={m.cats} role="group" aria-label="Categoría">
        {[{ id: "all", name: "Todas", icon: "apps" }, ...CATEGORIES].map(
          (c) => (
            <button
              key={c.id}
              className={m.catChip}
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
            >
              <span
                className={`${m.catDot} material-symbols-rounded`}
                style={
                  cat === c.id
                    ? undefined
                    : { color: c.id === "all" ? "var(--acc2)" : catColor(c.id) }
                }
              >
                {c.icon}
              </span>
              {c.name}
            </button>
          ),
        )}
      </div>

      <div className={m.summary}>
        <div className={m.kpi}>
          <span>Movimientos</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className={m.kpi}>
          <span>Ingresos</span>
          <strong style={{ color: "var(--pos)" }}>
            {formatMoney(sumOf(filtered, "in"), cur)}
          </strong>
        </div>
        <div className={m.kpi}>
          <span>Gastos</span>
          <strong>{formatMoney(sumOf(filtered, "out"), cur)}</strong>
        </div>
      </div>

      <section className={m.list}>
        {groups.map((g) => (
          <div key={g.date}>
            <div className={m.dayHead}>
              <span>{dayLabel(g.date)}</span>
              <span className={m.dayTotal}>
                {formatMoney(g.net, cur, { sign: true })}
              </span>
            </div>
            {g.rows.map((t) => (
              <div
                key={t.id}
                className={m.rowWrap}
                data-selected={selMode && sel.has(t.id)}
              >
                <button
                  className={m.row}
                  onClick={() =>
                    selMode ? toggleSel(t.id) : setDetailId(t.id)
                  }
                  aria-pressed={selMode ? sel.has(t.id) : undefined}
                >
                  {selMode && (
                    <input
                      type="checkbox"
                      className={m.check}
                      checked={sel.has(t.id)}
                      readOnly
                      tabIndex={-1}
                      aria-hidden
                    />
                  )}
                  {t.type === "card_payment" ? (
                    <span
                      className={`${m.cardPayIcon} material-symbols-rounded`}
                    >
                      credit_card
                    </span>
                  ) : (
                    <TxIcon categoryId={t.category_id} domain={t.merchant_domain} />
                  )}
                  <span className={m.rowMain}>
                    <span className={m.rowDesc}>{t.description}</span>
                    <span className={m.rowCat}>
                      {t.type === "card_payment"
                        ? "Pago de tarjeta · no es gasto"
                        : CATEGORY_BY_ID[t.category_id]?.name}
                      {t.recurring ? "  ↻" : ""}
                    </span>
                  </span>
                  {t.status !== "synced" && (
                    <span
                      className={`material-symbols-rounded ${m.status}`}
                      data-status={t.status}
                      title={
                        t.status === "failed"
                          ? "No se pudo guardar"
                          : "Guardando…"
                      }
                    >
                      {t.status === "failed" ? "cloud_off" : "schedule"}
                    </span>
                  )}
                  <span
                    className={m.rowAmount}
                    style={{
                      color:
                        t.type === "in"
                          ? "var(--pos)"
                          : t.type === "card_payment"
                            ? "var(--mut)"
                            : "var(--fg)",
                    }}
                  >
                    {t.type === "in" ? "+" : "−"}
                    {formatMoney(Number(t.amount), t.currency)}
                  </span>
                </button>
                {!selMode && (
                  <button
                    className={`${m.trash} material-symbols-rounded`}
                    title="Eliminar"
                    aria-label={`Eliminar ${t.description}`}
                    onClick={() => void deleteTxs([t.id])}
                  >
                    delete
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
        {!groups.length && (
          <div className={m.noResults}>
            <Bolsi pose="bienvenida" width={72} height={79} />
            <span>No hay movimientos con estos filtros.</span>
          </div>
        )}
      </section>

      {selMode && (
        <div className={m.selBar} role="toolbar" aria-label="Eliminar varios">
          <span>
            {sel.size
              ? `${sel.size} ${sel.size === 1 ? "seleccionado" : "seleccionados"}`
              : "Tocá los que querés borrar"}
          </span>
          <button className={m.selCancel} onClick={exitSel}>
            Cancelar
          </button>
          <button
            className={m.selDelete}
            disabled={!sel.size}
            onClick={removeSelected}
          >
            <span className="material-symbols-rounded">delete</span>
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
