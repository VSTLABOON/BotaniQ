import { useTenant } from '../../context/TenantContext.tsx';
import { motion } from 'framer-motion';

export default function Beneficios() {
  const { tenant, loading } = useTenant();

  if (loading) {
    return (
      <section className="bg-negro py-28 px-6 animate-pulse">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="h-[500px] bg-[var(--color-background-primary)]/5 rounded-[24px]"></div>
          <div className="flex flex-col gap-8">
            <div className="h-10 w-3/4 bg-[var(--color-background-primary)]/5 rounded"></div>
            <div className="h-20 bg-[var(--color-background-primary)]/5 rounded"></div>
            <div className="h-20 bg-[var(--color-background-primary)]/5 rounded"></div>
          </div>
        </div>
      </section>
    );
  }

  const beneficios = tenant.beneficios || [];

  const iconMap = {
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    flower: <path d="M12 2c-1.5 0-2.8.7-3.6 1.8A3 3 0 0 0 4.2 8C2.7 8.8 2 10.3 2 12c0 1.5.7 2.8 1.8 3.6a3 3 0 0 0 4.2 4.2C8.8 21.3 10.3 22 12 22c1.5 0 2.8-.7 3.6-1.8a3 3 0 0 0 4.2-4.2c1.1-1 1.8-2.5 1.8-4.2 0-1.5-.7-2.8-1.8-3.6a3 3 0 0 0-4.2-4.2C14.8 2.7 13.5 2 12 2z"/>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  };

  return (
    <section id="beneficios" className="bg-negro py-28 px-6">
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <div className="relative rounded-[24px] overflow-hidden aspect-[4/5] bg-verde-dark">
            {tenant.secciones?.beneficios?.imagen && (
              <img src={tenant.secciones.beneficios.imagen} alt="Beneficios" loading="lazy" className="w-full h-full object-cover" />
            )}
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
            className="absolute -bottom-4 right-0 md:-bottom-6 md:-right-6 lg:-right-10 bg-[var(--color-background-primary)] text-negro px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-xl flex items-center gap-3 md:gap-4 z-10 w-[90%] sm:w-auto"
          >
            <div className="w-12 h-12 rounded-full bg-rosa/20 flex items-center justify-center text-rosa">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-[1.2rem] leading-none mb-1">{tenant.secciones?.beneficios?.metrica_valor || '+2,000'}</span>
              <span className="text-[0.75rem] text-negro/60 font-medium uppercase tracking-[0.05em]">{tenant.secciones?.beneficios?.metrica_texto || 'Entregas'}</span>
            </div>
          </motion.div>
        </motion.div>

        <div className="flex flex-col">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.28em] uppercase text-verde-light font-body font-medium mb-4"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            {tenant.secciones?.beneficios?.etiqueta || 'Por qué elegirnos'}
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-bold text-[var(--color-background-primary)] mb-10"
          >
            {tenant.secciones?.beneficios?.titulo || 'Lo que nos hace'} <em className="italic text-rosa not-italic">{tenant.secciones?.beneficios?.titulo_italic || 'diferentes'}</em>
          </motion.h2>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
            }}
            className="flex flex-col gap-8"
          >
            {beneficios.map((b, i) => (
              <motion.div 
                key={i} 
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } }}
                className="flex gap-5"
              >
                <div className="w-12 h-12 shrink-0 rounded-full bg-[var(--color-background-primary)]/5 border border-white/10 flex items-center justify-center text-verde-light">
                  {b.icon && b.icon.startsWith('ti-') ? (
                    <i className={`ti ${b.icon} text-xl`} style={{ fontSize: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
                      {iconMap[b.icon] || iconMap.flower}
                    </svg>
                  )}
                </div>
                <div className="flex flex-col pt-1">
                  <h3 className="text-[1.05rem] font-bold text-[var(--color-background-primary)] mb-2">{b.title}</h3>
                  <p className="text-[0.9rem] text-[var(--color-background-primary)]/60 leading-[1.7] font-light">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
