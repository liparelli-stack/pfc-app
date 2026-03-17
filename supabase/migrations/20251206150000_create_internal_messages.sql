/*
-- ===================================================
-- Código             : /supabase/migrations/20251206150000_create_internal_messages.sql
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-06 15:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Criar a estrutura de tabelas para o sistema de mensagens internas.
-- Fluxo              : Migração -> RLS -> API/UI
-- Alterações (1.0.0) :
--   • [CREATE] Tabela `internal_threads` para agrupar conversas.
--   • [CREATE] Tabela `internal_thread_participants` para gerir o acesso.
--   • [CREATE] Tabela `internal_messages` para armazenar as mensagens.
--   • [SECURITY] Políticas de RLS para garantir a privacidade das conversas.
-- Dependências       : Tabela `public.profiles` e `public.org_tenants`.
-- ===================================================
*/

-- Tabela para agrupar conversas
CREATE TABLE public.internal_threads (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    subject text NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT internal_threads_pkey PRIMARY KEY (id),
    CONSTRAINT internal_threads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.org_tenants(id) ON DELETE CASCADE,
    CONSTRAINT internal_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.internal_threads ENABLE ROW LEVEL SECURITY;

-- Tabela de participantes para controlar o acesso
CREATE TABLE public.internal_thread_participants (
    thread_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT internal_thread_participants_pkey PRIMARY KEY (thread_id, profile_id),
    CONSTRAINT internal_thread_participants_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.internal_threads(id) ON DELETE CASCADE,
    CONSTRAINT internal_thread_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.internal_thread_participants ENABLE ROW LEVEL SECURITY;

-- Tabela para armazenar as mensagens
CREATE TABLE public.internal_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    content text NOT NULL,
    read_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT internal_messages_pkey PRIMARY KEY (id),
    CONSTRAINT internal_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.internal_threads(id) ON DELETE CASCADE,
    CONSTRAINT internal_messages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Trigger para `updated_at`
CREATE TRIGGER set_internal_threads_updated_at BEFORE UPDATE ON public.internal_threads FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();
CREATE TRIGGER set_internal_messages_updated_at BEFORE UPDATE ON public.internal_messages FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();

-- Índices
CREATE INDEX idx_internal_threads_tenant_id ON public.internal_threads(tenant_id);
CREATE INDEX idx_internal_thread_participants_profile_id ON public.internal_thread_participants(profile_id);
CREATE INDEX idx_internal_messages_thread_id ON public.internal_messages(thread_id);

-- Políticas de RLS
CREATE POLICY "Allow members to see their threads"
ON public.internal_threads FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.internal_thread_participants itp
        WHERE itp.thread_id = internal_threads.id
        AND itp.profile_id = app.current_profile_id()
    )
);

CREATE POLICY "Allow users to create threads"
ON public.internal_threads FOR INSERT
WITH CHECK (
    created_by = app.current_profile_id()
);

CREATE POLICY "Allow members to see their participation"
ON public.internal_thread_participants FOR SELECT
USING (
    profile_id = app.current_profile_id()
);

CREATE POLICY "Allow thread creator to manage participants"
ON public.internal_thread_participants FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.internal_threads it
        WHERE it.id = internal_thread_participants.thread_id
        AND it.created_by = app.current_profile_id()
    )
);

CREATE POLICY "Allow members to see messages in their threads"
ON public.internal_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.internal_thread_participants itp
        WHERE itp.thread_id = internal_messages.thread_id
        AND itp.profile_id = app.current_profile_id()
    )
);

CREATE POLICY "Allow members to send messages in their threads"
ON public.internal_messages FOR INSERT
WITH CHECK (
    profile_id = app.current_profile_id()
    AND EXISTS (
        SELECT 1
        FROM public.internal_thread_participants itp
        WHERE itp.thread_id = internal_messages.thread_id
        AND itp.profile_id = app.current_profile_id()
    )
);

CREATE POLICY "Allow users to update their own messages"
ON public.internal_messages FOR UPDATE
USING (
    profile_id = app.current_profile_id()
);

CREATE POLICY "Allow users to delete their own messages"
ON public.internal_messages FOR DELETE
USING (
    profile_id = app.current_profile_id()
);
