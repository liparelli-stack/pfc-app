/*
-- ===================================================
-- Código             : /src/services/ai/actionsAiService.ts
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-12-03 20:15 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Orquestrar a análise de ações do CRM via IA (Gemini),
--                      gerando insights estruturados (resumo, sentimento,
--                      urgência, próximos passos, etiquetas e checklist)
--                      a partir do campo "Descreva a Ação ou Conversa".
-- Fluxo              : EditActionForm/RegisterActionCard -> analyzeRegisterActionWithAi
--                      -> generateGeminiContent (Gemini) -> ActionAiAnalysis (JSON)
-- Alterações (1.0.0) :
--  • Criação inicial do serviço de IA para o card "Registrar Ação".
--  • Definição dos contratos RegisterActionPayload e ActionAiAnalysis.
--  • Implementação da função analyzeRegisterActionWithAi com limpeza e parse de JSON.
-- Alterações (1.1.0) :
--  • Envolvida a chamada ao Gemini em try/catch para evitar exceções não tratadas
--    estourando no front.
--  • Log mais detalhado em caso de falha (erro da API ou erro de parse).
--  • Garantia de que a função SEMPRE resolve com ActionAiAnalysis | null,
--    nunca rejeitando a Promise.
-- Alterações (1.2.0) :
--  • [PROMPT] System e user prompt simplificados para reduzir o uso de tokens,
--    mantendo o mesmo contrato de JSON.
--  • [IA] maxOutputTokens elevado para 4096 na chamada de alto nível para
--    alinhar com a camada de dados e evitar cortes prematuros.
-- Dependências       : @/services/ai/geminiChatService (generateGeminiContent)
--                      Typescript / React (consumo pelos componentes de UI)
-- Camadas            :
--  • Lógica  : montagem de prompt, limpeza e parse seguro do JSON.
--  • Serviço : função analyzeRegisterActionWithAi, exposta aos componentes.
--  • Dados   : generateGeminiContent (chamada ao provedor de IA).
-- ===================================================
*/

import { generateGeminiContent } from "@/services/ai/geminiChatService";

/**
 * Payload usado pelo front ao chamar a IA para analisar uma ação registrada.
 * Representa exatamente os campos do card "Registrar Ação".
 */
export interface RegisterActionPayload {
  acaoLabel: string;
  status: string;
  contatoNome: string;
  assunto: string;
  etiquetas: string[]; // nomes das etiquetas
  data: string; // "2025-12-02"
  hora: string; // "16:00"
  temperatura: string; // "Neutra", "Quente", etc.
  prioridade: string; // "Normal", "Alta", "Baixa"
  descricao: string; // campo "Descreva a Ação ou Conversa"
}

/**
 * Estrutura de resposta esperada da IA.
 * Enums seguem exatamente os valores combinados no prompt.
 */
export interface ActionAiAnalysis {
  summary: string | null;
  sentiment: "positivo" | "neutro" | "negativo" | null;
  urgency: "baixa" | "media" | "alta" | null;
  next_steps: string[];
  suggested_tags: string[];
  checklist: string[];
}

/**
 * Camada de lógica: monta o system prompt estável (versão enxuta).
 */
function buildSystemPrompt(): string {
  return `
Você é um assistente especializado em CRM e vendas consultivas.
Analise registros de ações com clientes (reuniões, ligações, e-mails, mensagens, visitas etc.)
e gere insights estruturados em JSON.

Regras:
- Não invente fatos; use apenas o texto e dados fornecidos.
- Responda sempre em português do Brasil.
- Se faltar informação para algum campo, use null (para string) ou [] (para listas).
  `.trim();
}

/**
 * Camada de lógica: monta o prompt do "usuário" com base no payload do card.
 * Mantém o contrato de JSON, porém com instruções mais compactas.
 */
function buildUserPrompt(payload: RegisterActionPayload): string {
  const {
    acaoLabel,
    status,
    contatoNome,
    assunto,
    etiquetas,
    data,
    hora,
    temperatura,
    prioridade,
    descricao,
  } = payload;

  const etiquetasTexto = etiquetas.length > 0 ? etiquetas.join(", ") : "nenhuma";

  return `
Dados de uma ação registrada no CRM:

- Ação: ${acaoLabel}
- Status: ${status}
- Contato: ${contatoNome}
- Assunto: ${assunto}
- Etiquetas: ${etiquetasTexto}
- Data: ${data}
- Hora: ${hora}
- Temperatura: ${temperatura}
- Prioridade: ${prioridade}

Descrição da ação ou conversa:
"""
${descricao}
"""

Instruções:
Use os dados apenas como contexto. Considere a descrição como fonte principal.
Responda APENAS com um JSON válido, sem comentários, exatamente com esta estrutura:

{
  "summary": string | null,
  "sentiment": "positivo" | "neutro" | "negativo" | null,
  "urgency": "baixa" | "media" | "alta" | null,
  "next_steps": string[],
  "suggested_tags": string[],
  "checklist": string[]
}
  `.trim();
}

/**
 * Camada de lógica: alguns modelos insistem em devolver o JSON dentro de ```...```.
 * Esta função tenta remover marcas comuns de code fence antes do parse.
 */
function cleanAiJson(raw: string): string {
  if (!raw) return raw;

  let cleaned = raw.trim();

  // Remove ```json ... ``` ou ``` ... ```
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/u, "");
    cleaned = cleaned.replace(/```$/u, "");
  }

  // Em casos extremos, tenta cortar antes do primeiro "{" e depois do último "}".
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

/**
 * Camada de serviço: função principal usada pelos componentes.
 * Dispara o prompt para o Gemini e devolve ActionAiAnalysis já tipado,
 * ou null em caso de erro de comunicação/parse.
 *
 * IMPORTANTE:
 *  • Esta função NUNCA lança exceção para o chamador.
 *  • Em qualquer erro (HTTP, chave, modelo, parse), retorna null e loga no console.
 */
export async function analyzeRegisterActionWithAi(
  payload: RegisterActionPayload
): Promise<ActionAiAnalysis | null> {
  try {
    const system = buildSystemPrompt();
    const userPrompt = buildUserPrompt(payload);

    const raw = await generateGeminiContent({
      prompt: userPrompt,
      system,
      temperature: 0.4,
      maxOutputTokens: 4096,
    });

    if (!raw) {
      // Falha silenciosa da IA – logamos para debug.
      // eslint-disable-next-line no-console
      console.error(
        "analyzeRegisterActionWithAi: retorno vazio de generateGeminiContent",
        { payload }
      );
      return null;
    }

    const cleaned = cleanAiJson(raw);

    const parsed = JSON.parse(cleaned) as ActionAiAnalysis;

    // Defesa extra: garante arrays mesmo se o modelo devolver null ou tipos estranhos.
    return {
      summary: parsed.summary ?? null,
      sentiment: parsed.sentiment ?? null,
      urgency: parsed.urgency ?? null,
      next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : [],
      suggested_tags: Array.isArray(parsed.suggested_tags)
        ? parsed.suggested_tags
        : [],
      checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "Falha geral em analyzeRegisterActionWithAi (erro na chamada ao Gemini ou no parse do JSON):",
      err,
      { payload }
    );
    return null;
  }
}
