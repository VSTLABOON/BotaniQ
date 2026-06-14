import React, { useState } from 'react';
import { Heart, Globe, Gift, Phone, Instagram, Facebook } from 'lucide-react';
import { Accordion } from './SharedUI';
import { cleanInstagramUsername, cleanFacebookUrl, cleanWhatsappNumber } from '../../../../utils/formatters';

export function GeneralTab({ 
  state, 
  actions,
  tenant
}: { 
  state: any, 
  actions: any,
  tenant: any
}) {
  const { 
    textoNosotros, 
    anioFundacion, 
    firma, 
    metaTitle, 
    customDomain,
    whatsapp,
    instagram,
    facebook,
    openAccordions,
    mostrarDescripcionEnTarjeta
  } = state;

  const { 
    setTextoNosotros, 
    setAnioFundacion, 
    setFirma, 
    setMetaTitle, 
    setCustomDomain,
    setWhatsapp,
    setInstagram,
    setFacebook,
    onToggleAccordion,
    setMostrarDescripcionEnTarjeta
  } = actions;

  const [seoOpen, setSeoOpen] = useState(true);

  const inputClass = "w-full px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-lg text-[var(--color-text-primary)] text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all";

  return (
    <div className="space-y-6">
      {/* ── Identidad Digital / SEO ── */}
      <Accordion 
        id="editor-SEO"
        title="Identidad Digital y SEO" 
        icon={Globe} 
        isOpen={seoOpen}
        onToggle={setSeoOpen}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="metaTitle" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Título de pestaña (SEO Meta Title)
            </label>
            <input
              id="metaTitle"
              type="text"
              maxLength={60}
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              className={inputClass}
              style={{ fontSize: '16px' }}
              placeholder="Ej: Flores del Amor — Tu Florería en Monterrey"
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Máximo 60 caracteres. Si se deja vacío, el navegador mostrará por defecto: <strong>{tenant.nombre} — {tenant.ciudad}</strong>.
            </p>
          </div>

          <div>
            <label htmlFor="customDomain" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Dominio Personalizado (opcional)
            </label>
            <input
              id="customDomain"
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className={inputClass}
              style={{ fontSize: '16px' }}
              placeholder="Ej: mifloreria.com"
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Ingresa el dominio web si cuentas con uno contratado. Debe ser configurado en tu DNS apuntando a la plataforma.
            </p>
          </div>
        </div>
      </Accordion>

      {/* ── Sobre Nosotros ── */}
      <Accordion 
        id="editor-Nosotros"
        title="Sobre Nosotros" 
        icon={Heart} 
        isOpen={openAccordions.Nosotros}
        onToggle={(open) => onToggleAccordion('Nosotros', open)}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="textoNosotros" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Historia / Descripción</label>
            <textarea
              id="textoNosotros"
              value={textoNosotros}
              onChange={(e) => setTextoNosotros(e.target.value)}
              className={`${inputClass} min-h-[100px] leading-relaxed`}
              style={{ fontSize: '16px' }}
              placeholder="Cuenta la historia de tu florería..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="anioFundacion" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Año de fundación</label>
              <input
                id="anioFundacion"
                type="number"
                value={anioFundacion === undefined || anioFundacion === null ? '' : anioFundacion}
                onChange={(e) => {
                  const val = e.target.value;
                  setAnioFundacion(val === '' ? '' : parseInt(val) || '');
                }}
                className={inputClass}
                style={{ fontSize: '16px' }}
              />
            </div>
            <div>
              <label htmlFor="firma" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Firma (Ej. "El equipo de...")</label>
              <input
                id="firma"
                type="text"
                value={firma}
                onChange={(e) => setFirma(e.target.value)}
                className={inputClass}
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>
        </div>
      </Accordion>

      {/* ── Contacto y Redes Sociales ── */}
      <Accordion 
        id="editor-Contacto"
        title="Contacto y Redes Sociales" 
        icon={Phone} 
        isOpen={openAccordions.Contacto ?? false}
        onToggle={(open) => onToggleAccordion('Contacto', open)}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-500" /> Teléfono de WhatsApp Comercial *
            </label>
            <input
              id="whatsapp"
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              onBlur={(e) => setWhatsapp(cleanWhatsappNumber(e.target.value))}
              className={inputClass}
              style={{ fontSize: '16px' }}
              placeholder="Ej. 2221234567 (sin espacios ni guiones)"
              maxLength={15}
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Ingresa el número con clave de país (ej. 52 para México) sin espacios ni símbolos. Se utiliza para recibir tus pedidos de compra. Si ingresas 10 dígitos, se le antepondrá el prefijo 52 automáticamente al salir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="instagram" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 flex items-center gap-1.5">
                <Instagram className="w-4 h-4 text-pink-500" /> Usuario o Enlace de Instagram
              </label>
              <input
                id="instagram"
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(cleanInstagramUsername(e.target.value))}
                className={inputClass}
                style={{ fontSize: '16px' }}
                placeholder="Ej: tu_floreria"
              />
            </div>
            <div>
              <label htmlFor="facebook" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1 flex items-center gap-1.5">
                <Facebook className="w-4 h-4 text-blue-600" /> Enlace de Facebook
              </label>
              <input
                id="facebook"
                type="text"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                onBlur={(e) => setFacebook(cleanFacebookUrl(e.target.value))}
                className={inputClass}
                style={{ fontSize: '16px' }}
                placeholder="https://facebook.com/tu_floreria"
              />
            </div>
          </div>
        </div>
      </Accordion>

      {/* ── Ajustes del Catálogo ── */}
      <Accordion title="Ajustes del Catálogo" icon={Gift}>
        <div className="flex items-center justify-between bg-emerald-500/10 dark:bg-emerald-500/15 backdrop-blur-sm p-4 rounded-xl border border-emerald-500/20 dark:border-emerald-500/15">
          <div>
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Mostrar descripción en tarjetas</h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
              Si está activado, la descripción del producto aparecerá en las tarjetas de la landing y el catálogo.
            </p>
          </div>
          <label htmlFor="mostrarDescripcionEnTarjeta" className="relative inline-flex items-center cursor-pointer select-none">
            <input
              id="mostrarDescripcionEnTarjeta"
              type="checkbox"
              className="sr-only peer"
              checked={mostrarDescripcionEnTarjeta}
              onChange={e => setMostrarDescripcionEnTarjeta(e.target.checked)}
            />
            <div className="w-11 h-6 bg-[var(--color-background-tertiary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--color-background-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--color-background-primary)] after:border-[var(--color-border-secondary)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </Accordion>
    </div>
  );
}
