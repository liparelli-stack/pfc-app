CREATE OR REPLACE FUNCTION get_vendedor_detalhamento(
  mes_fechamento date,
  vendedor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  budget_id text,
  chat_id uuid,
  cliente_nome text,
  status text,
  valor numeric,
  data_mudanca timestamptz,
  status_atual text,
  mudou_apos_fechamento boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendedor_id uuid;
  mes_inicio date;
  mes_fim date;
BEGIN
  -- Se vendedor_id null, pega do auth.uid()
  v_vendedor_id := COALESCE(vendedor_id, auth.uid());

  -- Calcular início e fim do mês
  mes_inicio := date_trunc('month', mes_fechamento)::date;
  mes_fim := (date_trunc('month', mes_fechamento) + interval '1 month')::date;

  RETURN QUERY
  WITH ultimo_evento_mes AS (
    SELECT DISTINCT ON (be.budget_id)
      be.budget_id,
      be.chat_id,
      be.status,
      be.amount,
      be.created_at
    FROM budget_events be
    WHERE be.salesperson_id = v_vendedor_id
      AND be.created_at >= mes_inicio
      AND be.created_at < mes_fim
    ORDER BY be.budget_id, be.created_at DESC
  ),
  status_atual_jsonb AS (
    SELECT
      c.id as chat_id,
      (b.value->>'id')::text as budget_id,
      CASE lower(b.value->>'status')
        WHEN 'ganha' THEN 'Ganha'
        WHEN 'perdida' THEN 'Perdida'
        WHEN 'terminado' THEN 'Encerrado'
        ELSE 'Aberta'
      END as status_now
    FROM chats c
    LEFT JOIN LATERAL jsonb_array_elements(c.budgets) b ON true
    WHERE c.author_user_id = v_vendedor_id
      AND c.budgets != '[]'::jsonb
  )
  SELECT
    e.budget_id,
    e.chat_id,
    COALESCE(c.nome, c.trade_name, 'Cliente não identificado') as cliente_nome,
    e.status,
    e.amount as valor,
    e.created_at as data_mudanca,
    COALESCE(s.status_now, e.status) as status_atual,
    COALESCE(e.status != s.status_now, false) as mudou_apos_fechamento
  FROM ultimo_evento_mes e
  LEFT JOIN status_atual_jsonb s ON s.budget_id = e.budget_id
  LEFT JOIN chats ch ON ch.id = e.chat_id
  LEFT JOIN companies c ON c.id = ch.company_id
  ORDER BY e.status, e.amount DESC;
END;
$$;

COMMENT ON FUNCTION get_vendedor_detalhamento IS
  'Retorna detalhamento completo dos orçamentos de um vendedor em um mês específico. ' ||
  'Compara status no fechamento vs status atual para auditoria.';
