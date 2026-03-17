/*
================================================================================
Código: /src/lib/debugEmitter.ts
Versão: 1.0.0
Data/Hora: 2025-10-09 10:00
Autor: Dualite Alpha (AD)
Objetivo: Criar um emissor de eventos global para logs de depuração, desacoplando
          a lógica de logging da hierarquia de componentes React.
Fluxo: Usado por qualquer componente/serviço para emitir logs. O DebugProvider
       escuta esses eventos.
Dependências: Nenhuma
================================================================================
*/

type Listener = (data: any) => void;

class DebugEventEmitter {
  private listeners: { [event: string]: Listener[] } = {};

  on(event: string, listener: Listener): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Listener): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, data: any): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => listener(data));
  }
}

export const debugEmitter = new DebugEventEmitter();

export type LogPayload = {
  status: 'start' | 'end' | 'info';
  message: string;
  source: string;
};

export const addLog = (log: LogPayload) => {
  debugEmitter.emit('log', log);
};
