/*
-- ===================================================
-- Código: /src/utils/iconHelper.tsx
-- Versão: 1.0.1
-- Data/Hora: 2025-10-20 15:50 (America/Sao_Paulo)
-- Autor: E.V.A. (derivado do original de Dualite Alpha)
-- Objetivo: Centralizar a lógica de ícones (compatível com JSX).
-- Observação: Arquivo renomeado de .ts para .tsx para permitir JSX e resolver o erro esbuild.
-- Dependências: react, lucide-react
-- ===================================================
*/
import React from 'react';
import { Phone, MessageSquareText, Mail, CheckSquare, Calendar } from 'lucide-react';

export const getChannelIcon = (channelType: string | null): React.ReactNode => {
  switch (channelType) {
    case 'call':
      return <Phone className="h-4 w-4 text-gray-500" />;
    case 'whatsapp':
      return <MessageSquareText className="h-4 w-4 text-green-500" />;
    case 'email':
      return <Mail className="h-4 w-4 text-blue-500" />;
    case 'task':
      return <CheckSquare className="h-4 w-4 text-purple-500" />;
    default:
      return <Calendar className="h-4 w-4 text-gray-400" />;
  }
};
