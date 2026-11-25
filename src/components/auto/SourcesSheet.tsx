"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { useData } from "@/components/data/DataContext";
import { Logo } from "@/components/shell/Logo";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import a from "./auto.module.css";
import { Bolsi } from "@/components/bolsi/Bolsi";

type Source = { id: string; kind: "forward" | "share"; address: string | null; status: "pending" | "active"; last_received_at: string | null };
type SourcesRes = { sources: Source[]; wallets: { name: string; domain: string }[]; gmail_filter: string; android_waitlist: boolean };
type Rule = { id: string; merchant_label: string; category_id: string };

/** "hace 2 h", "hace 5 min", "hace 3 días". */
function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type InstallEvent = Event & { prompt: () => Promise<void> };

/** Carga automática: fuentes (reenvío de mails, compartir comprobante, importar, Android), guía y espera. */
export function SourcesSheet() {
  const { autoSheet, setAutoSheet, flash, setImportFor } = useShell();
  const { shareReceipt, detected } = useData();
  const [data, setData] = useState<SourcesRes | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [conf, setConf] = useState<{ code: string | null; link: string | null; last_received_at: string | null } | null>(null);
  const [shareHelp, setShareHelp] = useState(false);
  const [allWallets, setAllWallets] = useState(false);
  const [uploading, setUploading] = useState(false);
  const installEvt = useRef<InstallEvent | null>(null);
  const close = useCallback(() => setAutoSheet(null), [setAutoSheet]);
  const fwd = data?.sources.find((s) => s.kind === "forward") ?? null;
  const step = autoSheet;

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api<SourcesRes>("/sources"), api<{ rules: Rule[] }>("/merchant-rules")]);
    setData(s);
    setRules(r.rules);
  }, []);

  useEffect(() => {
    Promise.all([api<SourcesRes>("/sources"), api<{ rules: Rule[] }>("/merchant-rules")])
      .then(([s, r]) => {
        setData(s);
        setRules(r.rules);
      })
      .catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installEvt.current = e as InstallEvent;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  // Guía: crea (o trae) la dirección y consulta cada 3 s si llegó el código de Gmail.
  useEffect(() => {
    if (step !== "forward" && step !== "waiting") return;
    let stop = false;
    if (step === "forward" && !address) {
      api<{ address: string }>("/sources/forward", { method: "POST" })
        .then((r) => !stop && setAddress(r.address))
        .catch((e) => flash(e instanceof ApiClientError ? e.message : "No pudimos crear tu dirección.", "errorguardar"));
    }
    const poll = () =>
      api<{ code: string | null; link: string | null; last_received_at: string | null }>("/sources/forward/confirmation")
        .then((r) => !stop && setConf(r))
        .catch(() => {});
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [step, address, flash]);

  // Esperando el primer mail: apenas aparece un gasto detectado, se abre la bandeja.
  useEffect(() => {
    if (step === "waiting" && (detected.length > 0 || conf?.last_received_at)) setAutoSheet("detected");
  }, [step, detected.length, conf?.last_received_at, setAutoSheet]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const d = await shareReceipt(file, file.name);
    setUploading(false);
    if (d) {
      flash("Leímos el comprobante. Revisalo en Gastos detectados.", "gasto");
      setAutoSheet("detected");
    }
  };

  const disable = async () => {
    if (!fwd) return;
    await api(`/sources/${fwd.id}`, { method: "DELETE" }).catch(() => {});
    setAddress(null);
    flash("Desactivamos el reenvío");
    void load();
  };

  const toggleAndroid = async () => {
    const on = !data?.android_waitlist;
    await api("/sources/notify-android", { method: "POST", body: JSON.stringify({ on }) }).catch(() => {});
    setData((d) => d && { ...d, android_waitlist: on });
    if (on) flash("Te avisamos cuando esté");
  };

  const forget = async (id: string) => {
    await api(`/merchant-rules/${id}`, { method: "DELETE" }).catch(() => {});
    setRules((l) => l.filter((r) => r.id !== id));
  };

  const addr = address ?? fwd?.address ?? "";
  const code = conf?.code ? conf.code.replace(/(\d{3})(?=\d)/g, "$1 ") : null;
  const title = step === "forward" ? "Reenvío de mails" : step === "waiting" ? "Esperando tus mails" : "Carga automática";

  return (
    <div className={t.backdrop} onClick={close} style={{ zIndex: 34 }}>
      <div className={`${t.sheet} ${a.sheet}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          {step !== "sources" && (
            <button className={`${t.close} material-symbols-rounded`} title="Volver" onClick={() => setAutoSheet("sources")}>
              arrow_back
            </button>
          )}
          <span className={a.title}>{title}</span>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={close}>
            close
          </button>
        </div>

        {step === "sources" && (
          <>
            <span className={a.lead}>Elegí de dónde tomamos tus gastos. Antes de sumarlos a tus cuentas te los mostramos para que los confirmes.</span>

            <section className={a.card}>
              <div className={a.cardHead}>
                <span className={`${a.cardIcon} material-symbols-rounded`}>mail</span>
                <span className={a.cardText}>
                  <strong>Reenvío de mails</strong>
                  <span>Reenviás a Albolsillo los avisos de pago de billeteras y bancos. Funciona con cualquier proveedor de mail.</span>
                </span>
                {fwd?.status === "active" && <span className={a.on}>Activo</span>}
              </div>
              {!fwd || fwd.status !== "active" ? (
                <button className={a.primary} onClick={() => setAutoSheet("forward")}>
                  <span className="material-symbols-rounded">forward_to_inbox</span>
                  {fwd ? "Seguir configurando" : "Configurar reenvío"}
                </button>
              ) : (
                <>
                  <div className={a.addrBox}>
                    <span>Tu dirección de reenvío</span>
                    <strong className="mono">{fwd.address}</strong>
                    {fwd.last_received_at && <small>Último mail recibido {ago(fwd.last_received_at)}</small>}
                  </div>
                  <div className={a.row}>
                    <button className={a.ghost} onClick={() => setAutoSheet("forward")}>
                      Ver guía
                    </button>
                    <button className={a.ghost} onClick={disable}>
                      Desactivar
                    </button>
                  </div>
                </>
              )}
              {data && (
                <>
                  <span className={a.small}>Reconocemos mails de</span>
                  <div className={a.chips}>
                    {(allWallets ? data.wallets : data.wallets.slice(0, 12)).map((w) => (
                      <span key={w.name} className={a.chip}>
                        <Logo domain={w.domain} icon="account_balance" size={20} />
                        {w.name}
                      </span>
                    ))}
                    {data.wallets.length > 12 && (
                      <button className={a.chip} onClick={() => setAllWallets(!allWallets)} style={{ cursor: "pointer" }}>
                        {allWallets ? "Ver menos" : `+${data.wallets.length - 12} más`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className={a.card}>
              <div className={a.cardHead}>
                <span className={`${a.cardIcon} material-symbols-rounded`}>ios_share</span>
                <span className={a.cardText}>
                  <strong>Compartir comprobante</strong>
                  <span>Desde la billetera tocás Compartir y elegís Albolsillo. Leemos el monto, el comercio y la fecha.</span>
                </span>
              </div>
              <div className={a.row}>
                <label className={a.primary} aria-disabled={uploading}>
                  <span className="material-symbols-rounded">upload</span>
                  {uploading ? "Leyendo…" : "Subir comprobante"}
                  <input type="file" accept="image/*,.pdf" hidden disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} />
                </label>
                <button
                  className={a.ghost}
                  onClick={async () => {
                    if (installEvt.current) {
                      await installEvt.current.prompt();
                      installEvt.current = null;
                      return;
                    }
                    setShareHelp((v) => !v);
                  }}
                >
                  <span className="material-symbols-rounded">install_mobile</span>
                  Instalar en Android
                </button>
              </div>
              {shareHelp && (
                <ol className={a.steps}>
                  <li>Abrí Albolsillo en Chrome.</li>
                  <li>Tocá el menú ⋮ y elegí Instalar app.</li>
                  <li>En Mercado Pago, Ualá o tu banco, abrí el comprobante, tocá Compartir y elegí Albolsillo.</li>
                </ol>
              )}
              <span className={a.small}>En iPhone, guardá el comprobante y subilo desde acá.</span>
            </section>

            <button
              className={a.linkRow}
              onClick={() => {
                close();
                setImportFor({ cardId: null });
              }}
            >
              <span className="material-symbols-rounded">upload_file</span>
              <span className={a.cardText}>
                <strong>Importar resumen</strong>
                <span>PDF de tu tarjeta</span>
              </span>
              <span className="material-symbols-rounded">chevron_right</span>
            </button>

            <section className={a.card}>
              <div className={a.cardHead}>
                <span className={`${a.cardIcon} material-symbols-rounded`}>notifications</span>
                <span className={a.cardText}>
                  <strong>
                    Detectar desde notificaciones <em className={a.soon}>Próximamente en Android</em>
                  </strong>
                  <span>Con la app de Android vamos a tomar el aviso de pago apenas llega, sin esperar el mail.</span>
                </span>
              </div>
              <button className={a.ghost} data-on={!!data?.android_waitlist} onClick={toggleAndroid}>
                <span className="material-symbols-rounded">{data?.android_waitlist ? "check" : "notifications_active"}</span>
                {data?.android_waitlist ? "Te vamos a avisar" : "Avisame cuando esté"}
              </button>
            </section>

            {rules.length > 0 && (
              <section className={a.card}>
                <div className={a.cardText}>
                  <strong>Categorías aprendidas</strong>
                  <span>Cuando cambiás la categoría de un comercio en la bandeja, la usamos la próxima vez.</span>
                </div>
                <div className={a.rules}>
                  {rules.map((r) => (
                    <div key={r.id} className={a.rule}>
                      <span>{r.merchant_label}</span>
                      <span className="material-symbols-rounded">arrow_forward</span>
                      <span>{CATEGORY_BY_ID[r.category_id]?.name ?? r.category_id}</span>
                      <button className="material-symbols-rounded" title="Olvidar" onClick={() => forget(r.id)}>
                        delete
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {step === "forward" && (
          <>
            <span className={a.lead}>No le pedimos acceso a tu casilla. Vos elegís qué mails nos reenviás.</span>
            <div className={a.addrBox}>
              <span>Tu dirección de reenvío</span>
              <div className={a.copyRow}>
                <strong className="mono">{addr || "…"}</strong>
                <button className={a.copy} disabled={!addr} onClick={async () => flash((await copy(addr)) ? "Dirección copiada" : addr)}>
                  <span className="material-symbols-rounded">content_copy</span>Copiar
                </button>
              </div>
            </div>
            <section className={a.step}>
              <span className={a.num}>1</span>
              <div className={a.cardText}>
                <strong>Agregá la dirección en Gmail</strong>
                <span>Configuración › Ver toda la configuración › Reenvío y correo POP/IMAP › Agregar una dirección de reenvío. Pegá tu dirección.</span>
              </div>
            </section>
            <section className={a.step}>
              <span className={a.num}>2</span>
              <div className={a.cardText}>
                <strong>Confirmá con el código</strong>
                <span>Gmail nos manda un código a esa dirección. Te lo mostramos acá para que lo pegues en Gmail, o confirmalo directo con el botón.</span>
                {code && (
                  <div className={a.copyRow}>
                    <strong className={`mono ${a.code}`}>{code}</strong>
                    <button className={a.copy} onClick={async () => flash((await copy(conf!.code!)) ? "Código copiado" : conf!.code!)}>
                      <span className="material-symbols-rounded">content_copy</span>Copiar
                    </button>
                  </div>
                )}
                {conf?.link && (
                  <a className={a.confirmLink} href={conf.link} target="_blank" rel="noopener noreferrer">
                    <span className="material-symbols-rounded">open_in_new</span>
                    Confirmar en Gmail
                  </a>
                )}
                {code || conf?.link ? null : (
                  <div className={a.waiting}>
                    <span className={a.spinner} />
                    Esperando el código de Gmail…
                  </div>
                )}
              </div>
            </section>
            <section className={a.step}>
              <span className={a.num}>3</span>
              <div className={a.cardText}>
                <strong>Creá un filtro</strong>
                <span>Pegá esto en el buscador de Gmail, tocá el ícono de filtros › Crear filtro › Reenviarlo a, y elegí tu dirección.</span>
                <div className={a.copyRow}>
                  <strong className={`mono ${a.filter}`}>{data?.gmail_filter}</strong>
                  <button className={a.copy} onClick={async () => data && flash((await copy(data.gmail_filter)) ? "Filtro copiado" : data.gmail_filter)}>
                    <span className="material-symbols-rounded">content_copy</span>Copiar
                  </button>
                </div>
              </div>
            </section>
            <span className={a.small}>Outlook, Yahoo y otros proveedores también tienen reglas de reenvío automático. Usá la misma dirección y la lista de remitentes.</span>
            <button className={t.primary} onClick={() => (fwd?.status === "active" ? setAutoSheet("sources") : setAutoSheet("waiting"))}>
              Listo, ya lo configuré
            </button>
          </>
        )}

        {step === "waiting" && (
          <div className={a.wait}>
            <Bolsi pose="cargando" width={96} height={105} />
            <strong>Esperando tus mails</strong>
            <span>Apenas llegue un aviso de pago reenviado, lo vas a ver en Gastos detectados.</span>
          </div>
        )}
      </div>
    </div>
  );
}
