/*
-- ===================================================
-- Código             : /src/services/dashboardService_vw.ts
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-17 00:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviço do Dashboard para leitura da agenda do usuário
--                      logado ("minhas ações") sem depender da view
--                      vw_dashboard_user_agenda, buscando direto em chats e
--                      expandindo empresa/contato via relacionamentos.
-- Fluxo              : useDashboardQuadro2_vw -> dashboardService_vw
--                      -> chats (+ companies, contacts)
-- Alterações (1.1.0) :
--   • Remove dependência da view vw_dashboard_user_agenda.
--   • Busca em public.chats com filtros:
--       - author_user_id = current_profile.id
--       - calendar_at IS NOT NULL
--       - is_done = false
--   • Inclui joins para:
--       - companies.trade_name -> company_name
--       - contacts.full_name   -> contact_name
-- Dependências       : @/lib/supabaseClient, @/services/profilesService
-- ===================================================
*/

import { supabase } from "@/lib/supabaseClient";
import { getCurrentProfile } from "@/services/profilesService";

/**
 * Item da agenda do usuário exibida no Dashboard.
 * Agora baseado em public.chats (não depende mais de view).
 */
export type DashboardUserAgendaItem = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  contact_id: string | null;
  author_user_id: string;
  kind: string | null;
  direction: string | null;
  channel_type: string | null;
  subject: string | null;
  body: string | null;
  priority: string | null;
  calendar_at: string; // timestamptz → ISO string
  on_time: string | null;
  timezone: string | null;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  updated_at: string;

  // Enriquecimento para UI (modo compacto)
  company_name: string | null;
  contact_name: string | null;
};

type ChatsRowWithJoins = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  contact_id: string | null;
  author_user_id: string;
  kind: string | null;
  direction: string | null;
  channel_type: string | null;
  subject: string | null;
  body: string | null;
  priority: string | null;
  calendar_at: string;
  on_time: string | null;
  timezone: string | null;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  updated_at: string;

  // PostgREST embedded selects (podem vir como objeto ou array dependendo do relacionamento)
  companies?: { trade_name?: string | null } | { trade_name?: string | null }[] | null;
  contacts?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

const pickOne = <T,>(v: T | T[] | null | undefined): T | null => {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
};

/**
 * Lê a agenda do usuário logado:
 *  - Somente pendentes (is_done = false)
 *  - Somente itens com data de agenda (calendar_at IS NOT NULL)
 *  - Somente do autor (author_user_id = profile.id)
 *
 * Traz também:
 *  - companies.trade_name  -> company_name
 *  - contacts.full_name    -> contact_name
 */
export async function getDashboardUserAgenda(): Promise<DashboardUserAgendaItem[]> {
  const profile = await getCurrentProfile();
  const profileId = profile?.id;

  if (!profileId) return [];

  const { data, error } = await supabase
    .from("chats")
    .select(
      `
      id,
      tenant_id,
      company_id,
      contact_id,
      author_user_id,
      kind,
      direction,
      channel_type,
      subject,
      body,
      priority,
      calendar_at,
      on_time,
      timezone,
      is_done,
      done_at,
      created_at,
      updated_at,
      companies:companies ( trade_name ),
      contacts:contacts ( full_name )
    `
    )
    .eq("author_user_id", profileId)
    .eq("is_done", false)
    .not("calendar_at", "is", null)
    .order("calendar_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as ChatsRowWithJoins[];

  return rows.map((r) => {
    const companyObj = pickOne(r.companies);
    const contactObj = pickOne(r.contacts);

    return {
      id: r.id,
      tenant_id: r.tenant_id,
      company_id: r.company_id,
      contact_id: r.contact_id,
      author_user_id: r.author_user_id,
      kind: r.kind,
      direction: r.direction,
      channel_type: r.channel_type,
      subject: r.subject,
      body: r.body,
      priority: r.priority,
      calendar_at: r.calendar_at,
      on_time: r.on_time,
      timezone: r.timezone,
      is_done: r.is_done,
      done_at: r.done_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      company_name: (companyObj?.trade_name ?? null) as string | null,
      contact_name: (contactObj?.full_name ?? null) as string | null,
    };
  });
}
