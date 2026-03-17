/*
-- ===================================================
-- Código             : /src/superMa/superMaTypes.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-09 23:55 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo :
--   Definir tipos centrais para o módulo Super MA,
--   garantindo contrato único entre App, Controller e Services.
-- Fluxo              : App -> useSuperMaController -> Service (DEV/PROD)
-- Alterações (1.0.0) :
--   • Criação inicial dos tipos de estado, responses e interfaces.
-- Dependências       : Nenhuma
-- ===================================================
*/

export type SuperMaUIMode = 'AS_USER' | 'MA_GLOBAL' | 'IDLE';

export interface SuperMaState {
  /** Indica se o modo AS_USER está ativo */
  isActive: boolean;

  /** Modo relatado pelo serviço (AS_USER / MA_GLOBAL) */
  currentMode: SuperMaUIMode;

  /** Tema original do usuário antes de entrar no Super MA */
  previousTheme: string | null;

  /** Indica se o modal está aberto */
  isModalOpen: boolean;
}

export interface SuperMaService {
  /** Entrar no modo Super MA (DEV → impersonação real, PROD → simulado) */
  enter(profileId: string): Promise<{ mode: SuperMaUIMode }>;

  /** Sair do modo Super MA */
  exit(): Promise<{ mode: SuperMaUIMode }>;
}

export interface SuperMaController {
  /** Evento global disparado pelo App ao apertar a hotkey */
  handleHotkey(event: KeyboardEvent): void;

  /** Componente modal pronto para renderização */
  SuperMaModal: JSX.Element;

  /** Estado lido pelo Controller */
  state: SuperMaState;
}
