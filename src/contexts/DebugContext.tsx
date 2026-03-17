/*
================================================================================
Código: /src/contexts/DebugContext.tsx
Versão: 1.0.0
Data/Hora: 2025-10-09 10:10
Autor: Dualite Alpha (AD)
Objetivo: Prover um contexto para gerenciar e exibir logs de depuração em
          tempo real na interface.
Fluxo: O Provider escuta eventos do debugEmitter e atualiza o estado dos logs,
       que é consumido pelo DebugPanel.
Dependências: react, ../lib/debugEmitter.ts
================================================================================
*/
import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { debugEmitter, LogPayload } from '../lib/debugEmitter';

export interface LogEntry extends LogPayload {
  timestamp: Date;
}

interface DebugContextType {
  logs: LogEntry[];
  clearLogs: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider = ({ children }: { children: ReactNode }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // [--BLOCO--] Escuta por novos logs do emissor de eventos global
    const handleNewLog = (log: LogPayload) => {
      setLogs(prevLogs => [...prevLogs.slice(-100), { ...log, timestamp: new Date() }]);
    };

    const unsubscribe = debugEmitter.on('log', handleNewLog);
    return () => unsubscribe();
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  const value = { logs, clearLogs };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebug = () => {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};
