-- Migration: Orçamento Kanban Helpers
-- Description: Adiciona funções RPC para buscar e atualizar orçamentos no campo JSONB `budgets` da tabela `chats`.

-- Função para buscar todos os orçamentos de todos os chats
create or replace function get_all_budgets()
returns table (
  chat_id uuid,
  company_name text,
  contact_name text,
  budget jsonb
) as $$
begin
  return query
  select
    c.id as chat_id,
    co.trade_name as company_name,
    ct.full_name as contact_name,
    b.budget_item as budget
  from
    chats c
    join companies co on c.company_id = co.id
    left join contacts ct on c.contact_id = ct.id,
    jsonb_array_elements(c.budgets) with ordinality as b(budget_item, index)
  where
    c.budgets is not null and jsonb_array_length(c.budgets) > 0;
end;
$$ language plpgsql;

-- Função para atualizar o status de um orçamento específico
create or replace function update_budget_status_in_chat(
  p_chat_id uuid,
  p_budget_id uuid,
  p_new_status text,
  p_loss_reason text default null
)
returns void as $$
declare
  current_budgets jsonb;
  updated_budgets jsonb;
  budget_element jsonb;
  updated_element jsonb;
  i int;
begin
  -- Obter o array de orçamentos atual
  select budgets into current_budgets from chats where id = p_chat_id;

  if current_budgets is null then
    return;
  end if;

  -- Iterar sobre o array para encontrar e atualizar o orçamento
  updated_budgets := '[]'::jsonb;
  for i in 0..jsonb_array_length(current_budgets) - 1 loop
    budget_element := current_budgets -> i;
    if (budget_element->>'id')::uuid = p_budget_id then
      updated_element := budget_element || jsonb_build_object(
        'status', p_new_status,
        'loss_reason', case when p_new_status = 'perdida' then p_loss_reason else null end,
        'updated_at', now()
      );
      updated_budgets := updated_budgets || updated_element;
    else
      updated_budgets := updated_budgets || budget_element;
    end if;
  end loop;

  -- Atualizar a tabela de chats com o novo array de orçamentos
  update chats
  set budgets = updated_budgets
  where id = p_chat_id;
end;
$$ language plpgsql;
