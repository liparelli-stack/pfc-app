-- =======================================================================
-- Migration : add_valor_total_orcamentos_to_cockpit_view
-- Data      : 2026-03-26
-- Objetivo  : Adicionar coluna valor_total_orcamentos à vw_cockpit_active_companies.
--
-- Contexto:
--   • vw_cockpit_active_companies lê de vw_agendax_chats.
--   • vw_agendax_chats filtra por app.current_profile_id() (scoping por usuário).
--   • Orçamentos são JSONB em chats.budgets: [{ id, amount, status, ... }]
--   • Somamos todos os amounts dos budgets das ações ativas (is_done = false).
--   • count(DISTINCT v.id) é obrigatório por causa do LEFT JOIN LATERAL:
--     sem DISTINCT, cada orçamento multiplica a contagem de ações.
-- =======================================================================

DROP VIEW IF EXISTS vw_cockpit_active_companies;

CREATE VIEW vw_cockpit_active_companies AS
SELECT
  v.company_id,
  v.company_trade_name,
  count(DISTINCT v.id)                         AS active_actions_count,
  max(v.updated_at)                            AS last_action_at,
  COALESCE(SUM((b.value ->> 'amount')::numeric), 0) AS valor_total_orcamentos
FROM vw_agendax_chats v
LEFT JOIN LATERAL jsonb_array_elements(v.budgets) AS b(value) ON true
WHERE v.is_done = false
  AND v.company_id IS NOT NULL
GROUP BY v.company_id, v.company_trade_name
ORDER BY max(v.updated_at) DESC;

GRANT SELECT ON vw_cockpit_active_companies TO authenticated;
