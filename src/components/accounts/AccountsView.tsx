"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatMoney, maskAmountInput, parseAmount, toDecimal, toInput, type Currency } from "@/lib/money";
import { MONTH_FULL } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import type { AccountDto } from "@/lib/dto";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { AccountSheet } from "./AccountSheet";
import { ACCOUNT_KINDS, kindColor, kindTint } from "./kinds";
import a from "./accounts.module.css";

export function AccountsView() {
  const { user, month, accountFormOpen, setAccountFormOpen } = useShell();
  const { accounts, transactions, rate, toDisplay } = useData();
  const [openId, setOpenId] = useState<string | null>(null);

  const ars = (n: number, c: Currency) => (c === "USD" ? (rate ? n * rate : 0) : n);
  const totalArs = accounts.reduce((s, x) => s + ars(Number(x.balance), x.currency), 0);
  const sumCur = (c: Currency) => accounts.filter((x) => x.currency === c).reduce((s, x) => s + Number(x.balance), 0);
  const monthName = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();

  const flows = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const t of transactions) {
      if (!t.account_id || !t.date.startsWith(month)) continue;
      const f = map.get(t.account_id) ?? { in: 0, out: 0 };
      f[t.type] += Number(t.gross_amount);
      map.set(t.account_id, f);
    }
    return map;
  }, [transactions, month]);

  if (!accounts.length && !accountFormOpen) {
    return <EmptyState copy={EMPTY.acc!} />;
  }

  const usd = sumCur("USD");
  const open = accounts.find((x) => x.id === openId);

  return (
    <div className={a.wrap}>
      {accounts.length > 0 && (
        <div className={a.kpis}>
          <div className={`${a.card} ${a.kpi}`}>
            <span className={a.kpiLabel}>Total en cuentas</span>
            <span className={a.kpiValue}>{formatMoney(toDisplay(totalArs, "ARS"), user.display_currency)}</span>
            <span className={a.kpiSub}>
              {accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"}
            </span>
          </div>
          <div className={`${a.card} ${a.kpi}`}>
            <span className={a.kpiLabel}>En pesos</span>
            <span className={a.kpiValue}>{formatMoney(sumCur("ARS"), "ARS")}</span>
            <span className={a.kpiSub}>Bancos, billeteras y efectivo</span>
          </div>
          <div className={`${a.card} ${a.kpi}`}>
            <span className={a.kpiLabel}>En dólares</span>
            <span className={a.kpiValue} style={{ color: "var(--pos)" }}>
              {formatMoney(usd, "USD")}
            </span>
            <span className={a.kpiSub}>{rate ? `≈ ${formatMoney(usd * rate, "ARS")}` : "Cotización no disponible"}</span>
          </div>
        </div>
      )}

      <div className={a.grid}>
        {accounts.map((acc) => {
          const k = ACCOUNT_KINDS[acc.kind];
          const bal = Number(acc.balance);
          const share = totalArs > 0 ? Math.round((ars(bal, acc.currency) / totalArs) * 100) : 0;
          const f = flows.get(acc.id) ?? { in: 0, out: 0 };
          return (
            <button key={acc.id} className={`${a.card} ${a.account}`} onClick={() => setOpenId(acc.id)}>
              <div className={a.accHead}>
                <span className={`${a.accIcon} material-symbols-rounded`} style={{ background: kindTint(acc.kind), color: kindColor(acc.kind) }}>
                  {k.icon}
                </span>
                <span className={a.accName}>
                  <strong>{acc.name}</strong>
                  <span className={a.dim}>
                    {k.label} · {acc.currency === "USD" ? "dólares" : "pesos"}
                  </span>
                </span>
                <span className={`${a.chev} material-symbols-rounded`}>chevron_right</span>
              </div>
              <div className={a.balance}>
                <strong style={bal < 0 ? { color: "var(--red)" } : undefined}>{formatMoney(bal, acc.currency)}</strong>
                <span className={a.dim}>
                  {acc.currency === "USD" && rate ? `≈ ${formatMoney(bal * rate, "ARS")} · ` : ""}
                  {share}% de tu dinero
                </span>
              </div>
              <div className={a.flow}>
                <span style={{ color: "var(--pos)" }}>Entró {formatMoney(f.in, acc.currency)}</span>
                <span style={{ color: "var(--mut)" }}>
                  Salió {formatMoney(f.out, acc.currency)} en {monthName}
                </span>
              </div>
            </button>
          );
        })}
        {!accountFormOpen && (
          <button className={a.add} onClick={() => setAccountFormOpen(true)}>
            <span className="material-symbols-rounded">add_card</span>
            Agregar cuenta
          </button>
        )}
      </div>

      {accountFormOpen && <NewAccountForm onDone={() => setAccountFormOpen(false)} />}
      {accounts.length >= 2 && <TransferForm accounts={accounts} />}
      {open && <AccountSheet account={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function NewAccountForm({ onDone }: { onDone: () => void }) {
  const { flash } = useShell();
  const { createAccount } = useData();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountDto["kind"]>("banco");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [balance, setBalance] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr("Poné un nombre para la cuenta");
    setBusy(true);
    const ok = await createAccount({ name: name.trim(), kind, currency, balance: toDecimal(parseAmount(balance)) });
    setBusy(false);
    if (ok) {
      flash("Cuenta agregada", "ingreso");
      onDone();
    }
  };

  return (
    <form className={`${a.card} ${a.section}`} onSubmit={submit} noValidate>
      <span className={a.sectionTitle}>Nueva cuenta</span>
      <div className={a.fields}>
        <label className={a.field}>
          Nombre
          <input
            className={a.input}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr("");
            }}
            placeholder="Ej. Ualá, Brubank, Caja fuerte"
            maxLength={60}
            autoFocus
          />
        </label>
        <label className={a.field}>
          Tipo
          <select className={a.input} value={kind} onChange={(e) => setKind(e.target.value as AccountDto["kind"])}>
            {Object.entries(ACCOUNT_KINDS).map(([v, k]) => (
              <option key={v} value={v}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className={a.field}>
          Moneda
          <select className={a.input} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
        </label>
        <label className={a.field}>
          Saldo actual
          <input className={a.input} value={balance} onChange={(e) => setBalance(maskAmountInput(e.target.value))} inputMode="decimal" placeholder="0" />
        </label>
      </div>
      {err && <span className={a.error}>{err}</span>}
      <div className={a.buttons}>
        <button type="button" className={a.ghost} onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className={a.primary} disabled={busy}>
          {busy ? "Agregando…" : "Agregar cuenta"}
        </button>
      </div>
    </form>
  );
}

function TransferForm({ accounts }: { accounts: AccountDto[] }) {
  const { flash } = useShell();
  const { transfer, rate } = useData();
  const [from, setFrom] = useState(accounts[0].id);
  const [to, setTo] = useState(accounts[1].id);
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const A = accounts.find((x) => x.id === from) ?? accounts[0];
  const B = accounts.find((x) => x.id === to) ?? accounts[1];
  const cross = A.currency !== B.currency;
  const value = parseAmount(amount);

  // Entre monedas distintas, lo recibido se sugiere con la cotización elegida (y se puede corregir).
  const suggested = !cross || !rate || !value ? 0 : A.currency === "ARS" ? value / rate : value * rate;
  const receivedShown = receivedTouched ? received : suggested ? toInput(Math.round(suggested * 100) / 100) : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const got = parseAmount(receivedShown);
    if (!value || A.id === B.id || (cross && !got)) return flash("Elegí dos cuentas distintas y un monto");
    setBusy(true);
    const ok = await transfer({
      from_account_id: A.id,
      to_account_id: B.id,
      amount: toDecimal(value),
      ...(cross && { to_amount: toDecimal(got) }),
    });
    setBusy(false);
    if (ok) {
      flash(`Pasaste ${formatMoney(value, A.currency, { decimals: true })} a ${B.name}`);
      setAmount("");
      setReceived("");
      setReceivedTouched(false);
    }
  };

  return (
    <form className={`${a.card} ${a.section}`} onSubmit={submit} noValidate>
      <span className={a.sectionTitle}>Transferir entre cuentas</span>
      <span className={a.sectionSub}>No cuenta como gasto ni como ingreso.</span>
      <div className={a.xfer}>
        <label className={a.field}>
          Desde
          <select className={a.input} value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <span className={`${a.arrow} material-symbols-rounded`}>arrow_forward</span>
        <label className={a.field}>
          Hacia
          <select className={a.input} value={to} onChange={(e) => setTo(e.target.value)}>
            {accounts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className={`${a.field} ${a.amount}`}>
          Monto ({A.currency === "USD" ? "US$" : "$"})
          <input className={a.input} value={amount} onChange={(e) => setAmount(maskAmountInput(e.target.value))} inputMode="decimal" placeholder="0" />
        </label>
        {cross && (
          <label className={`${a.field} ${a.amount}`}>
            Recibís ({B.currency === "USD" ? "US$" : "$"})
            <input
              className={a.input}
              value={receivedShown}
              onChange={(e) => {
                setReceived(maskAmountInput(e.target.value));
                setReceivedTouched(true);
              }}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
        )}
        <button type="submit" className={a.primary} disabled={busy}>
          {busy ? "Transfiriendo…" : "Transferir"}
        </button>
      </div>
      {cross && rate && <span className={a.rateHint}>Sugerido con el dólar a {formatMoney(rate, "ARS")}. Podés corregirlo.</span>}
    </form>
  );
}
