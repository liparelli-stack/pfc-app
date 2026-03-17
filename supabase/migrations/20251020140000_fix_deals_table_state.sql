/*
================================================================================
# [Fix] Correção de estado inconsistente da tabela 'deals'
[Este script corrige o estado do banco de dados após uma falha na migração de renomeação da tabela 'deal' para 'deals'. Ele é idempotente e garante que todos os objetos relacionados (tabela, tipos, gatilho, política RLS) estejam com os nomes e configurações corretas.]

## Query Description: [Esta operação é segura e não causa perda de dados. Ela apenas renomeia e ajusta objetos de banco de dados para garantir a consistência após uma migração anterior ter falhado. Nenhum backup é estritamente necessário, mas é sempre uma boa prática.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false]

## Structure Details:
- Tabela: public.deal -> public.deals
- Tipos: deal_pipeline_stage -> deals_pipeline_stage, deal_status -> deals_status
- Gatilho: set_public_deal_updated_at -> set_public_deals_updated_at
- Política RLS: deal_owner_policy_all -> deals_owner_policy_all (recriada)

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [Yes]
- Auth Requirements: [N/A]

## Performance Impact:
- Indexes: [N/A]
- Triggers: [Recreated]
- Estimated Impact: [Nenhum impacto de performance esperado.]
*/

DO $$
BEGIN
  -- Renomeia a tabela se ainda se chamar 'deal'
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal') THEN
    ALTER TABLE public.deal RENAME TO deals;
  END IF;

  -- Renomeia os ENUMs se ainda tiverem o nome antigo
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_pipeline_stage') THEN
    ALTER TYPE public.deal_pipeline_stage RENAME TO deals_pipeline_stage;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_status') THEN
    ALTER TYPE public.deal_status RENAME TO deals_status;
  END IF;

  -- Garante que a tabela 'deals' existe antes de prosseguir
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    
    -- Recria o gatilho de updated_at com o nome correto
    -- É mais seguro remover e criar do que tentar renomear
    DROP TRIGGER IF EXISTS set_public_deal_updated_at ON public.deals;
    DROP TRIGGER IF EXISTS set_public_deals_updated_at ON public.deals;
    CREATE TRIGGER set_public_deals_updated_at
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE PROCEDURE public.app_set_updated_at();

    -- Garante que a RLS está habilitada
    ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

    -- Remove políticas antigas ou com nome errado para evitar conflitos
    DROP POLICY IF EXISTS deal_owner_policy_all ON public.deals;
    DROP POLICY IF EXISTS deals_owner_policy_all ON public.deals;

    -- Cria a política correta, garantindo que a função fn_get_my_profile_id exista
    IF EXISTS (SELECT FROM pg_proc WHERE proname = 'fn_get_my_profile_id') THEN
      CREATE POLICY deals_owner_policy_all
      ON public.deals
      FOR ALL
      USING (public.fn_get_my_profile_id() = owner_user_id)
      WITH CHECK (public.fn_get_my_profile_id() = owner_user_id);
    ELSE
      -- Se a função não existir por algum motivo, a política não pode ser criada.
      -- Isso é uma proteção, mas a função deveria ter sido criada na migração anterior.
      RAISE WARNING 'A função fn_get_my_profile_id() não foi encontrada. A política de segurança para a tabela "deals" não pôde ser criada.';
    END IF;

  END IF;
END;
$$;
