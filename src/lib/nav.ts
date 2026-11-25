// Navegación: 4 secciones con sus vistas (README del handoff → "Navegación: 4 secciones").

export type ViewId = "dash" | "mov" | "acc" | "budget" | "plan" | "proj" | "goals" | "inv" | "shared" | "debts" | "cal" | "rep";
export type GroupId = "dia" | "gplan" | "deudas" | "analisis";

export type View = { id: ViewId; label: string; icon: string; href: string };
export type Group = { id: GroupId; label: string; short: string; icon: string; views: ViewId[] };

export const VIEWS: Record<ViewId, View> = {
  dash: { id: "dash", label: "Inicio", icon: "space_dashboard", href: "/" },
  mov: { id: "mov", label: "Movimientos", icon: "receipt_long", href: "/movimientos" },
  acc: { id: "acc", label: "Cuentas", icon: "account_balance", href: "/cuentas" },
  budget: { id: "budget", label: "Presupuesto", icon: "donut_large", href: "/presupuesto" },
  plan: { id: "plan", label: "Plan de pagos", icon: "task_alt", href: "/plan" },
  proj: { id: "proj", label: "Proyección", icon: "query_stats", href: "/proyeccion" },
  goals: { id: "goals", label: "Metas de ahorro", icon: "flag", href: "/metas" },
  inv: { id: "inv", label: "Inversiones", icon: "trending_up", href: "/inversiones" },
  shared: { id: "shared", label: "Gastos compartidos", icon: "group", href: "/compartidos" },
  debts: { id: "debts", label: "Tarjetas y deudas", icon: "credit_card", href: "/deudas" },
  cal: { id: "cal", label: "Vencimientos", icon: "calendar_month", href: "/vencimientos" },
  rep: { id: "rep", label: "Reportes", icon: "bar_chart", href: "/reportes" },
};

export const GROUPS: Group[] = [
  { id: "dia", label: "Día a día", short: "Día a día", icon: "home", views: ["dash", "mov", "acc", "budget"] },
  { id: "gplan", label: "Planificación", short: "Planificar", icon: "event_note", views: ["plan", "proj", "goals", "inv", "shared"] },
  { id: "deudas", label: "Deudas", short: "Deudas", icon: "credit_card", views: ["debts", "cal"] },
  { id: "analisis", label: "Análisis", short: "Análisis", icon: "bar_chart", views: ["rep"] },
];

export function viewFromPath(pathname: string): ViewId {
  const clean = pathname.replace(/\/$/, "") || "/";
  return (Object.values(VIEWS).find((v) => v.href === clean)?.id ?? "dash") as ViewId;
}

export const groupOf = (v: ViewId) => GROUPS.find((g) => g.views.includes(v)) ?? GROUPS[0];

/** Estados vacíos de cada vista (textos del prototipo). */
export type EmptyAction = "newTx" | "import" | "newAccount" | "onboarding" | "newGoal" | "simulate" | "newPerson" | "newCard" | "newBill" | "toDebts";

export type EmptyCopy = {
  icon: string;
  title: string;
  text: string;
  cta: { label: string; icon: string; action: EmptyAction };
  cta2?: { label: string; icon: string; action: EmptyAction };
  tips?: { icon: string; t: string }[];
};

export const EMPTY: Partial<Record<ViewId, EmptyCopy>> = {
  mov: {
    icon: "receipt_long",
    title: "Todavía no cargaste movimientos",
    text: "Cargá tu primer gasto o ingreso. También podés importar el resumen de tu tarjeta y traer todo el mes de una vez.",
    cta: { label: "Cargar movimiento", icon: "add", action: "newTx" },
    cta2: { label: "Importar resumen", icon: "upload_file", action: "import" },
    tips: [
      { icon: "bolt", t: "Tocá + o la tecla N desde cualquier pantalla." },
      { icon: "currency_exchange", t: "Podés cargar en pesos o dólares; convertimos con el dólar del día." },
      { icon: "group", t: "Si lo pagaste con alguien, dividilo al cargarlo." },
    ],
  },
  acc: {
    icon: "account_balance",
    title: "Agregá tus cuentas",
    text: "Banco, billetera virtual o efectivo. Con el saldo de cada una sabés cuánta plata tenés en total y de dónde sale cada gasto.",
    cta: { label: "Agregar cuenta", icon: "add_card", action: "newAccount" },
  },
  budget: {
    icon: "donut_large",
    title: "Tu presupuesto del mes",
    text: "Cuando cargues movimientos vas a ver cuánto gastaste en cada categoría contra lo que te propusiste.",
    cta: { label: "Cargar movimiento", icon: "add", action: "newTx" },
  },
  plan: {
    icon: "task_alt",
    title: "Tu plan de pagos aparece acá",
    text: "Necesitamos tus ingresos, tarjetas y gastos fijos para calcular cuánto pagar de cada cosa y cuánto te sobra.",
    cta: { label: "Armar mi plan", icon: "route", action: "onboarding" },
  },
  goals: {
    icon: "flag",
    title: "¿Para qué estás ahorrando?",
    text: "Un viaje, un fondo de emergencia, un auto. Poné el monto y la fecha, y te decimos cuánto apartar por mes.",
    cta: { label: "Crear meta", icon: "add", action: "newGoal" },
    tips: [
      { icon: "savings", t: "Fondo de emergencia: 3 a 6 meses de gastos fijos." },
      { icon: "attach_money", t: "Podés ahorrar en dólares y seguirlo a la cotización del día." },
    ],
  },
  inv: {
    icon: "trending_up",
    title: "Hacé que tu plata rinda",
    text: "Registrá tus plazos fijos, fondos o dólares para ver cuánto ganan frente a la inflación. O simulá uno antes de hacerlo.",
    cta: { label: "Simular plazo fijo", icon: "calculate", action: "simulate" },
  },
  shared: {
    icon: "group",
    title: "Dividí gastos sin hacer cuentas",
    text: "Agregá a las personas con las que compartís gastos. Si las invitás a Albolsillo, ven los mismos saldos que vos.",
    cta: { label: "Agregar contacto", icon: "person_add", action: "newPerson" },
  },
  debts: {
    icon: "credit_card",
    title: "Sumá tus tarjetas y gastos fijos",
    text: "Con el saldo, el mínimo y el vencimiento de cada tarjeta te avisamos antes de cada pago y armamos el plan del mes.",
    cta: { label: "Agregar tarjeta", icon: "add_card", action: "newCard" },
    cta2: { label: "Agregar gasto fijo", icon: "receipt", action: "newBill" },
  },
  cal: {
    icon: "calendar_month",
    title: "Sin vencimientos cargados",
    text: "Cuando agregues tarjetas, préstamos o gastos fijos, sus fechas de pago aparecen en el calendario.",
    cta: { label: "Ir a Tarjetas y deudas", icon: "credit_card", action: "toDebts" },
  },
  rep: {
    icon: "bar_chart",
    title: "Tus reportes se arman solos",
    text: "Cuando tengas movimientos cargados vas a ver en qué gastás, cómo viene tu ahorro y cuánto le gana tu gasto a la inflación.",
    cta: { label: "Cargar movimiento", icon: "add", action: "newTx" },
  },
};
