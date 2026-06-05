import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

const TABLER_ICONS = [
  'ti-heart', 'ti-cake', 'ti-ring', 'ti-baby-carriage', 'ti-star',
  'ti-gift', 'ti-confetti', 'ti-flower', 'ti-plant', 'ti-butterfly',
  'ti-sun', 'ti-moon', 'ti-sparkles', 'ti-calendar-event', 'ti-home',
  'ti-building-church', 'ti-users', 'ti-user-heart', 'ti-clock', 'ti-truck-delivery'
];

const LEGACY_MAP: Record<string, string> = {
  heart: 'ti-heart',
  gift: 'ti-gift',
  sparkles: 'ti-sparkles',
  flower: 'ti-flower',
  leaf: 'ti-plant',
  sun: 'ti-sun',
  star: 'ti-star',
  cake: 'ti-cake',
  building: 'ti-building-church',
  users: 'ti-users',
  truck: 'ti-truck-delivery',
  clock: 'ti-clock',
  shield: 'ti-home',
  zap: 'ti-sparkles',
  camera: 'ti-sparkles',
  map: 'ti-home',
  phone: 'ti-user-heart',
  mail: 'ti-calendar-event',
  check: 'ti-star',
};

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  options?: string[];
}

export function IconPicker({ value, onChange, options }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const normalizedValue = LEGACY_MAP[value] || value;

  const displayOptions = useMemo(() => {
    const keys = options || TABLER_ICONS;
    if (!search.trim()) return keys;
    return keys.filter(k => 
      k.toLowerCase().includes(search.toLowerCase()) || 
      k.replace('ti-', '').toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--color-text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar ícono por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-[var(--color-border-secondary)] rounded-xl text-sm bg-[var(--color-background-primary)] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-5 gap-2 p-3 bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-xl max-h-[220px] overflow-y-auto">
        {displayOptions.map(key => {
          const isSelected = normalizedValue === key;
          const iconNameFriendly = key.replace('ti-', '').replace('-', ' ');
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              title={iconNameFriendly}
              type="button"
              className={`
                aspect-square flex flex-col items-center justify-center rounded-xl border transition-all duration-200
                ${isSelected 
                  ? 'bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95 ring-2 ring-emerald-500/20' 
                  : 'bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 text-[var(--color-text-tertiary)] hover:bg-white/60 dark:hover:bg-white/10 hover:border-white/50 dark:hover:border-white/30 hover:scale-105'
                }
              `}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`ti ${key} text-xl`} />
              </div>
            </button>
          );
        })}
        {displayOptions.length === 0 && (
          <div className="col-span-full py-4 text-center text-sm text-[var(--color-text-tertiary)]">
            No se encontraron íconos.
          </div>
        )}
      </div>
    </div>
  );
}
