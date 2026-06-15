import { useTenant } from '../../context/TenantContext.tsx';
import { cleanInstagramUsername, cleanFacebookUrl } from '../../utils/formatters';
import { useLocation } from 'react-router-dom';
import { getNavLinksFromSecciones } from '../../lib/navLinks.js';

export default function Footer() {
  const { tenant } = useTenant();

  // Separar el nombre de la tienda para estilizar
  const nameParts = tenant.nombre.split(' ');
  const brandFirst = nameParts[0] || '';
  const brandRest = nameParts.slice(1).join(' ') || '';

  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';
  const navLinks = getNavLinksFromSecciones(tenant?.config_ui?.orden_secciones, tenant?.nav_links);

  return (
    <footer id="footer" className="bg-negro-soft border-t border-white/[.04]">
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-8 sm:gap-16 pt-16 px-6 pb-12">
        
        <div className="flex flex-col gap-[0.3rem]">
          <div className="flex items-baseline gap-[0.4rem]">
            <span className="font-display text-[1.6rem] font-bold text-[var(--color-background-primary)]/[.8]">{brandFirst}</span>
            <span className="font-script text-[2rem] text-rosa leading-none">{brandRest}</span>
          </div>
          <p className="text-[0.7rem] tracking-[0.15em] uppercase text-[var(--color-background-primary)]/[.25] mt-[0.6rem]">
            Flores frescas · {tenant.ciudad} · Desde {tenant.anio_fundacion}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          <div className="flex flex-col">
            <h4 className="text-[0.64rem] tracking-[0.2em] uppercase text-[var(--color-background-primary)]/[.25] mb-[0.9rem]">Horario</h4>
            <p className="text-[0.82rem] text-[var(--color-background-primary)]/[.45] leading-[1.9] block transition-colors duration-200">
              {tenant.horarios.regular}
            </p>
            {tenant.horarios.especial && (
              <p className="text-[0.78rem] text-rosa-light mt-[0.3rem] leading-[1.9] block transition-colors duration-200">
                {tenant.horarios.especial}
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <h4 className="text-[0.64rem] tracking-[0.2em] uppercase text-[var(--color-background-primary)]/[.25] mb-[0.9rem]">Contacto</h4>
            {tenant.direccion && (
              <span className="text-[0.82rem] text-[var(--color-background-primary)]/[.45] leading-[1.9] block mb-1">
                {tenant.direccion}
              </span>
            )}
            {(() => {
              const n = tenant.whatsapp?.replace(/\D/g, '');
              return n && n !== '0000000000' && n.length >= 10 ? (
                <a href={`https://wa.me/${n}`} className="text-[0.82rem] text-[var(--color-background-primary)]/[.45] hover:text-rosa-light leading-[1.9] block transition-colors duration-200" target="_blank" rel="noopener noreferrer">WhatsApp</a>
              ) : null;
            })()}
            {tenant.redes_sociales.instagram && (() => {
              const igUser = cleanInstagramUsername(tenant.redes_sociales.instagram);
              return igUser ? (
                <a href={`https://instagram.com/${igUser}`} className="text-[0.82rem] text-[var(--color-background-primary)]/[.45] hover:text-rosa-light leading-[1.9] block transition-colors duration-200" target="_blank" rel="noopener noreferrer">Instagram</a>
              ) : null;
            })()}
            {tenant.redes_sociales.facebook && (() => {
              const fbUrl = cleanFacebookUrl(tenant.redes_sociales.facebook);
              return fbUrl ? (
                <a href={fbUrl} className="text-[0.82rem] text-[var(--color-background-primary)]/[.45] hover:text-rosa-light leading-[1.9] block transition-colors duration-200" target="_blank" rel="noopener noreferrer">Facebook</a>
              ) : null;
            })()}
          </div>

          <div className="flex flex-col">
            <h4 className="text-[0.64rem] tracking-[0.2em] uppercase text-[var(--color-background-primary)]/[.25] mb-[0.9rem]">Navegación</h4>
            {navLinks.map((link) => {
              const href = isHome ? link.href : `/${location.search}${link.href}`;
              return (
                <a
                  key={link.label}
                  href={href}
                  className="text-[0.82rem] text-[var(--color-background-primary)]/[.45] hover:text-rosa-light leading-[1.9] block transition-colors duration-200"
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[.04] py-4 px-6 flex items-center justify-between flex-wrap gap-4 text-[0.7rem] tracking-[0.08em] text-[var(--color-background-primary)]/[.2]">
        <span>© {currentYear} {tenant.nombre} · {tenant.ciudad}, {tenant.estado}</span>
        <div className="flex flex-wrap gap-4">
          <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" className="text-[var(--color-background-primary)]/[.2] hover:text-[var(--color-background-primary)]/[.45] transition-colors duration-200">Aviso de Privacidad</a>
          <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className="text-[var(--color-background-primary)]/[.2] hover:text-[var(--color-background-primary)]/[.45] transition-colors duration-200">Términos y Condiciones</a>
          <a href="/devoluciones.html" target="_blank" rel="noopener noreferrer" className="text-[var(--color-background-primary)]/[.2] hover:text-[var(--color-background-primary)]/[.45] transition-colors duration-200">Cancelaciones y Reembolsos</a>
        </div>
      </div>
    </footer>
  );
}
