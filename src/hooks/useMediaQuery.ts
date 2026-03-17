/*
-- ===================================================
-- Código: /src/hooks/useMediaQuery.ts
-- Data/Hora: 2025-05-23 12:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar um hook customizado para detectar breakpoints de tela.
-- Fluxo: Usado em App.tsx para controlar o layout responsivo do Sidebar.
-- Dependências: react
-- ===================================================
*/
import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);

  return matches;
};
