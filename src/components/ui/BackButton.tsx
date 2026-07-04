import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
  variant?: 'header' | 'floating' | 'link';
  tenantColor?: string;
}

export default function BackButton({
  to,
  label = 'Volver',
  className = '',
  variant = 'header',
  tenantColor
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (to) {
      if ((to === '/' || to === '/#catalogo') && window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate(to);
      }
    } else {
      // Si hay historial previo dentro de la aplicación, retroceder.
      // De lo contrario, redirigir a la raíz correspondiente para evitar salir del dominio.
      if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        if (location.pathname.startsWith('/admin')) {
          navigate('/admin');
        } else if (location.pathname.startsWith('/superadmin')) {
          navigate('/superadmin');
        } else {
          navigate('/#catalogo');
        }
      }
    }
  };

  if (variant === 'floating') {
    return (
      <button
        onClick={handleBack}
        className={`fixed top-4 left-4 z-50 p-2.5 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-md text-[var(--color-text-primary)] hover:scale-105 active:scale-95 transition-all ${className}`}
        aria-label={label}
      >
        <ArrowLeft className="w-5 h-5" style={tenantColor ? { color: tenantColor } : {}} />
      </button>
    );
  }

  if (variant === 'link') {
    return (
      <button
        onClick={handleBack}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 dark:hover:bg-white/5 transition-all active:scale-[0.98] ${className}`}
      >
        <ArrowLeft className="w-3.5 h-3.5" style={tenantColor ? { color: tenantColor } : {}} />
        <span>{label}</span>
      </button>
    );
  }

  // Variante por defecto para barras de navegación / cabeceras (header)
  return (
    <button
      onClick={handleBack}
      className={`p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] transition-colors flex items-center justify-center gap-1.5 shrink-0 ${className}`}
      aria-label={label}
    >
      <ArrowLeft className="w-5 h-5" style={tenantColor ? { color: tenantColor } : {}} />
      <span className="hidden sm:inline text-sm font-medium">{label}</span>
    </button>
  );
}
