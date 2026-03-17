/*
  # [Operation Name]
  Criação de Funções para Gerenciamento de Orçamentos (Budgets)

  ## Query Description: [This operation creates two new PostgreSQL functions in the public schema to handle budget data stored within the 'budgets' JSONB column of the 'chats' table.
  1. `get_all_budgets()`: This function unnests the JSONB array of budgets from all chats, returning a flattened view of each budget item along with its parent chat ID and associated company/contact names. This is a read-only operation and is safe to run.
  2. `update_budget_status_in_chat()`: This function allows updating the status and loss reason of a specific budget item within a chat's 'budgets' array. It performs a read-modify-write operation on the JSONB data, ensuring data integrity. It is designed to be safe but modifies existing data.]

  ## Metadata:
  - Schema-Category: ["Structural", "Data"]
  - Impact-Level: ["Low"]
  - Requires-Backup: [false]
  - Reversible: [true]

  ## Structure Details:
  - Functions Created:
    - `public.get_all_budgets()`
    - `public.update_budget_status_in_chat(p_chat_id uuid, p_budget_id text, p_new_status text, p_loss_reason text)`

  ## Security Implications:
  - RLS Status: [Enabled]
  - Policy Changes: [No]
  - Auth Requirements: [The functions are defined with `SECURITY INVOKER`, meaning they run with the permissions of the calling user, respecting existing RLS policies.]

  ## Performance Impact:
  - Indexes: [The `get_all_budgets` function will benefit from the existing GIN index on the `budgets` column (`idx_chats_budgets_gin`).]
  - Triggers: [No]
  - Estimated Impact: [Low. The functions are optimized for their specific tasks. `get_all_budgets` performs a sequential scan but is intended for dashboard-like views where all data is needed. `update_budget_status_in_chat` targets a single row and should be fast.]
*/

-- Function to get all budgets from all chats
CREATE OR REPLACE FUNCTION public.get_all_budgets()
RETURNS TABLE(
    chat_id uuid,
    company_name text,
    contact_name text,
    budget jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as chat_id,
        co.trade_name as company_name,
        ct.full_name as contact_name,
        b.value as budget
    FROM
        public.chats c,
        jsonb_array_elements(c.budgets) with ordinality b(value, position)
    LEFT JOIN public.companies co ON c.company_id = co.id
    LEFT JOIN public.contacts ct ON c.contact_id = ct.id
    WHERE
        jsonb_typeof(c.budgets) = 'array' AND jsonb_array_length(c.budgets) > 0;
END;
$$;

-- Function to update a budget's status within the JSONB array of a chat
CREATE OR REPLACE FUNCTION public.update_budget_status_in_chat(
    p_chat_id uuid,
    p_budget_id text,
    p_new_status text,
    p_loss_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    current_budgets jsonb;
    updated_budgets jsonb;
    budget_element jsonb;
    new_budget_element jsonb;
    i int;
BEGIN
    -- Get the current budgets array for the specified chat
    SELECT budgets INTO current_budgets FROM public.chats WHERE id = p_chat_id;

    -- If no budgets, do nothing
    IF current_budgets IS NULL OR jsonb_typeof(current_budgets) != 'array' THEN
        RETURN;
    END IF;

    -- Rebuild the array, updating the target budget item
    updated_budgets := '[]'::jsonb;
    FOR i IN 0..jsonb_array_length(current_budgets) - 1 LOOP
        budget_element := current_budgets -> i;
        
        -- Check if this is the budget item we want to update
        IF (budget_element ->> 'id') = p_budget_id THEN
            -- Create the updated budget element
            new_budget_element := budget_element
                || jsonb_build_object('status', p_new_status)
                || jsonb_build_object('updated_at', now())
                || jsonb_build_object('loss_reason', p_loss_reason);
            updated_budgets := updated_budgets || new_budget_element;
        ELSE
            updated_budgets := updated_budgets || budget_element;
        END IF;
    END LOOP;

    -- Update the chat row with the new budgets array
    UPDATE public.chats
    SET budgets = updated_budgets, updated_at = now()
    WHERE id = p_chat_id;
END;
$$;
