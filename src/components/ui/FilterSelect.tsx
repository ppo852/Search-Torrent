import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  /** Libellé au-dessus du champ (MediaDetail, etc.). */
  label?: string;
  icon?: ReactNode;
  className?: string;
  /** Affiché à droite du trigger (ex. bouton sens du tri). */
  endAdornment?: ReactNode;
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  icon,
  className = '',
  endAdornment,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((opt) => opt.value === value);
  const selectedLabel = selected?.label ?? options[0]?.label ?? '';

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      {label && (
        <label className="block text-[10px] font-black uppercase tracking-widest text-white/70 mb-1.5">
          {label}
        </label>
      )}
      <div className="flex items-stretch rounded-xl border border-blue-500/20 hover:border-blue-500/40 focus-within:border-blue-500/40 transition-colors overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`relative flex-1 min-w-0 flex items-center gap-2 appearance-none ${icon ? 'pl-10' : 'pl-3'} ${endAdornment ? 'pr-2' : 'pr-9'} py-2.5 bg-transparent text-white text-sm font-medium focus:outline-none text-left`}
        >
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/70 pointer-events-none">
              {icon}
            </span>
          )}
          <span className="truncate flex-1">{selectedLabel}</span>
          {!endAdornment && (
            <ChevronDown
              size={16}
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-blue-400/70 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
            />
          )}
        </button>
        {endAdornment && (
          <div className="flex items-center shrink-0 pr-1.5 border-l border-blue-500/15">
            {endAdornment}
          </div>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 soft-menu z-50 max-h-64 overflow-y-auto">
          <div className="space-y-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-left text-sm font-medium transition-all ${
                  value === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-white/80 hover:bg-blue-600/15 hover:text-white'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {value === opt.value && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
