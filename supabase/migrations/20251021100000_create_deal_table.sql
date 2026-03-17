/*
================================================================================
Parte 1: Definição dos Tipos ENUM
================================================================================
*/

/*
# [Operation] Criação do tipo ENUM `deal_pipeline_stage`
Define as etapas do funil de vendas para as oportunidades.

## Query Description: [Cria um novo tipo de dado (ENUM) que não afeta dados existentes, pois é usado apenas pela nova tabela `deal`. A operação é segura e reversível (DROP TYPE).]
## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]
*/
CREATE TYPE public.deal_pipeline_stage AS ENUM (
    'Captura',
    'Qualificação',
    'Proposta',
    'Negociação',
    'Fechamento'
);

/*
# [Operation] Criação do tipo ENUM `deal_status`
Define os estados lógicos de uma oportunidade (aberta, ganha, perdida, etc.).

## Query Description: [Cria um novo tipo de dado (ENUM) que não afeta dados existentes. A operação é segura e reversível (DROP TYPE).]
## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]
*/
CREATE TYPE public.deal_status AS ENUM (
    'open',
    'won',
    'lost',
    'on_hold'
);


/*
================================================================================
Parte 2: Criação da Tabela `deal`
================================================================================
*/

/*
# [Operation] Criação da tabela `deal`
Cria a tabela para armazenar as oportunidades comerciais, com todas as colunas,
relacionamentos e valores padrão necessários.

## Query Description: [Esta operação cria uma nova tabela (`deal`) e não modifica ou exclui dados existentes. É uma operação estrutural segura. As chaves estrangeiras garantem a integridade referencial com as tabelas `org_tenants`, `companies`, `contacts` e `profiles`.]
## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]
## Structure Details:
- Table: `public.deal`
- Columns: `id`, `tenant_id`, `company_id`, `primary_contact_id`, `owner_user_id`, `pipeline_stage`, `status`, `is_archived`, `amount`, `currency`, `temperature`, `source`, `closed_at`, `loss_reason`, `loss_detail`, `created_at`, `updated_at`, `created_by`, `updated_by`, `export_state`
- Constraints: PRIMARY KEY, FOREIGN KEYs, NOT NULL
*/
CREATE TABLE public.deal (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.org_tenants(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    primary_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
    owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    pipeline_stage public.deal_pipeline_stage NOT NULL DEFAULT 'Captura'::public.deal_pipeline_stage,
    status public.deal_status NOT NULL DEFAULT 'open'::public.deal_status,
    is_archived boolean NOT NULL DEFAULT false,
    amount numeric(15, 2) NULL,
    currency text NOT NULL DEFAULT 'BRL'::text,
    temperature jsonb NOT NULL DEFAULT '{}'::jsonb,
    source jsonb NOT NULL DEFAULT '{}'::jsonb,
    closed_at timestamptz NULL,
    loss_reason text NULL,
    loss_detail text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    export_state text NOT NULL DEFAULT 'Create'::text,
    CONSTRAINT deal_owner_fk CHECK (owner_user_id IS NOT NULL)
);

COMMENT ON TABLE public.deal IS 'Armazena as oportunidades comerciais (negócios).';


/*
================================================================================
Parte 3: Trigger de Atualização
================================================================================
*/

/*
# [Operation] Criação do trigger `handle_deal_updated_at`
Cria um trigger para atualizar automaticamente a coluna `updated_at` na tabela `deal`
a cada modificação de um registro.

## Query Description: [Esta operação adiciona um gatilho que executa uma função existente (`app_set_updated_at`) antes de cada `UPDATE` na tabela `deal`. É uma operação segura que garante a consistência dos dados de auditoria.]
## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]
*/
CREATE TRIGGER handle_deal_updated_at
BEFORE UPDATE ON public.deal
FOR EACH ROW
EXECUTE FUNCTION public.app_set_updated_at();


/*
================================================================================
Parte 4: Função Auxiliar e Políticas de RLS
================================================================================
*/

/*
# [Operation] Função auxiliar `get_my_profile_id`
Cria ou substitui uma função que retorna o ID do perfil do usuário autenticado.

## Query Description: [Esta função auxiliar busca o `id` da tabela `profiles` que corresponde ao `uid` do usuário autenticado no Supabase. É uma função de leitura segura, definida com `SECURITY DEFINER` para ser usada dentro das políticas de RLS. Não afeta dados existentes.]
## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]
*/
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


/*
# [Operation] Habilitação de RLS e criação de políticas para `deal`
Ativa a segurança a nível de linha (RLS) e define as políticas de acesso para
garantir que os usuários só possam interagir com seus próprios negócios.

## Query Description: [Esta operação ativa a RLS na tabela `deal` e cria políticas para `SELECT`, `INSERT`, `UPDATE` e `DELETE`. As políticas garantem que um usuário só pode acessar os negócios dos quais ele é o proprietário (`owner_user_id`). É uma operação de segurança crítica que isola os dados dos usuários.]
## Metadata:
- Schema-Category: ["Dangerous"]
- Impact-Level: ["High"]
- Requires-Backup: [false]
- Reversible: [true]
## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [Yes]
- Auth Requirements: [As políticas dependem do `auth.uid()` e da função `get_my_profile_id()`.]
*/
ALTER TABLE public.deal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deals are visible to their owners"
ON public.deal FOR SELECT
USING (owner_user_id = public.get_my_profile_id());

CREATE POLICY "Users can insert their own deals"
ON public.deal FOR INSERT
WITH CHECK (owner_user_id = public.get_my_profile_id());

CREATE POLICY "Users can update their own deals"
ON public.deal FOR UPDATE
USING (owner_user_id = public.get_my_profile_id());

CREATE POLICY "Users can delete their own deals"
ON public.deal FOR DELETE
USING (owner_user_id = public.get_my_profile_id());
