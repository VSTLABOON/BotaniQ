import { useTenant } from '../../context/TenantContext.tsx';
import { Flower2 } from 'lucide-react';

export default function Flores() {
  const { tenant, loading } = useTenant();

  if (loading) {
    return (
      <section className="bg-negro pt-28 px-6 pb-28 animate-pulse">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="aspect-square bg-[var(--color-background-primary)]/5 rounded-[16px]"></div>
          ))}
        </div>
      </section>
    );
  }

  const flores = (tenant.flores || []).filter(f => f.stock !== 'Agotado');

  return (
    <section id="flores" className="bg-negro pt-28 px-6 pb-28">
      <div className="text-center mb-16 animate-fade-up">
        <p className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.28em] uppercase text-verde-light font-body font-medium mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2c-1.5 0-2.8.7-3.6 1.8A3 3 0 0 0 4.2 8C2.7 8.8 2 10.3 2 12c0 1.5.7 2.8 1.8 3.6a3 3 0 0 0 4.2 4.2C8.8 21.3 10.3 22 12 22c1.5 0 2.8-.7 3.6-1.8a3 3 0 0 0 4.2-4.2c1.1-1 1.8-2.5 1.8-4.2 0-1.5-.7-2.8-1.8-3.6a3 3 0 0 0-4.2-4.2C14.8 2.7 13.5 2 12 2z"/></svg>
          {tenant.secciones?.flores?.etiqueta || 'Nuestra selección'}
        </p>
        <h2 className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] font-bold text-[var(--color-background-primary)] mb-2">
          {tenant.secciones?.flores?.titulo || 'La variedad'} <em className="italic text-verde-light not-italic">{tenant.secciones?.flores?.titulo_italic || 'que mereces'}</em>
        </h2>
      </div>

      <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        {flores.map((f, i) => {
          const name = f.nombre || f.name;
          const sub = f.descripcion || f.sub;
          const imageUrl = f.imagen_url || f.image_url;
          const bgStyle = f.color_hex || f.gradient || 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secundario) 100%)';

          return (
            <div key={i} className="group relative rounded-[16px] overflow-hidden aspect-square flex flex-col justify-end p-5 md:p-8 cursor-pointer animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              {imageUrl ? (
                <div className="absolute inset-0 z-0 transition-transform duration-700 ease-out group-hover:scale-110">
                  <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/45 z-0"></div>
                </div>
              ) : (
                <div className="absolute inset-0 z-0 transition-transform duration-700 ease-out group-hover:scale-110 flex items-center justify-center" style={{ background: bgStyle }}>
                  <Flower2 className="w-12 h-12 text-[var(--color-background-primary)]/20" />
                </div>
              )}
              <div className="relative z-10 flex flex-col">
                <span className="font-display text-[1.4rem] md:text-[1.8rem] font-bold text-[var(--color-background-primary)] leading-none mb-1 md:mb-2">{name}</span>
                <span className="text-[0.7rem] md:text-[0.8rem] text-[var(--color-background-primary)]/70 uppercase tracking-[0.1em] font-medium">{sub}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-[1.1rem] md:text-[1.4rem] text-[var(--color-background-primary)]/50 font-script mt-16 animate-fade-up">
        {tenant.secciones?.flores?.cita || '"Cada flor tiene un lenguaje que las palabras no alcanzan..."'}
      </p>
    </section>
  );
}
