import { useTenant } from '../../context/TenantContext.tsx';

export default function Galeria() {
  const { tenant, loading } = useTenant();

  if (loading) {
    return (
      <section className="bg-negro-soft pt-[7rem] px-6 pb-[6rem] animate-pulse">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className={`min-h-[180px] bg-[var(--color-background-primary)]/5 rounded-[12px] ${i===1||i===2 ? 'md:row-span-2 max-sm:row-span-1' : ''}`}></div>
          ))}
        </div>
      </section>
    );
  }

  const galeria = tenant.galeria || [];

  return (
    <section id="galeria" className="bg-negro-soft pt-[7rem] px-6 pb-[6rem]">
      <div className="text-center mb-[3.5rem]">
        <p className="inline-flex items-center gap-[0.45rem] text-[0.65rem] tracking-[0.28em] uppercase text-dorado font-body font-medium mb-[0.9rem]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          {tenant.secciones?.galeria?.etiqueta || 'Entregas reales'}
        </p>
        <h2 className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] tracking-[-0.02em] font-bold text-[var(--color-background-primary)] mb-2">
          {tenant.secciones?.galeria?.titulo || 'Así llegan'} <em className="italic text-rosa-light not-italic">{tenant.secciones?.galeria?.titulo_italic || 'nuestros arreglos'}</em>
        </h2>
        <p className="text-[0.86rem] text-[var(--color-background-primary)]/40 tracking-[0.04em] font-light">
          {tenant.secciones?.galeria?.subtitulo || 'Fotos de clientes satisfechos — sin filtros, sin edición'}
        </p>
      </div>

      <div className="max-w-[1180px] mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-rows-[auto_auto] gap-3">
        {galeria.map((img, i) => (
          <div 
            key={i} 
            className={`group relative w-full h-full min-h-[180px] rounded-[12px] overflow-hidden bg-verde-dark cursor-pointer 
              ${i === 0 || i === 1 ? 'md:row-span-2' : ''}
              ${(i === 0 || i === 1) ? 'max-sm:row-span-1' : ''}
            `}
          >
            <img 
              src={img.imagen_url || img.imgUrl} 
              alt={img.alt_text || img.alt || 'Foto de arreglo'} 
              loading="lazy" 
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-end p-3">
              <span className="text-[0.7rem] text-[var(--color-background-primary)]/80 tracking-[0.06em]">{img.autor}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
