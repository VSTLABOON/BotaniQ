import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  children: React.ReactNode;
}

export function SlideOverPanel({ isOpen, onClose, onSave, title, children }: SlideOverPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap y Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();

      if (e.key === 'Tab') {
        if (!panelRef.current) return;
        const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto focus first element ONCE when panel opens
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const focusableElements = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements && focusableElements.length > 0) {
        // Focus the first input/select/textarea if possible, otherwise first button
        const firstInput = panelRef.current?.querySelector<HTMLElement>('input, select, textarea');
        (firstInput || focusableElements[0]).focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className="relative w-full max-w-[380px] bg-white/90 dark:bg-black/90 backdrop-blur-xl h-full flex flex-col shadow-2xl animate-slide-in-right will-change-transform border-l border-white/20 dark:border-white/10"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md shrink-0">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white/20 dark:bg-black/20 backdrop-blur-sm">
          <div className="flex flex-col gap-5">
            {children}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-secondary)] rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-[var(--color-background-primary)] text-sm font-semibold hover:bg-emerald-700 rounded-xl transition-colors shadow-sm active:scale-95"
          >
            <Save className="w-4 h-4" />
            Guardar cambios
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
