import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { type BottomSheetItem } from './BottomSheetConfig';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: BottomSheetItem[];
  tenantColor: string;
  onItemClick: (item: BottomSheetItem) => void;
}

const MotionLink = motion(Link);

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  items,
  tenantColor,
  onItemClick
}: BottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay Background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(3px)',
            }}
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              // Drag down past 80px to close
              if (info.offset.y > 80) {
                onClose();
              }
            }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 60,
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              background: 'rgba(18, 18, 18, 0.96)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
            className="px-6 pt-2 text-white max-h-[85vh] overflow-y-auto select-none"
          >
            {/* Drag Handle Indicator */}
            <div className="flex justify-center pb-4 pt-1 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-white/90 tracking-wide">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:scale-95 transition-all focus:outline-none"
              >
                Cerrar
              </button>
            </div>

            {/* Grid Menu */}
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => {
                const isDestructive = item.destructive;
                const activeColor = isDestructive ? '#ef4444' : tenantColor;

                const buttonContent = (
                  <>
                    <div
                      className="p-3 rounded-full flex items-center justify-center transition-all duration-300 mb-1 group-hover:scale-110"
                      style={{
                        background: `radial-gradient(circle, ${activeColor}15 0%, ${activeColor}03 100%)`,
                        border: `1px solid ${activeColor}20`,
                      }}
                    >
                      <item.icon
                        size={22}
                        strokeWidth={2}
                        style={{ color: activeColor }}
                      />
                    </div>
                    <span
                      style={{ color: isDestructive ? '#ef4444' : 'rgba(255, 255, 255, 0.75)' }}
                      className="text-[12px] font-semibold text-center leading-tight transition-colors group-hover:text-white"
                    >
                      {item.label}
                    </span>
                  </>
                );

                const itemStyle = {
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px',
                  padding: '16px 12px',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                  gap: '8px',
                  width: '100%',
                };

                const hoverAnimation = {
                  y: -4,
                  scale: 1.02,
                  borderColor: `${activeColor}40`,
                  boxShadow: `0 8px 24px -4px ${activeColor}20, 0 4px 12px -2px ${activeColor}15`,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                };

                if (item.path) {
                  return (
                    <MotionLink
                      key={item.id}
                      to={item.path}
                      onClick={() => {
                        onItemClick(item);
                        onClose();
                      }}
                      style={itemStyle}
                      whileHover={hoverAnimation}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="group transition-colors duration-200 active:scale-98"
                    >
                      {buttonContent}
                    </MotionLink>
                  );
                }

                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onItemClick(item);
                    }}
                    style={itemStyle}
                    whileHover={hoverAnimation}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="group transition-colors duration-200 active:scale-98 focus:outline-none"
                  >
                    {buttonContent}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
