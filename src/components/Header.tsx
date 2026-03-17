/*
-- ===================================================
-- Código             : /src/components/Header.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-11-25 15:30
-- Autor              : FL / Execução via Eva
-- Objetivo do codigo : Header principal sem dropdown "+ Novo" no canto direito.
-- Fluxo              : App.tsx -> Header.tsx
-- Alterações (1.1.0) :
--   • Removido botão e dropdown "+ Novo" do cabeçalho.
--   • Ajustado layout mantendo título à esquerda e busca à direita.
-- Dependências       : lucide-react, React
-- ===================================================
*/
import { Search, Menu } from 'lucide-react';
import { FC } from 'react';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

const Header: FC<HeaderProps> = ({ onMenuClick, title }) => {
  return (
    <header className="flex items-center justify-between p-4 sm:p-6 bg-plate dark:bg-plate-dark border-b border-dark-shadow dark:border-dark-dark-shadow flex-shrink-0">
      <div className="flex items-center">
        {/* [RULE] Botão do menu é exibido apenas em telas menores que 'lg' */}
        <button
          onClick={onMenuClick}
          className="lg:hidden mr-4 p-2 rounded-full neumorphic-convex hover:neumorphic-convex-strong active:neumorphic-concave"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white capitalize">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden sm:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-32 sm:w-48 md:w-80 pl-11 pr-4 py-2.5 rounded-full bg-plate dark:bg-plate-dark neumorphic-concave focus:bg-white dark:focus:bg-gray-700 transition-colors duration-200 outline-none"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
