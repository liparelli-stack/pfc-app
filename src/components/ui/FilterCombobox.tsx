/*
-- ===================================================
-- Código             : src/components/ui/FilterCombobox.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2026-03-25 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude)
-- Objetivo do código : Combobox com busca, normalização de acentos e clear.
--                      Reutilizável em qualquer filtro de lista (Empresa, Consultora, etc.)
-- Dependências       : react, lucide-react, clsx, @/utils/textNormalization
-- ===================================================
*/

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import { ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';
import { normalizeText } from '@/utils/textNormalization';

/* ============================================================
   Tipos
   ============================================================ */
export interface ComboboxOption {
  id: string;
  label: string;
}

export interface FilterComboboxProps {
  options: ComboboxOption[];
  value?: string;                          // id selecionado
  onChange: (id: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/* ============================================================
   COMPONENTE
   ============================================================ */
const FilterCombobox: React.FC<FilterComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  disabled = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Texto exibido no input
  const labelForValue = (id: string | undefined) =>
    options.find((o) => o.id === id)?.label ?? '';

  const [inputValue, setInputValue] = useState(() => labelForValue(value));
  const [isOpen, setIsOpen]         = useState(false);
  const [search, setSearch]         = useState('');

  // Sincroniza quando o value controlado muda externamente (ex: limpar filtros)
  useEffect(() => {
    setInputValue(labelForValue(value));
    setSearch('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeAndReset();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  /** Filtra opções usando normalizeText em ambos os lados */
  const filtered = search.trim()
    ? options.filter((o) =>
        normalizeText(o.label).includes(normalizeText(search))
      )
    : options;

  const open = () => {
    if (disabled) return;
    setSearch('');
    setInputValue('');
    setIsOpen(true);
  };

  /** Fecha e restaura o label do valor atual (ou limpa se não há valor) */
  const closeAndReset = () => {
    setIsOpen(false);
    setSearch('');
    setInputValue(labelForValue(value));
  };

  const select = (opt: ComboboxOption) => {
    onChange(opt.id);
    setInputValue(opt.label);
    setIsOpen(false);
    setSearch('');
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setInputValue('');
    setSearch('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setInputValue(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') closeAndReset();
    if (e.key === 'Enter' && filtered.length === 1) select(filtered[0]);
  };

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Input visível */}
      <div
        className={clsx(
          'neumorphic-concave rounded-lg px-3 py-2 text-sm',
          'flex items-center gap-2',
          'focus-within:ring-2 focus-within:ring-primary transition-all',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !isOpen && open()}
      >
        <input
          type="text"
          value={isOpen ? inputValue : labelForValue(value)}
          onChange={handleInputChange}
          onFocus={open}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground min-w-0"
          autoComplete="off"
        />

        {/* Botão de limpar */}
        {value && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
            tabIndex={-1}
            aria-label="Limpar seleção"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Chevron */}
        <ChevronDown
          className={clsx(
            'h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 mt-1 w-full',
            'bg-light-s1 dark:bg-dark-s2',
            'border border-light-bmd dark:border-dark-bmd',
            'rounded-lg shadow-sh2',
            'max-h-56 overflow-y-auto'
          )}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => select(opt)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm',
                  'hover:bg-light-s2 dark:hover:bg-dark-s3 transition-colors',
                  opt.id === value && 'font-medium text-accent-light dark:text-accent-dark'
                )}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default FilterCombobox;
