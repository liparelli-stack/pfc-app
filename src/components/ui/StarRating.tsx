/*
-- ===================================================
-- Código: /src/components/ui/StarRating.tsx
-- Versão: 1.0.0
-- Data/Hora: 2025-10-13 10:15
-- Autor: Dualite Alpha (AD)
-- Objetivo: Componente reutilizável para seleção de qualificação por estrelas.
-- Fluxo: Usado em CompanyForm.tsx.
-- Dependências: react, lucide-react, clsx
-- ===================================================
*/
import { useState } from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';

interface StarRatingProps {
  count?: number;
  value: number | null | undefined;
  onChange: (value: number) => void;
  className?: string;
}

export const StarRating = ({ count = 5, value, onChange, className }: StarRatingProps) => {
  const [hover, setHover] = useState<number | null>(null);
  const rating = value ?? 0;
  const hoverRating = hover ?? 0;

  return (
    <div className={clsx("flex items-center gap-1", className)}>
      {[...Array(count)].map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            type="button"
            key={starValue}
            className="cursor-pointer"
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHover(starValue)}
            onMouseLeave={() => setHover(null)}
          >
            <Star
              className={clsx(
                'h-6 w-6 transition-colors',
                starValue <= (hoverRating || rating)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 dark:text-gray-600'
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
