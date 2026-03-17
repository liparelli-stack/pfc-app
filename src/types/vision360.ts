/*
-- ===================================================
-- Código             : /src/types/vision360.ts
-- Versão (.v20)      : 1.3.0
-- Data/Hora          : 2025-12-03 10:45 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Tipos para Visão 360 (detalhes do cliente, oportunidades e IA).
-- Fluxo              : services/vision360Service -> services/ai/vision360AiService -> components/vision360/*
-- Alterações (1.3.0) :
--   • Mantido CustomerDetails baseado em CompanyWithContactsAndOwner.
--   • Mantido DealWithChats aninhando Deal + Chat[].
--   • Adicionados tipos de payload para IA da Visão 360:
--       - Vision360BudgetForAi
--       - Vision360CompanyActionForAi
--       - Vision360CompanyAiPayload
--       - Vision360AiNoteTemplate
--       - Vision360AiAnalysis
--   • Incluído campo opcional note_template em Vision360AiAnalysis
--     para permitir botão "gravar nota" na Visão 360.
-- Dependências        : ./company, ./deal, ./chat
-- ===================================================
*/

import { CompanyWithContactsAndOwner } from './company';
import { Deal } from './deal';
import { Chat } from './chat';

/**
 * Representa os detalhes completos de uma empresa para exibição na Visão 360.
 * Reutiliza CompanyWithContactsAndOwner:
 *  - dados da empresa (Company)
 *  - contacts: Contact[]
 *  - owner_name: string | null (profiles.full_name do responsável)
 */
export type CustomerDetails = CompanyWithContactsAndOwner;

/**
 * Representa uma oportunidade com seu histórico de chats aninhado.
 */
export interface DealWithChats extends Deal {
  chats: Chat[];
}

/* ============================================================================
 * Tipos de suporte para IA da Visão 360
 * ========================================================================== */

/**
 * Orçamento utilizado no contexto da IA da Visão 360.
 * Geralmente deriva de chats.budgets (jsonb) já expandido em colunas lógicas.
 */
export interface Vision360BudgetForAi {
  id: string;
  amount: number | null;
  status: string;       // ex.: "aberta" | "ganha" | "perdida"
  updated_at: string;   // ISO-8601
  description: string;  // descrição curta do orçamento
  loss_reason?: string | null;
}

/**
 * Ação individual considerada na análise da Visão 360.
 * Normalmente corresponde a um registro em chats, com campos relevantes
 * para entender contexto, prioridade e orçamentos associados.
 */
export interface Vision360CompanyActionForAi {
  id: string;
  created_at: string;          // ISO-8601
  is_done: boolean;
  kind: string | null;         // tarefa, ligação, whatsapp, email, reunião etc.
  channel_type: string | null; // canal (ligação, whatsapp, email, tarefa...)
  direction: string | null;    // inbound, outbound, neutro...
  priority: string | null;     // baixa, media, alta...
  temperature: string | null;  // neutra, quente... (campo do cockpit)
  tags: string[];              // nomes das tags (slug ou name já normalizados)
  body: string;                // descrição limpa/truncada da ação
  budgets: Vision360BudgetForAi[];

  /**
   * Se a IA de "Registrar Ação" já tiver sido executada para essa ação,
   * é possível reaproveitar os campos abaixo para enriquecer a Visão 360.
   */
  ai_sentiment?: 'positivo' | 'neutro' | 'negativo' | null;
  ai_urgency?: 'baixa' | 'media' | 'alta' | null;
}

/**
 * Payload completo enviado ao modelo Gemini 2.5 para análise da Visão 360.
 * Representa o "raio X" da conta em um período.
 */
export interface Vision360CompanyAiPayload {
  company: {
    id: string;
    trade_name: string;
    kind?: string | null;     // client, prospect etc.
    segment?: string | null;  // ex.: hospital, indústria...
    status?: string | null;   // active, inactive...
  };

  period: {
    start_date: string; // ISO-8601
    end_date: string;   // ISO-8601
  };

  metrics: {
    actions_open: number;
    actions_closed: number;
    /**
     * Taxa de conclusão das ações no período.
     * Definir convenção: 0–1 ou 0–100 (o front/serviço deve padronizar).
     */
    completion_rate: number;
    /**
     * Distribuição das ações por temperatura (do cockpit),
     * ex.: { "fria": 3, "morna": 5, "quente": 2 }.
     */
    temperature_distribution: Record<string, number>;
  };

  /**
   * Resumo numérico de orçamentos associados à conta,
   * independente das ações individuais.
   */
  budget_summary: {
    total_amount: number;
    total_open_amount: number;
    total_won_amount: number;
    total_lost_amount: number;
    count_open: number;
    count_won: number;
    count_lost: number;
  };

  /**
   * Visão agregada de tags utilizadas nas ações da conta.
   */
  tags_summary: {
    top_tags: string[];          // top N tags por frequência (ex.: 10)
    total_distinct_tags: number; // quantidade total de tags distintas no período
  };

  /**
   * Resumo opcional quando a IA por ação já tiver sido executada previamente.
   */
  ai_actions_summary?: {
    last_analysis_at: string | null; // ISO-8601 ou null
    sentiment_distribution: {
      positivo: number;
      neutro: number;
      negativo: number;
    };
    urgency_distribution: {
      baixa: number;
      media: number;
      alta: number;
    };
  };

  /**
   * Amostra das ações recentes, ordenadas por recência.
   * Recomenda-se limitar a quantidade (ex.: últimas 20–50) e truncar o texto
   * para evitar excesso de tokens.
   */
  actions_sample: Vision360CompanyActionForAi[];
}

/**
 * Estrutura de uma nota sugerida pela IA da Visão 360.
 *
 * A ideia é que a UI apresente um botão do tipo:
 *   "Gravar nota da análise da IA"
 *
 * Ao clicar, o front pode usar este template para criar uma nova nota
 * vinculada à empresa (company_id), preenchendo:
 *   - data/hora: NOW() no backend
 *   - origem: "vision360_ai" (campo origin)
 */
export interface Vision360AiNoteTemplate {
  /**
   * Identificador da empresa à qual a nota deverá ser vinculada.
   */
  company_id: string;

  /**
   * Título sugerido para a nota (pode ser usado como subject/resumo).
   */
  title: string;

  /**
   * Corpo completo da nota (texto pronto para ser salvo).
   */
  body: string;

  /**
   * Origem lógica da nota, para rastrear que foi gerada pela IA da Visão 360.
   * O backend pode usar este valor em um campo "origin" ou similar.
   */
  origin: 'vision360_ai';

  /**
   * Tags sugeridas para serem associadas à nota (opcional).
   * O serviço de notas pode mapear isso para tags existentes ou criar novas.
   */
  tags?: string[];

  /**
   * Período que deu origem à análise/notas (opcional),
   * útil para rastreabilidade no histórico.
   */
  period?: {
    start_date: string;
    end_date: string;
  };
}

/**
 * Resposta consolidada do modelo Gemini 2.5 para a Visão 360.
 * Este JSON deve ser retornado exatamente neste formato pela IA.
 */
export interface Vision360AiAnalysis {
  company_id: string;

  period: {
    start_date: string;
    end_date: string;
  };

  /**
   * Indicador geral da "saúde" da conta, para uso em termômetros/KPIs.
   * Escala sugerida: 0–100.
   */
  health_score: number;

  /**
   * Nível geral de risco da conta.
   */
  risk_level: 'baixo' | 'medio' | 'alto';

  /**
   * Resumo executivo da situação da conta (3–6 parágrafos curtos).
   */
  executive_summary: string;

  /**
   * Pontos fortes identificados na conta.
   */
  key_strengths: string[];

  /**
   * Riscos e pontos de atenção identificados na conta.
   */
  key_risks: string[];

  /**
   * Análise agregada de sentimento ao longo das ações.
   */
  sentiment_summary: {
    dominant_sentiment: 'positivo' | 'neutro' | 'negativo';
    reasoning: string;
    distribution: {
      positivo: number;
      neutro: number;
      negativo: number;
    };
  };

  /**
   * Análise agregada de urgência ao longo das ações.
   */
  urgency_summary: {
    dominant_urgency: 'baixa' | 'media' | 'alta';
    reasoning: string;
    counts: {
      baixa: number;
      media: number;
      alta: number;
    };
  };

  /**
   * Insights específicos sobre orçamentos e oportunidades financeiras.
   */
  budgets_insights: {
    commentary: string;     // análise textual (taxa de ganho, pipe, concentração etc.)
    opportunities: string[]; // oportunidades percebidas
    risks: string[];         // riscos financeiros/pipe
  };

  /**
   * Insights baseados em tags e temas recorrentes.
   */
  tags_insights: {
    core_tags: string[];        // temas centrais da conta
    risk_tags: string[];        // tags ligadas a problemas/riscos
    opportunity_tags: string[]; // tags ligadas a expansão/oportunidades
  };

  /**
   * Ações práticas sugeridas para o time (nível conta, não por ação).
   */
  recommended_next_steps: string[];

  /**
   * Checklist geral sugerido para acompanhamento da conta.
   */
  followup_checklist: string[];

  /**
   * Destaques de ações específicas que merecem atenção.
   * A UI pode usar isto para criar links/anchors para o histórico.
   */
  highlighted_actions: Array<{
    action_id: string;
    reason: string;
  }>;

  /**
   * Template de nota que pode ser gravada via botão na Visão 360.
   * Quando presente, a UI pode exibir um botão:
   *   "Gravar nota com base nessa análise"
   * que dispara a criação de uma nova nota para a empresa.
   */
  note_template?: Vision360AiNoteTemplate;
}
