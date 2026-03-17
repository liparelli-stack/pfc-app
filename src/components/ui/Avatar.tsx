/*
-- ===================================================
-- Código: /src/components/ui/Avatar.tsx
-- Versão: 1.0
-- Data/Hora: 2025-05-23 18:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Componente para exibir a imagem do usuário ou suas iniciais.
-- Fluxo: Usado em ProfileSelector.tsx e outros locais que exibem usuários.
-- Dependências: clsx
-- ===================================================
*/
import clsx from 'clsx';

interface AvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
}

const getInitials = (name: string = '') => {
  const names = name.split(' ');
  const first = names[0]?.[0] || '';
  const last = names.length > 1 ? names[names.length - 1]?.[0] : '';
  return `${first}${last}`.toUpperCase();
};

export const Avatar = ({ src, name, className }: AvatarProps) => {
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600 font-bold text-gray-800 dark:text-white',
        className
      )}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};
