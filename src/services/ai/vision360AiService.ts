/*
-- ===================================================
-- Código             : /src/services/ai/vision360AiService.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-04 03:00 (America/Sao_Paulo)
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviço de IA para Visão 360, enviando payload
--                      de empresa (Visão 360) ao Gemini 2.5 Flash e
--                      retornando uma Vision360AiAnalysis consistente.
-- Fluxo              : vision360Service -> vision360AiService -> geminiChatService
-- Alterações (1.0.0) :
--   • Criação inicial de analyzeCompanyVision360().
--   • Implementada limpeza básica de texto da IA (cleanAiJson), removendo fences
--     de código e recortando entre a primeira "{" e a última "}".
--   • Implementado "repair" leve de JSON (repairJsonString):
--       - troca aspas tipográficas por aspas duplas;
--       - remoção de vírgulas antes de } ou ];
--       - balanceamento simples de chaves e colchetes.
--   • System prompt especializado para Visão 360 com contrato explícito de JSON:
--       - sempre responder em pt-BR;
--       - apenas JSON válido, sem texto fora do JSON;
--       - não usar IDs/UUIDs em texto legível ao usuário;
--       - em highlighted_actions incluir action_id + action_subject.
--   • Garantido que company_id da análise seja forçado a partir de payload.company.id.
-- Dependências        : @/services/ai/geminiChatService (generateGeminiContent),
--                       @/types/vision360 (Vision360CompanyAiPayload, Vision360AiAnalysis)
-- Camadas             :
--   • Lógica  : limpeza/repair de JSON + montagem de prompts.
--   • Serviço : analyzeCompanyVision360 (orquestra chamada ao modelo Gemini).
--   • Dados   : integração HTTP com provider de IA via geminiModelsService.
-- ===================================================
*/

import { generateGeminiContent } from '@/services/ai/geminiChatService';
import {
  Vision360CompanyAiPayload,
  Vision360AiAnalysis,
} from '@/types/vision360';

/* ============================================================
 * LIMPEZA BÁSICA DO TEXTO DA IA (similar ao cleanAiJson das ações)
 * ========================================================== */
function cleanAiJson(raw: string): string {
  if (!raw) return raw;

  let cleaned = raw.trim();

  // Remove ```json ... ``` ou ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/u, '');
    cleaned = cleaned.replace(/```$/u, '');
  }

  // Em casos extremos, tenta cortar antes do primeiro "{" e depois do último "}".
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

/* ============================================================
 * TENTATIVA DE REPARAR JSON LEVEMENTE INVÁLIDO
 * ========================================================== */
function repairJsonString(text: string): string {
  let s = text;

  // 1) Trocar aspas “ ” por " se aparecerem
  s = s.replace(/[“”]/g, '"');

  // 2) Remover vírgulas antes de } ou ]
  s = s.replace(/,(\s*[}\]])/g, '$1');

  // 3) Balancear chaves e colchetes (fechar se faltou)
  const openBraces = (s.match(/{/g) || []).length;
  const closeBraces = (s.match(/}/g) || []).length;
  if (openBraces > closeBraces) {
    s += '}'.repeat(openBraces - closeBraces);
  }

  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/]/g) || []).length;
  if (openBrackets > closeBrackets) {
    s += ']'.repeat(openBrackets - closeBrackets);
  }

  return s;
}

/* ============================================================
 * SYSTEM PROMPT ESPECIALIZADO PARA VISÃO 360
 * ========================================================== */
function buildVision360SystemPrompt(): string {
  return `
Você é uma IA analítica especializada em CRM B2B.
Receberá um JSON completo com informações de uma conta (empresa), incluindo:
- dados gerais da empresa
- período analisado
- quantidade de ações abertas e concluídas
- taxa de conclusão
- distribuição de temperatura das ações
- resumo de orçamentos por status e valor
- tags mais frequentes
- uma amostra das ações recentes com descrições e orçamentos associados

Sua tarefa é:
1) Avaliar a saúde geral da conta.
2) Identificar riscos e oportunidades reais (somente com base nos dados).
3) Sintetizar temas recorrentes da conta.
4) Propor próximos passos objetivos.
5) Criar um template opcional de nota (note_template) que o usuário poderá salvar.

REGRAS IMPORTANTES:
- Responda SEMPRE em Português do Brasil.
- Responda APENAS com um JSON VÁLIDO, sem comentários e sem texto fora do JSON.
- Use SEMPRE aspas duplas em chaves e valores de string.
- NÃO use vírgula após o último item de um objeto ou array.
- NÃO inclua tipos TypeScript (ex.: string | null) dentro do JSON de resposta.
- Quando não souber um valor de texto, use null.
- Quando não souber uma lista, use [].
- Quando se referir a uma ação específica (tarefa/chat), NUNCA use o id ou UUID como texto visível para o usuário.
  Em vez disso, use SEMPRE o assunto/título da ação (por exemplo: "Follow-up com Marco sobre orçamentos pendentes").
- Em "highlighted_actions", inclua SEMPRE tanto:
  - "action_id": o identificador interno da ação (uuid ou id), e
  - "action_subject": o assunto ou título legível da ação.
- Em "followup_checklist", se precisar citar uma ação específica, use o assunto/título dessa ação no texto, e não o id.

O JSON DEVE SEGUIR EXATAMENTE ESTE FORMATO DE CHAVES (os valores abaixo são APENAS EXEMPLOS):

{
  "company_id": "uuid-da-empresa",
  "period": {
    "start_date": "2025-11-01T00:00:00.000Z",
    "end_date": "2025-11-30T23:59:59.999Z"
  },
  "health_score": 82,
  "risk_level": "medio",

  "executive_summary": "Texto em 2 ou 3 parágrafos curtos com a visão geral da conta.",
  "key_strengths": ["ponto forte 1", "ponto forte 2"],
  "key_risks": ["risco 1", "risco 2"],

  "sentiment_summary": {
    "dominant_sentiment": "positivo",
    "reasoning": "Texto explicando porque este é o sentimento dominante.",
    "distribution": {
      "positivo": 5,
      "neutro": 2,
      "negativo": 1
    }
  },

  "urgency_summary": {
    "dominant_urgency": "alta",
    "reasoning": "Texto explicando porque a urgência é alta.",
    "counts": {
      "baixa": 1,
      "media": 3,
      "alta": 4
    }
  },

  "budgets_insights": {
    "commentary": "Texto sobre o comportamento dos orçamentos (máx. 3 frases).",
    "opportunities": ["oportunidade 1", "oportunidade 2"],
    "risks": ["risco financeiro 1", "risco financeiro 2"]
  },

  "tags_insights": {
    "core_tags": ["tag1", "tag2"],
    "risk_tags": ["tag_risco1"],
    "opportunity_tags": ["tag_oportunidade1"]
  },

  "recommended_next_steps": ["próxima ação 1", "próxima ação 2"],
  "followup_checklist": ["item de checklist 1", "item de checklist 2"],

  "highlighted_actions": [
    {
      "action_id": "id-da-acao-1",
      "action_subject": "Assunto ou título da ação 1",
      "reason": "Por que esta ação é relevante."
    }
  ],

  "note_template": {
    "company_id": "uuid-da-empresa",
    "title": "Título da nota sugerida pela IA",
    "body": "Corpo completo da nota em texto.",
    "origin": "vision360_ai",
    "tags": ["tag1", "tag2"],
    "period": {
      "start_date": "2025-11-01T00:00:00.000Z",
      "end_date": "2025-11-30T23:59:59.999Z"
    }
  }
}

Repita exatamente esta estrutura de chaves. Você pode ajustar os valores conforme os dados, mas NÃO altere o formato geral.
`.trim();
}

/* ============================================================
 * USER PROMPT
 * ========================================================== */
function buildVision360UserPrompt(payload: Vision360CompanyAiPayload): string {
  return `
A seguir está o JSON com os dados da conta que você deve analisar.

JSON_DA_CONTA:
${JSON.stringify(payload, null, 2)}
`.trim();
}

/* ============================================================
 * FUNÇÃO PRINCIPAL: analyzeCompanyVision360()
 * ========================================================== */
export async function analyzeCompanyVision360(
  payload: Vision360CompanyAiPayload
): Promise<Vision360AiAnalysis | null> {
  try {
    const system = buildVision360SystemPrompt();
    const prompt = buildVision360UserPrompt(payload);

    const raw = await generateGeminiContent({
      prompt,
      system,
      temperature: 0.4,
      maxOutputTokens: 16000,
    });

    if (!raw) {
      // eslint-disable-next-line no-console
      console.error(
        '[vision360AiService] Retorno vazio de generateGeminiContent',
        { payload }
      );
      return null;
    }

    const cleaned = cleanAiJson(raw);

    // 1ª tentativa: parse direto
    try {
      const parsed = JSON.parse(cleaned) as Vision360AiAnalysis;
      parsed.company_id = payload.company.id;
      return parsed;
    } catch (jsonError) {
      // 2ª tentativa: tentar "reparar" o JSON
      const repaired = repairJsonString(cleaned);

      try {
        const parsed = JSON.parse(repaired) as Vision360AiAnalysis;
        parsed.company_id = payload.company.id;
        return parsed;
      } catch (jsonError2) {
        // Log detalhado para debug, mas sem quebrar o fluxo
        // eslint-disable-next-line no-console
        console.error(
          '[vision360AiService] Erro de parse do JSON da IA (após repair):',
          {
            errorOriginal: jsonError,
            errorRepaired: jsonError2,
            rawSnippet: raw.slice(0, 500),
            cleanedSnippet: cleaned.slice(0, 500),
            repairedSnippet: repaired.slice(0, 500),
          }
        );
        return null;
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[vision360AiService] Erro na IA da Visão 360:', error, {
      payload,
    });
    return null; // nunca explode pro front
  }
}
