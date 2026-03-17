/*
================================================================================
Código: /src/components/ui/DebugPanel.tsx
Versão: 1.0.0
Data/Hora: 2025-10-09 10:20
Autor: Dualite Alpha (AD)
Objetivo: Componente de UI para exibir os logs de depuração capturados pelo
          DebugContext.
Fluxo: Renderizado na página de Configurações, consome o useDebug.
Dependências: react, lucide-react, @/contexts/DebugContext, @/components/ui/Button
================================================================================
*/
import { useEffect, useRef } from 'react';
import { useDebug } from '@/contexts/DebugContext';
import { PlayCircle, CheckCircle, Info, Trash2 } from 'lucide-react';
import { Button } from './Button';

const statusIcons = {
  start: <PlayCircle className="h-4 w-4 text-blue-500" />,
  end: <CheckCircle className="h-4 w-4 text-green-500" />,
  info: <Info className="h-4 w-4 text-gray-500" />,
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

export const DebugPanel = () => {
  const { logs, clearLogs } = useDebug();
  const scrollRef = useRef<HTMLDivElement>(null);

  // [--BLOCO--] Rola para o final da lista de logs quando novos logs são adicionados
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="neumorphic-convex dark:neumorphic-convex-dark rounded-2xl p-4 flex flex-col h-full bg-plate-dark/10 dark:bg-plate/5">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-dark-shadow dark:border-dark-dark-shadow">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Debug</h3>
        <Button onClick={clearLogs} variant="default" className="!p-2 !shadow-none" title="Limpar Logs">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 space-y-2 text-xs font-mono">
        {logs.map((log, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-gray-400 dark:text-gray-500">{formatTime(log.timestamp)}</span>
            <div className="flex-shrink-0 mt-0.5">{statusIcons[log.status]}</div>
            <div className="flex-1 break-words">
              <span className="font-bold text-primary dark:text-blue-400">[{log.status.toUpperCase()}]</span> {log.source}: <span className="text-gray-600 dark:text-gray-300">{log.message}</span>
            </div>
          </div>
        ))}
         {logs.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            Aguardando eventos...
          </div>
        )}
      </div>
    </div>
  );
};
