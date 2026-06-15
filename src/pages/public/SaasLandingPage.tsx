import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { 
  Rocket, ArrowRight, CheckCircle2, ChevronDown, 
  Instagram, Twitter, Globe, ArrowUpRight, Lock, 
  Sparkles, Check, ChevronLeft, ChevronRight, Flower
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { HERO, PLAN_FEATURES, PRICING, TESTIMONIALS, SAFETY, FAQS } from './landingData';

/* ── Liquid Glass Card Component ── */
const GlassCard = ({ children, className = '', ...props }: any) => (
  <div className={`liquid-glass rounded-3xl ${className}`} {...props}>
    {children}
  </div>
);

/* ── Custom Video Component with Smooth Fade In/Out Loop ── */
function CrossfadeVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animFrame: number;
    
    const fadeIn = () => {
      let start: number | null = null;
      const duration = 500;
      
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / duration, 1);
        setOpacity(progress);
        if (progress < 1) {
          animFrame = requestAnimationFrame(animate);
        }
      };
      animFrame = requestAnimationFrame(animate);
    };

    const fadeOut = () => {
      let start: number | null = null;
      const duration = 500;
      const initialOpacity = video.style.opacity ? parseFloat(video.style.opacity) : 1;
      
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / duration, 1);
        setOpacity(initialOpacity * (1 - progress));
        if (progress < 1) {
          animFrame = requestAnimationFrame(animate);
        }
      };
      animFrame = requestAnimationFrame(animate);
    };

    const handleCanPlay = () => {
      video.play().catch(() => {});
      fadeIn();
    };

    const handleTimeUpdate = () => {
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.55 && opacity === 1) {
        fadeOut();
      }
    };

    const handleEnded = () => {
      setOpacity(0);
      setTimeout(() => {
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {});
          fadeIn();
        }
      }, 100);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-300"
      style={{ opacity }}
      muted
      autoPlay
      playsInline
      preload="auto"
    />
  );
}

/* ── FAQ Accordion Item ── */
function AccordionItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      viewport={{ once: true }} 
      transition={{ delay: index * 0.08 }}
      className="bg-white/80 border border-[#526243]/10 rounded-2xl overflow-hidden mb-3 shadow-sm"
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-6 text-left cursor-pointer">
        <span className="text-sm md:text-base font-semibold text-[#526243] pr-4">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-4 h-4 text-[#526243]/70 shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            transition={{ duration: 0.25 }}
          >
            <div className="px-6 pb-6 text-xs md:text-sm text-[#1F241C]/85 font-medium leading-relaxed border-t border-[#526243]/10 pt-4">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── About Component merged into Hero ── */

/* ── Featured Video Component ── */
function FeaturedVideoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-[#F8F6F2] py-16 md:py-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
          transition={{ duration: 0.9 }}
          className="relative rounded-3xl overflow-hidden min-h-[480px] md:min-h-0 md:aspect-video w-full border border-[#526243]/10 shadow-2xl"
        >
          <img 
            src="/el_proceso_mockup.png" 
            alt="Cómo funciona el cobro y notificación de ramos en BotaniQ" 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8F6F2]/90 via-transparent to-transparent pointer-events-none" />
          
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
            <div className="p-6 md:p-8 max-w-md bg-white/90 backdrop-blur-md rounded-3xl border border-[#526243]/10 shadow-lg">
              <span className="text-[#526243] text-[10px] font-bold tracking-widest uppercase mb-3 block">Cómo funciona</span>
              <p className="text-[#1F241C] text-xs md:text-sm leading-relaxed font-medium">
                Mira qué fácil: le mandas el link de tu catálogo a tu cliente. Entran desde su celular, eligen las flores, escriben la dedicatoria y te pagan ahí mismo. A ti te llega la notificación con todos los datos y la hora exacta de entrega. Se acabaron los datos a medias o las capturas borrosas de WhatsApp.
              </p>
            </div>
            <motion.a 
              href="#precios"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-gradient-to-r from-[#526243] to-[#ffd7db] text-[#1F241C] font-bold rounded-full px-8 py-3.5 text-xs md:text-sm hover:scale-105 transition-all shadow-lg border border-[#526243]/20 cursor-pointer"
            >
              Comenzar ahora
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Philosophy Section ── */
function PhilosophySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-[#F8F6F2] py-20 md:py-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.h2 
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-5xl lg:text-6xl text-[#526243] font-medium tracking-tight mb-16 md:mb-24"
        >
          Tus pedidos ordenados <em className="font-serif italic text-[#1F241C] font-normal">por hora de entrega</em>
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
          <motion.div 
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.8 }}
            className="rounded-3xl overflow-hidden aspect-[4/3] relative border border-[#526243]/10 shadow-xl"
          >
            <img 
              src="/panel_pedidos_mockup.png" 
              alt="Pedidos organizados por hora de entrega en el panel" 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#526243]/5 to-transparent mix-blend-multiply pointer-events-none" />
          </motion.div>

          <motion.div 
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.8 }}
            className="space-y-8 md:space-y-12"
          >
            <div className="space-y-4">
              <span className="text-[#526243] text-[10px] font-bold tracking-widest uppercase block">Adiós a las libretas mojadas</span>
              <p className="text-[#1F241C]/85 text-sm md:text-base leading-relaxed font-medium">
                Se acabó tener pedidos anotados en papeles sueltos que se mojan o se pierden al limpiar los tallos. En tu pantalla ves todo ordenado por la hora de entrega. Sabes qué arreglos armar primero y qué flor comprar en la Central para no dar vueltas de más.
              </p>
            </div>
            <div className="w-full h-px bg-[#526243]/15" />
            <div className="space-y-4">
              <span className="text-[#526243] text-[10px] font-bold tracking-widest uppercase block">San Valentín & 10 de Mayo</span>
              <p className="text-[#1F241C]/85 text-sm md:text-base leading-relaxed font-medium">
                Sobrevive al caos de las fechas fuertes sin que se te traspapele ninguna dirección de envío. Todo queda anotado con su estatus de pago listo (Pagado ✓) para que duermas tranquila sabiendo que tu flor y tu ganancia ya están seguras.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── Services Section (What We Do) ── */
function ServicesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-[#F8F6F2] py-20 md:py-32 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(82,98,67,0.02)_0%,_transparent_60%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        <motion.div 
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7 }}
          className="flex items-end justify-between mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-medium text-[#526243] tracking-tight">Herramientas</h2>
          <span className="text-[#526243] text-xs font-semibold hidden md:block uppercase tracking-widest">Control Total</span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1 */}
          <motion.div 
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="group"
          >
            <div className="bg-white/80 border border-[#526243]/10 shadow-lg rounded-3xl h-full flex flex-col justify-between overflow-hidden">
              <div className="aspect-video relative overflow-hidden rounded-t-3xl border-b border-[#526243]/10">
                <img 
                  src="/catalogo_digital_mockup.png" 
                  alt="Tu catálogo digital de cara al cliente" 
                  className="w-full h-full object-cover transition-transform duration-750 group-hover:scale-[1.02]" 
                />
              </div>
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="uppercase tracking-widest text-[#526243] text-[10px] font-bold">Tu local en línea</span>
                  <div className="bg-[#ffd7db] rounded-full p-2.5 text-[#1F241C] border border-[#526243]/15 group-hover:bg-[#ffd7db]/80 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-[#526243] text-lg md:text-xl font-bold mb-2 tracking-tight">Catálogo Instantáneo</h3>
                <p className="text-[#1F241C]/85 text-xs md:text-sm leading-relaxed font-medium">
                  Tus clientes ven fotos reales de tus arreglos con precios actualizados, eligen cuándo quieren la entrega y escriben su dedicatoria directamente. Ya no tienes que mandar fotos una por una por chat.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="group"
          >
            <div className="bg-white/80 border border-[#526243]/10 shadow-lg rounded-3xl h-full flex flex-col justify-between overflow-hidden">
              <div className="aspect-video relative overflow-hidden rounded-t-3xl border-b border-[#526243]/10">
                <img 
                  src="/precios_claros_mockup.png" 
                  alt="Precios estables y cobros exactos sin comisiones ocultas" 
                  className="w-full h-full object-cover transition-transform duration-750 group-hover:scale-[1.02]" 
                />
              </div>
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="uppercase tracking-widest text-[#526243] text-[10px] font-bold">Seguridad</span>
                  <div className="bg-[#ffd7db] rounded-full p-2.5 text-[#1F241C] border border-[#526243]/15 group-hover:bg-[#ffd7db]/80 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-[#526243] text-lg md:text-xl font-bold mb-2 tracking-tight">Tus precios no mienten</h3>
                <p className="text-[#1F241C]/85 text-xs md:text-sm leading-relaxed font-medium">
                  El precio que pones en tu panel es exactamente lo que ve tu cliente y el dinero exacto que llega a tu banco. Sin comisiones sorpresa, cobros raros ni dinero perdido en el camino.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function SaasLandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<'basico' | 'pro' | 'premium'>('pro');
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#F8F6F2] text-[#1F241C] selection:bg-[#ffd7db] selection:text-[#526243] overflow-hidden font-sans">
      
      {/* ── NAVBAR ── */}
      <motion.nav 
        initial={{ y: -100 }} 
        animate={{ y: 0 }} 
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 inset-x-0 z-50 py-4 px-6 transition-all duration-300 ${scrolled ? 'bg-[#F8F6F2]/80 backdrop-blur-md border-b border-[#526243]/10' : 'bg-transparent'}`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 bg-white/70 backdrop-blur-md rounded-full px-6 py-3 border border-[#526243]/10 shadow-[0_8px_32px_rgba(82,98,67,0.04)]">
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo.webp" alt="BotaniQ Logo" className="w-8 h-8 rounded-full border border-[#526243]/20 object-cover" />
            <span className="font-bold text-base tracking-tight font-serif italic text-[#526243]">BotaniQ</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4 lg:gap-8 text-xs font-bold uppercase tracking-wider lg:tracking-widest text-[#526243]/85">
            <a href="#proceso" className="hover:text-[#526243] transition-colors">Cómo Funciona</a>
            <a href="#como-funciona" className="hover:text-[#526243] transition-colors">Características</a>
            <a href="#precios" className="hover:text-[#526243] transition-colors">Precios</a>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Link to="/login" className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#526243]/85 hover:text-[#526243] transition-colors whitespace-nowrap">
              Ingresar
            </Link>
            <span className="h-4 w-px bg-[#526243]/20 block" aria-hidden="true" />
            <Link 
              to="/login?mode=register" 
              className="bg-[#526243] hover:bg-[#526243]/90 text-white rounded-full px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO SECTION ── */}
      <section className="relative min-h-screen flex flex-col justify-between pt-32 pb-12 px-6 overflow-hidden">
        {/* Background Loop Video */}
        <div className="absolute inset-0 z-0">
          <CrossfadeVideo src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4" />
          <div className="absolute inset-0 bg-[#F8F6F2]/80 z-10 pointer-events-none" />
        </div>

        {/* Hero Content */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8 flex flex-wrap gap-2 justify-center"
          >
            <span className="px-4 py-1.5 bg-[#ffd7db]/60 border border-[#526243]/20 rounded-full text-[10px] md:text-xs font-bold tracking-widest uppercase text-[#526243] shadow-sm">
              Prueba 14 días gratis
            </span>
            <span className="px-4 py-1.5 bg-white/60 border border-[#526243]/20 rounded-full text-[10px] md:text-xs font-bold tracking-widest uppercase text-[#526243] shadow-sm">
              {HERO.badge}
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-medium text-[#526243] tracking-tight mb-8 font-serif leading-none"
          >
            Asegura el pago <br className="hidden md:block" />
            <em className="font-serif italic text-[#1F241C] font-normal">antes de tocar la tijera.</em>
          </motion.h1>

          {/* Email Newsletter Input Pill */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="max-w-md w-full bg-white/90 border border-[#526243]/25 rounded-full pl-6 pr-2 py-2 flex items-center gap-3 mb-4 shadow-md focus-within:border-[#526243]"
          >
            <input 
              type="email" 
              placeholder="Ingresa tu correo" 
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 text-sm text-[#1F241C] placeholder:text-[#526243]/50 font-medium"
            />
            <Link 
              to={`/login?mode=register&email=${encodeURIComponent(emailInput)}`}
              className="bg-[#526243] hover:bg-[#526243]/90 text-white rounded-full p-2.5 hover:scale-105 transition-transform"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-xs md:text-sm text-[#526243]/70 mb-6 font-medium"
          >
            14 días gratis  ·  Sin tarjeta de crédito  ·  Cancela cuando quieras
          </motion.p>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="text-[#1F241C]/85 text-xs sm:text-sm max-w-lg leading-relaxed mb-8 font-medium"
          >
            {HERO.sub}
          </motion.p>

          <motion.a 
            href="#precios"
            className="bg-white text-[#526243] hover:bg-[#ffd7db]/20 border border-[#526243]/20 font-bold rounded-full px-8 py-3 text-xs uppercase tracking-widest shadow-sm transition-all"
          >
            Ver Planes & Tarifas
          </motion.a>
        </div>

        {/* Hero Footer */}
        <div className="relative z-20 flex justify-center gap-4 mt-auto">
          <a 
            href="https://instagram.com" target="_blank" rel="noopener noreferrer"
            className="bg-white/80 border border-[#526243]/10 text-[#526243] hover:bg-[#ffd7db]/30 rounded-full p-3.5 shadow-sm transition-all"
          >
            <Instagram className="w-4 h-4" />
          </a>
          <a 
            href="https://twitter.com" target="_blank" rel="noopener noreferrer"
            className="bg-white/80 border border-[#526243]/10 text-[#526243] hover:bg-[#ffd7db]/30 rounded-full p-3.5 shadow-sm transition-all"
          >
            <Twitter className="w-4 h-4" />
          </a>
          <a 
            href="#" 
            className="bg-white/80 border border-[#526243]/10 text-[#526243] hover:bg-[#ffd7db]/30 rounded-full p-3.5 shadow-sm transition-all"
          >
            <Globe className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA / EL PROCESO ── */}
      <div id="proceso">
        <FeaturedVideoSection />
        <PhilosophySection />
        <ServicesSection />
      </div>

      {/* ── FEATURES POR PLAN ── */}
      <section id="como-funciona" className="py-20 md:py-32 px-6 relative z-10 bg-[#F8F6F2]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#526243] mb-6">Tranquilidad Operativa</h2>
            <p className="text-[#1F241C]/85 max-w-xl mx-auto text-sm md:text-base leading-relaxed font-medium">
              Tú decides cómo interactúa tu tienda. WhatsApp directo para el básico, o pasarelas completas automatizadas para escalar.
            </p>
          </div>

          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-white/80 border border-[#526243]/10 p-1.5 rounded-full shadow-sm">
              <button 
                onClick={() => setActiveFeatureTab('basico')} 
                className={`px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer ${activeFeatureTab === 'basico' ? 'bg-[#526243] text-white shadow-sm' : 'text-[#526243]/85 hover:text-[#526243]'}`}
              >
                Esencia
              </button>
              <button 
                onClick={() => setActiveFeatureTab('pro')} 
                className={`px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer ${activeFeatureTab === 'pro' ? 'bg-[#526243] text-white shadow-sm' : 'text-[#526243]/85 hover:text-[#526243]'}`}
              >
                Alquimia
              </button>
              <button 
                onClick={() => setActiveFeatureTab('premium')} 
                className={`px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all cursor-pointer ${activeFeatureTab === 'premium' ? 'bg-[#526243] text-white shadow-sm' : 'text-[#526243]/85 hover:text-[#526243]'}`}
              >
                Edén
              </button>
            </div>
          </div>

          {/* Features cards layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLAN_FEATURES[activeFeatureTab].map((feat, i) => (
              <GlassCard key={i} className="p-8 bg-white/80 border border-[#526243]/10 shadow-sm flex flex-col gap-4 min-h-[220px]">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-[#ffd7db] border border-[#526243]/10 flex items-center justify-center flex-shrink-0">
                    {feat.icon && (() => {
                      const Icon = feat.icon;
                      return <Icon className="w-4 h-4 text-[#526243]" />;
                    })()}
                  </div>
                  <h3 className="text-base font-bold text-[#526243] tracking-tight">{feat.title}</h3>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-[#1F241C]/85 leading-relaxed font-medium">{feat.desc}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section className="py-20 md:py-32 px-6 relative z-10 bg-[#F8F6F2] border-y border-[#526243]/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#526243]">Experiencias compartidas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <GlassCard key={i} className="p-8 bg-white/80 border border-[#526243]/10 hover:bg-white/95 transition-all shadow-sm">
                <p className="text-[#1F241C]/85 text-xs md:text-sm leading-relaxed mb-6 italic font-medium">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ffd7db] flex items-center justify-center text-xs font-bold text-[#1F241C] border border-[#526243]/10">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#526243]">{t.name}</div>
                    <div className="text-[10px] text-[#1F241C]/80 font-medium">{t.city}</div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── SAFETY NET ── */}
      <section className="py-20 md:py-32 px-6 relative z-10 bg-[#F8F6F2]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#526243] uppercase tracking-widest text-[10px] font-bold block mb-4 bg-[#ffd7db]/60 border border-[#526243]/10 px-3 py-1 rounded-full w-max mx-auto shadow-sm">Garantía</span>
            <h2 className="text-2xl md:text-3xl font-semibold text-[#526243] mb-4">{SAFETY.title}</h2>
            <p className="text-[#1F241C]/85 text-xs md:text-sm font-medium">{SAFETY.sub}</p>
          </div>
          <div className="space-y-3">
            {SAFETY.items.map((item, i) => <AccordionItem key={i} q={item.q} a={item.a} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 md:py-32 px-6 relative z-10 bg-[#F8F6F2] border-y border-[#526243]/10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#526243] mb-4">Preguntas Frecuentes</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => <AccordionItem key={i} q={faq.q} a={faq.a} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="precios" className="py-20 md:py-32 px-6 relative z-10 bg-[#F8F6F2]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-semibold text-[#526243] mb-6">Planes Claros</h2>
            <div className="inline-flex items-center gap-2 bg-white/80 p-2 rounded-full border border-[#526243]/10 shadow-sm">
              <button 
                onClick={() => setIsAnnual(false)} 
                className={`px-6 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${!isAnnual ? 'bg-[#526243] text-white shadow-sm' : 'text-[#526243]/85 hover:text-[#526243]'}`}
              >
                Mensual
              </button>
              <button 
                onClick={() => setIsAnnual(true)} 
                className={`pl-6 pr-4 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${isAnnual ? 'bg-[#526243] text-white shadow-sm' : 'text-[#526243]/85 hover:text-[#526243]'}`}
              >
                Anual <span className="text-[9px] font-bold bg-[#ffd7db] text-[#1F241C] border border-[#526243]/10 px-2 py-0.5 rounded-full flex-shrink-0">Ahorra</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {PRICING.map((plan, i) => (
              <GlassCard 
                key={i} 
                className={`p-8 bg-white/80 border border-[#526243]/10 flex flex-col justify-between relative shadow-sm hover:shadow-md transition-all h-full !overflow-visible ${plan.popular ? 'md:scale-105 z-10 border-[#526243] ring-1 ring-[#526243]/20 shadow-md' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                    <span className="bg-[#526243] text-white text-[9px] font-bold uppercase tracking-widest py-1 px-3 rounded-full shadow-sm whitespace-nowrap">
                      Recomendado
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#526243] block mb-2">{plan.level}</span>
                  <h3 className="text-xl font-bold text-[#1F241C] mb-4">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-black text-[#526243]">{isAnnual ? plan.yearPrice : plan.price}</span>
                    <span className="text-xs text-[#1F241C]/70 font-semibold">{isAnnual ? '/año' : plan.period}</span>
                  </div>
                  <p className="text-xs text-[#1F241C]/85 font-medium mb-8 leading-relaxed min-h-[48px]">{plan.desc}</p>
                  
                  <div className="space-y-3 mb-8">
                    {plan.features.map((feat, j) => {
                      const isProximamente = typeof feat === 'object' && feat !== null && 'proximamente' in feat && feat.proximamente;
                      const texto = typeof feat === 'object' && feat !== null && 'texto' in feat ? feat.texto : String(feat);
                      return (
                        <div key={j} className={`flex items-start gap-2 ${isProximamente ? 'opacity-50' : ''}`}>
                          <Check className="w-3.5 h-3.5 text-[#526243] shrink-0 mt-0.5" />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-[#1F241C]/85 font-medium">{texto}</span>
                            {isProximamente && (
                              <span className="bg-[#ffd7db]/60 border border-[#526243]/20 text-[#526243] text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest">
                                Próximamente
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Link 
                    to={`/login?mode=register&plan=${plan.key}`} 
                    className={`w-full py-3 rounded-full text-xs font-bold uppercase tracking-widest text-center transition-all block overflow-hidden whitespace-nowrap text-ellipsis ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-[#526243] to-[#ffd7db] text-[#1F241C] hover:scale-[1.02] shadow-md border border-[#526243]/15' 
                        : 'bg-white hover:bg-[#ffd7db]/20 text-[#526243] border border-[#526243]/20 shadow-sm'
                    }`}
                  >
                    Comenzar gratis — 14 días
                  </Link>
                  <p className="text-[10px] text-center text-[#526243]/70 mt-2 font-medium">
                    Después, desde {isAnnual ? plan.yearPrice : plan.price}/{isAnnual ? 'año' : 'mes'}. Cancela cuando quieras.
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <footer className="relative py-24 md:py-32 px-6 text-center bg-[#F8F6F2]">
        <div className="max-w-3xl mx-auto z-10 relative">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-[#526243] mb-6 tracking-tight leading-tight">
            No esperes a la víspera del próximo 10 de Mayo para ordenarte.
          </h2>
          <p className="text-xs md:text-sm text-[#1F241C]/85 font-medium mb-10 max-w-md mx-auto leading-relaxed">
            Tu catálogo queda listo en 10 minutos. Cobra tus arreglos antes de armar y duerme tranquila sabiendo que tu flor y tu trabajo ya están asegurados.
          </p>
          <Link 
            to="/login?mode=register" 
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-xs uppercase tracking-widest text-[#1F241C] bg-gradient-to-r from-[#526243] to-[#ffd7db] hover:scale-105 transition-all shadow-[0_8px_32px_rgba(82,98,67,0.1)] border border-[#526243]/20"
          >
            Crear mi tienda
          </Link>
          <p className="text-[10px] text-[#526243]/80 mt-8 font-semibold">
            Pensado para floristas que cuidan su local, su tiempo y su flor.
          </p>
        </div>
      </footer>
    </div>
  );
}

