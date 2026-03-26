-- =======================================================================
-- Migration : add_valor_total_orcamentos_to_cockpit_view
-- Data      : 2026-03-26
-- Objetivo  : Adicionar colunas de valor à vw_cockpit_active_companies.
--
-- Contexto:
--   • vw_cockpit_active_companies lê de vw_agendax_chats.
--   • vw_agendax_chats filtra por app.current_profile_id() (scoping por usuário).
--   • Orçamentos são JSONB em chats.budgets: [{ id, amount, status, ... }]
--
-- Status reais do DB: 'aberta', 'ganha', 'perdida', 'encerrado', 'terminado'
-- 'encerrado' e 'terminado' são excluídos de todos os totais.
--
-- Colunas adicionadas:
--   • valor_total_orcamentos : SUM de orçamentos 'aberta' (em espera de decisão)
--   • valor_abertos          : mesmo que valor_total_orcamentos (para o tooltip)
--   • valor_ganhos           : SUM de orçamentos 'ganha'
--   • valor_perdidos         : SUM de orçamentos 'perdida'
--
-- Nota: count(DISTINCT v.id) é obrigatório por causa do LEFT JOIN LATERAL —
--       sem DISTINCT, cada orçamento multiplica a contagem de ações.
-- =======================================================================

DROP VIEW IF EXISTS vw_cockpit_active_companies;

CREATE VIEW vw_cockpit_active_companies AS
SELECT
  v.company_id,
  v.company_trade_name,
  count(DISTINCT v.id)                                                                                   AS active_actions_count,
  max(v.updated_at)                                                                                      AS last_action_at,
  COALESCE(SUM(CASE WHEN (b.value->>'status') = 'aberta'  THEN (b.value->>'amount')::numeric END), 0)   AS valor_total_orcamentos,
  COALESCE(SUM(CASE WHEN (b.value->>'status') = 'aberta'  THEN (b.value->>'amount')::numeric END), 0)   AS valor_abertos,
  COALESCE(SUM(CASE WHEN (b.value->>'status') = 'ganha'   THEN (b.value->>'amount')::numeric END), 0)   AS valor_ganhos,
  COALESCE(SUM(CASE WHEN (b.value->>'status') = 'perdida' THEN (b.value->>'amount')::numeric END), 0)   AS valor_perdidos
FROM vw_agendax_chats v
LEFT JOIN LATERAL jsonb_array_elements(v.budgets) AS b(value) ON true
WHERE v.is_done = false
  AND v.company_id IS NOT NULL
GROUP BY v.company_id, v.company_trade_name
ORDER BY max(v.updated_at) DESC;

GRANT SELECT ON vw_cockpit_active_companies TO authenticated;
