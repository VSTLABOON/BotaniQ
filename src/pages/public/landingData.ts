import {
  Wallet, Clock, CalendarHeart, Globe, Store, Truck,
  Sprout, ClipboardList, Scissors, Flower2, type LucideIcon,
} from 'lucide-react';

// ── HERO ──
export const HERO = {
  badge: 'Más de 120 florerías en México ya cobran por adelantado',
  headline: 'Asegura el pago antes de tocar la tijera.',
  sub: 'Comadre, ya no andes batallando cargando cubetas a las 4 AM en la Central para que luego te dejen colgada con un ramo de $850 que nadie recogió. Con BotaniQ tus clientes te pagan por transferencia o tarjeta desde su celular. Asegura tu flor y tu trabajo antes de armar.',
  cta: 'Crear mi tienda',
  ctaSecondary: 'Ver una tienda de florería real →',
  trust: ['Sin plazos forzosos', 'Lista en 10 minutos', 'Tú controlas tus precios'],
};

// ── FEATURES PER PLAN (carousel inside each plan) ──
export type PlanFeature = { icon: LucideIcon; title: string; desc: string };

export const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  basico: [
    { icon: Flower2, title: 'Tu catálogo para fechas especiales', desc: 'Sube tus bouquets de 12 o 24 rosas y comparte el link por WhatsApp. Deja de mandar fotos una por una en plena temporada.' },
    { icon: Scissors, title: 'Menos preguntas, más armado de ramos', desc: 'Tus clientes ven los precios de las coronas y arreglos fúnebres al instante. Tú te enfocas en que el diseño de los lirios quede perfecto.' },
    { icon: ClipboardList, title: 'Adiós a los pedidos perdidos en el chat', desc: 'Cada encargo llega con nombre, calle y dedicatoria. No más confusiones de si el cliente quería astromelias o gerberas.' },
  ],
  pro: [
    { icon: Wallet, title: 'Cobra el anticipo antes de tocar la tijera', desc: 'Tus clientes pagan con tarjeta o transferencia al momento. Se acabó eso de armar un arreglo de $1,200 para que nunca pasen por él y la flor termine en el bote de basura.' },
    { icon: Clock, title: 'Encargos de última hora bajo control', desc: 'Alguien olvida un aniversario a medianoche. Tu tienda recibe el pago de las rosas y tú solo llegas a armar el bouquet en la mañana.' },
    { icon: CalendarHeart, title: 'Aguanta el caos del 10 de Mayo', desc: 'Recibe 50 pedidos de tulipanes en una hora sin que tu WhatsApp se trabe. Todo organizado por hora de entrega en tu panel.' },
    { icon: Store, title: 'Tu equipo sabe qué flores comprar', desc: 'Tus ayudantes ven desde su celular cuántas docenas de rosas se necesitan para los compromisos del fin de semana. Menos vueltas a la Central.' },
    { icon: Sprout, title: 'Invierte en la flor que sí se vende', desc: '¿Se venden más los girasoles o los arreglos mixtos? Mira tus ventas reales y deja de tirar dinero comprando flor que nadie pide.' },
  ],
  premium: [
    { icon: Truck, title: 'Reparto ordenado para el Día de Muertos', desc: 'Asigna las rutas de tus repartidores. Tus clientes ven por dónde va su corona de flores en tiempo real. Menos llamadas de "¿ya mero llega?".' },
    { icon: Globe, title: 'Tu marca propia: www.tufloreria.com', desc: 'Eleva el ticket promedio de tus arreglos de Navidad y Bodas con un dominio personalizado que dé confianza absoluta a clientes de ticket alto.' },
  ],
};

// ── PRICING ──
export const PRICING = [
  {
    key: 'basico', level: 'Nivel 1', name: 'BotaniQ Esencia', price: '$400', period: '/mes',
    yearPrice: '$4,000', yearSave: '$800',
    desc: 'Ideal para florerías locales que quieren dejar de mandar PDFs por WhatsApp cada que cambia el precio de la docena.',
    roi: 'Asegura que tus clientes vean tus arreglos de temporada actualizados sin que tú tengas que enviar fotos todo el día.',
    features: [
      { texto: 'Catálogo digital con fotos de tus ramos', proximamente: false },
      { texto: 'Pedidos directos a tu WhatsApp', proximamente: false },
      { texto: 'Libreta de control en el celular', proximamente: false },
      { texto: 'Sin comisiones ocultas', proximamente: false }
    ],
    color: 'from-gray-500/20 to-gray-400/5', accent: 'text-gray-300', border: 'border-white/5',
    glow: 'group-hover:shadow-[0_0_40px_rgba(156,163,175,0.15)]',
  },
  {
    key: 'pro', level: 'Nivel 2', name: 'BotaniQ Alquimia', price: '$900', period: '/mes',
    yearPrice: '$9,000', yearSave: '$1,800',
    desc: 'Perfecto para asegurar tus ventas de graduaciones y XV años cobrando por adelantado con tarjeta o transferencia.',
    roi: 'Evita que la flor se eche a perder: si el cliente ya pagó su arreglo de $1,500, tu ganancia ya está en el banco.',
    features: [
      { texto: 'Todo lo del Básico', proximamente: false },
      { texto: 'Cobro seguro con tarjeta o transferencia', proximamente: false },
      { texto: 'Avisos de pago al instante', proximamente: false },
      { texto: 'Acceso para hasta 3 ayudantes', proximamente: false },
      { texto: 'Soporte para picos de venta del 10 de Mayo', proximamente: false }
    ],
    color: 'from-violet-500/30 to-fuchsia-500/10', accent: 'text-violet-400', border: 'border-violet-500/30',
    glow: 'group-hover:shadow-[0_0_60px_rgba(139,92,246,0.25)]', popular: true,
  },
  {
    key: 'premium', level: 'Nivel 3', name: 'BotaniQ Edén', price: '$1,300', period: '/mes',
    yearPrice: '$13,000', yearSave: '$2,600',
    desc: 'Para florerías con alto volumen de pedidos a domicilio y eventos corporativos de fin de año.',
    roi: 'Optimiza tus rutas de entrega en San Valentín y ahorra en gasolina y tiempo de tus repartidores.',
    features: [
      { texto: 'Todo lo del Pro', proximamente: false },
      { texto: 'Pantalla para tus repartidores', proximamente: true },
      { texto: 'Rutas de entrega en el celular', proximamente: true },
      { texto: 'Dominio personalizado incluido', proximamente: false },
      { texto: 'Comisiones bajas preferenciales', proximamente: false }
    ],
    color: 'from-amber-500/30 to-orange-500/10', accent: 'text-amber-400', border: 'border-amber-500/20',
    glow: 'group-hover:shadow-[0_0_60px_rgba(245,158,11,0.2)]',
  },
];

// ── TESTIMONIALS ──
export const TESTIMONIALS = [
  { 
    name: 'Martha Elena Ruiz', 
    city: 'CDMX', 
    quote: 'El 14 de febrero pasado terminé llorando de coraje. Me quedaron como 20 ramos de rosas ya armados que los clientes me encargaron pero nunca pasaron a recoger. Perdí casi $15,000 pesos en flor que se marchitó y tiempo de mis ayudantes.', 
    color: 'bg-fuchsia-600' 
  },
  { 
    name: 'Guadalupe Santos', 
    city: 'Monterrey, N.L.', 
    quote: 'El 10 de Mayo pasado se me trabó el celular y, por un error de WhatsApp al restaurar la copia de seguridad, se me borraron los chats de la mañana. Perdimos dos pedidos de clientes de años y les quedamos mal. La vergüenza de fallarle a gente que confía en ti es lo que más te duele como dueña.', 
    color: 'bg-violet-600' 
  },
  { 
    name: 'Javier Méndez', 
    city: 'Guadalajara, Jal.', 
    quote: 'Para las graduaciones anotaba todo en hojas sueltas. Al final se nos mojó la libreta en la mesa de armado y perdimos dos direcciones de entrega. Tuvimos que andar adivinando a quién le tocaba cada centro de mesa.', 
    color: 'bg-emerald-600' 
  },
];

// ── SAFETY NET ──
export const SAFETY = {
  title: '¿Y si no llega el dinero?',
  sub: 'Tu dinero es sagrado para nosotros. Sabemos lo que cuesta cada tallo.',
  items: [
    { q: '¿Qué pasa si mi cliente dice que sí pagó pero no aparece en mi panel?', a: 'Revisamos la transferencia o el cargo de inmediato. Si el banco del cliente rechazó la tarjeta por falta de fondos, te avisamos de inmediato para que no gastes flor ni tiempo en un pedido que no está firme.' },
    { q: '¿Y si se cae la página justo el 10 de Mayo?', a: 'Nuestros servidores están preparados para recibir miles de visitas simultáneas. Tu tienda va a aguantar el tráfico pesado de las fechas fuertes mejor que cualquier grupo de WhatsApp.' },
    { q: '¿Cómo sé que el pago por tarjeta es seguro?', a: 'Usamos Stripe, el sistema de cobros más seguro del mundo. El dinero de tus arreglos va directo de la tarjeta de tu cliente a tu cuenta bancaria en 48 horas sin trucos.' },
    { q: '¿Qué hago si un cliente me reclama una devolución?', a: 'Tú tienes el control total. Desde tu panel puedes hacer devoluciones parciales o totales si, por ejemplo, no hubo la flor específica que el cliente quería y acordaron un cambio.' },
  ],
};

// ── FAQS ──
export const FAQS = [
  { q: '¿Cuánto me cobran por cada venta con tarjeta?', a: 'En el plan Pro y Premium, la comisión es de [3.6% + $3 MXN] más IVA por cada venta cobrada. No hay cargos por pedidos rechazados o cancelados. El dinero llega a tu banco automáticamente.' },
  { q: '¿Puedo aceptar pedidos personalizados o solo productos fijos?', a: 'Ambos. Puedes subir ramos con opciones (ej: 12, 24 o 36 rosas) o dejar un botón de "Pedido Especial" donde tú acuerdas el precio final con el cliente por WhatsApp antes de que él pague en la página.' },
  { q: '¿Aguanta el tráfico del 10 de mayo?', a: 'Totalmente. Está diseñada para que entren 200 pedidos en una mañana sin que tú tengas que anotar nada. Los pedidos se organizan solitos por hora de entrega y zona.' },
  { q: '¿Mis clientes que prefieren pagar en efectivo al recibir pueden seguir haciéndolo?', a: 'Sí. Puedes dejar activa la opción de "Pedido por WhatsApp" para esos clientes de toda la vida que prefieren pagarte en el local o al momento de la entrega.' },
  { q: '¿Qué pasa si subo mal el precio de un arreglo?', a: 'Lo corriges desde tu celular en 5 segundos. Si el precio de la nube o el follaje subió hoy en la Central, entras a tu panel y actualizas tus precios al instante para no perder margen.' },
  { q: '¿Qué pasa si mi cliente quiere pagar por transferencia?', a: 'El sistema le da tus datos de transferencia automáticamente. En cuanto el dinero cae, el pedido se marca como "Pagado" en tu panel para que empieces a armar el arreglo con confianza.' },
];
