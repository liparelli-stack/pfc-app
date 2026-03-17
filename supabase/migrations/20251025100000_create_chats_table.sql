/*
-- ===================================================
-- Código: /supabase/migrations/20251025100000_create_chats_table.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-25 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar a tabela `chats` para registrar conversas, tarefas e follow-ups.
-- Fluxo: Esta tabela será usada pelo futuro módulo de comunicação do CRM.
-- Dependências: public.org_tenants, public.companies, public.contacts, public.deals, public.profiles, public.app_set_updated_at()
-- ===================================================
*/

-- [--BLOCO--] Criação da tabela `chats`
CREATE TABLE public.chats (
    -- [--NOTA--] Chaves e Identificadores
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    company_id uuid,
    contact_id uuid,
    deal_id uuid,
    author_user_id uuid NOT NULL,
    thread_id uuid,
    reply_to_id uuid,

    -- [--NOTA--] Classificação e Conteúdo
    kind text NOT NULL,
    direction text,
    channel_type text,
    subject text,
    body text,

    -- [--NOTA--] Metadados e Status
    temperature text,
    priority text,
    calendar_at date,
    on_time time without time zone,
    timezone text,
    is_done boolean NOT NULL DEFAULT false,
    done_at timestamp with time zone,

    -- [--NOTA--] Timestamps e Rastreabilidade
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    -- [--REGRA--] Chaves Estrangeiras com regras de exclusão
    CONSTRAINT chats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.org_tenants(id) ON DELETE CASCADE,
    CONSTRAINT chats_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL,
    CONSTRAINT chats_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL,
    CONSTRAINT chats_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL,
    CONSTRAINT chats_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT chats_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.chats(id) ON DELETE SET NULL
);

-- [--BLOCO--] Habilitação da Segurança a Nível de Linha (RLS)
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- [--BLOCO--] Políticas de Segurança (RLS)
-- [--REGRA--] Permite que usuários insiram registros apenas para si mesmos e dentro do tenant atual.
CREATE POLICY "Allow authors to insert their own chats"
ON public.chats
FOR INSERT
WITH CHECK (
    (tenant_id = app.current_tenant_id()) AND
    (author_user_id = app.current_profile_id())
);

-- [--REGRA--] Permite que usuários vejam, atualizem e deletem apenas os seus próprios registros.
CREATE POLICY "Allow authors to access their own chats"
ON public.chats
FOR ALL
USING (
    (tenant_id = app.current_tenant_id()) AND
    (author_user_id = app.current_profile_id())
);

-- [--BLOCO--] Gatilho para atualização automática do campo `updated_at`
-- [--TÉCNICA--] Reutiliza a função `app_set_updated_at` existente no projeto.
CREATE TRIGGER set_chats_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION public.app_set_updated_at();

-- [--NOTA--] Adiciona comentários nas colunas para documentação no banco de dados.
COMMENT ON TABLE public.chats IS 'Registra conversas, tarefas e follow-ups vinculados a empresas, contatos e oportunidades.';
COMMENT ON COLUMN public.chats.kind IS 'Tipo de registro (ex: conversation, task, followup).';
COMMENT ON COLUMN public.chats.direction IS 'Direção da conversa (in, out, internal).';
COMMENT ON COLUMN public.chats.channel_type IS 'Canal da conversa (email, whatsapp, phone, system).';
COMMENT ON COLUMN public.chats.thread_id IS 'Agrupador de conversas relacionadas.';
COMMENT ON COLUMN public.chats.reply_to_id IS 'Referência a um chat anterior na mesma thread.';
