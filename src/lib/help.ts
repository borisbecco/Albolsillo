// Textos de Ayuda y del recorrido guiado (HELP y TOUR del prototipo).
import type { ViewId } from "@/lib/nav";
import type { BolsiPose } from "@/components/shell/ShellContext";

export type TourStep = {
  view: ViewId;
  target: string;
  bolsi: BolsiPose;
  title: string;
  text: string;
};
export type HelpTopic = {
  id: string;
  name: string;
  icon: string;
  views: ViewId[];
  qs: [string, string][];
};

export const TOUR: TourStep[] = [
  {
    view: "dash",
    target: "hero",
    bolsi: "bienvenida",
    title: "Tu mes de un vistazo",
    text: "Acá ves cuánto entró, cuánto gastaste y cómo venís contra el mes pasado. Con las flechas cambiás de mes.",
  },
  {
    view: "dash",
    target: "add",
    bolsi: "gasto",
    title: "Cargá un gasto o un ingreso",
    text: "Tocá + desde cualquier pantalla (en la compu, también la tecla N). Elegís el monto, la categoría y con qué pagaste: cuenta, billetera o tarjeta de crédito.",
  },
  {
    view: "mov",
    target: "auto",
    bolsi: "cargando",
    title: "Que los gastos lleguen solos",
    text: "Reenviá los mails de pago de tu billetera o compartí el comprobante. Te los mostramos para que los confirmes antes de sumarlos.",
  },
  {
    view: "mov",
    target: "select",
    bolsi: "alerta",
    title: "Borrar es fácil",
    text: "Tocá el tachito de un movimiento, o Seleccionar para borrar varios juntos. Si te equivocás, tenés unos segundos para deshacer.",
  },
  {
    view: "plan",
    target: "plancard",
    bolsi: "meta",
    title: "Tu plan de pagos",
    text: "Calculamos cuánto pagar de cada tarjeta para que pagues menos interés. Cuando pagues, tocá Registrar pago: se descuenta de tu cuenta y el plan se actualiza.",
  },
  {
    view: "dash",
    target: "alerts",
    bolsi: "alerta",
    title: "Alertas",
    text: "Te avisamos antes de cada vencimiento, cuando te pasás de un presupuesto y cuando llegan gastos para revisar.",
  },
  {
    view: "dash",
    target: "help",
    bolsi: "bienvenida",
    title: "Si tenés dudas, tocá acá",
    text: "En Ayuda están las respuestas a lo más común. También podés volver a ver este recorrido cuando quieras.",
  },
];

export const HELP: HelpTopic[] = [
  {
    id: "start",
    name: "Para empezar",
    icon: "rocket_launch",
    views: ["dash"],
    qs: [
      [
        "¿Qué hace Albolsillo?",
        "Ordena tu plata del mes: lo que entra, lo que gastás, lo que debés en tarjetas y préstamos, y lo que ahorrás. Con eso te arma un plan para pagar las tarjetas con el menor interés posible.",
      ],
      [
        "¿Por dónde empiezo?",
        "Cargá tus ingresos, tarjetas y gastos fijos (si lo salteaste: Perfil › Volver a configurar). Después anotá los gastos a medida que ocurren o configurá la carga automática.",
      ],
      [
        "¿Qué muestra Inicio?",
        "Lo que entró y salió en el mes comparado con el mes anterior, tus últimos movimientos, los próximos vencimientos y cuánto pagar de cada tarjeta.",
      ],
    ],
  },
  {
    id: "mov",
    name: "Movimientos",
    icon: "receipt_long",
    views: ["mov", "acc"],
    qs: [
      [
        "¿Cómo cargo un gasto?",
        "Tocá + (o la tecla N en la compu). Poné el monto, elegí la categoría y con qué pagaste. Si lo dividís con alguien, elegí con quién y te queda registrado cuánto te deben.",
      ],
      [
        "¿Cómo borro un movimiento?",
        "Tocá el tachito a la derecha del movimiento. Para borrar varios, tocá Seleccionar en Movimientos, marcalos y tocá Eliminar. Después de borrar tenés unos segundos para tocar Deshacer.",
      ],
      [
        "¿Cómo corrijo un movimiento?",
        "Tocalo para abrirlo. Podés cambiar el monto, la fecha, la categoría, la cuenta y adjuntar el recibo.",
      ],
      [
        "¿Cómo cargo una compra con tarjeta de crédito?",
        "Al cargar el gasto, en “Pagado con” elegí la tarjeta y, si es en cuotas, cuántas. Cuenta como gasto (si es en cuotas, la cuota de cada mes) y lo ves en Plan como compra nueva de esa tarjeta. No descuenta plata de tus cuentas: eso pasa cuando registrás el pago del resumen.",
      ],
      [
        "¿Cómo funcionan las compras en dólares con tarjeta?",
        "Cargá el gasto en US$ y elegí la tarjeta: va al saldo en dólares del resumen, en un pago. Para el plan y los reportes lo convertimos al dólar del día. Al pagar, elegí Dólares y la cuenta en dólares de la que sale.",
      ],
      [
        "¿Qué pasa si borro una compra en cuotas?",
        "Si borrás la cuota 1, se borra la compra y se cancelan las cuotas que faltaban. Si borrás una cuota posterior, solo se borra esa. Tenés unos segundos para deshacer.",
      ],
      [
        "¿No se cuenta dos veces si cargo la compra y después pago la tarjeta?",
        "No. La compra cuenta como gasto y el pago del resumen no, porque solo mueve plata de tu cuenta a la tarjeta.",
      ],
    ],
  },
  {
    id: "plan",
    name: "Tarjetas y plan de pagos",
    icon: "credit_card",
    views: ["plan", "debts", "cal"],
    qs: [
      [
        "¿Cómo registro que pagué la tarjeta?",
        "En Plan, tocá Registrar pago en la tarjeta (o tocá la tarjeta en “Qué pagar este mes”, en Inicio). Elegí cuánto pagaste (lo recomendado, el mínimo o el total) y de qué cuenta salió. Se descuenta de esa cuenta y el plan se recalcula.",
      ],
      [
        "¿Por qué el pago de la tarjeta no cuenta como gasto?",
        "Porque las compras ya se contaron cuando las cargaste. Si también contáramos el pago, el mismo gasto aparecería dos veces.",
      ],
      [
        "¿Cómo se calcula el plan?",
        "A tus ingresos del mes les restamos lo que ya gastaste, los gastos fijos que faltan pagar y una reserva para gastos variables. Lo que queda va a las tarjetas: primero los mínimos y el resto según la estrategia que elegiste.",
      ],
      [
        "¿Qué hago cuando me llega el resumen nuevo?",
        "En Tarjetas y deudas, tocá Cargar resumen nuevo en la tarjeta y copiá el saldo, el mínimo y las fechas. Lo que habías pagado vuelve a cero y las cuotas sin interés avanzan un mes.",
      ],
      [
        "¿Cómo agrego o cambio una tarjeta?",
        "En Tarjetas y deudas, tocá Agregar tarjeta. Para cambiar los datos o borrarla, tocá el lápiz en la tarjeta.",
      ],
      [
        "¿Cómo cargo un préstamo?",
        "En Tarjetas y deudas › Préstamos, tocá Agregar préstamo. Poné la entidad, la cuota, cuántas cuotas son y cuántas ya pagaste. La cuota entra en el plan del mes.",
      ],
      [
        "¿Cómo registro la cuota de un préstamo?",
        "Tocá Pagar cuota en el préstamo (o en Pagos fijos pendientes del Plan) y elegí de qué cuenta salió. Cuenta como gasto en Préstamos y descuenta el saldo. Al empezar un mes nuevo, la cuota vuelve a quedar pendiente.",
      ],
      [
        "¿Qué estrategia me conviene?",
        "Menos interés paga primero la tarjeta con la tasa más alta: es la que menos te cuesta. Deuda más chica primero te saca deudas de encima más rápido. Por vencimiento sigue el orden de las fechas.",
      ],
    ],
  },
  {
    id: "auto",
    name: "Carga automática",
    icon: "bolt",
    views: ["mov"],
    qs: [
      [
        "¿Cómo hago que los gastos lleguen solos?",
        "En Movimientos › Carga automática configurá el reenvío de mails de tus billeteras y bancos, o compartí el comprobante desde la billetera con la app instalada en Android.",
      ],
      [
        "¿Por qué tengo que confirmar los gastos detectados?",
        "Porque la lectura automática puede equivocarse, y un mismo pago puede llegar por mail y por comprobante. Nada se suma sin que lo confirmes.",
      ],
      [
        "¿Cómo aprende las categorías?",
        "Si cambiás la categoría de un comercio en la bandeja, la usamos la próxima vez. Las ves y las borrás en Carga automática › Categorías aprendidas.",
      ],
    ],
  },
  {
    id: "goals",
    name: "Ahorro y metas",
    icon: "flag",
    views: ["goals", "inv", "budget"],
    qs: [
      [
        "¿Cómo funcionan las metas?",
        "Ponés cuánto querés juntar y para cuándo. Te decimos cuánto apartar por mes y, si te sobra plata en el plan, te sugerimos cuánto aportar.",
      ],
      [
        "¿Para qué sirven los presupuestos?",
        "Ponés un límite por categoría. Te avisamos cuando llegás al 80% y cuando te pasás.",
      ],
    ],
  },
  {
    id: "acct",
    name: "Cuenta y privacidad",
    icon: "manage_accounts",
    views: [],
    qs: [
      [
        "¿Cómo invito a alguien?",
        "En Perfil › Invitaciones. Tenés 5 invitaciones; cada link sirve para una persona.",
      ],
      [
        "¿Cómo exporto o borro mis datos?",
        "Para exportar: Movimientos › Exportar. Para borrar todo: Perfil › Eliminar cuenta.",
      ],
      [
        "¿Quién ve mis datos?",
        "Solo vos. Si dividís un gasto, las otras personas ven ese gasto. Más detalle en Perfil › Privacidad.",
      ],
    ],
  },
];
