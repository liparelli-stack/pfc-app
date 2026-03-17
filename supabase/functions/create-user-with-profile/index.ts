/*
================================================================================
Código: /supabase/functions/create-user-with-profile/index.ts
Versão: 2.0.0
Data/Hora: 2025-10-07 15:00
Autor: FL / Eva (E.V.A.)
Objetivo: [CORREÇÃO] Edge Function segura para criar um usuário (auth.users) e seu perfil (public.profiles) associado.
Fluxo: Chamada pelo frontend -> Cria usuário no Auth -> Cria perfil no DB.
Dependências: @supabase/supabase-js, ../_shared/cors.ts
Regras de Projeto:
  - Usa a Service Role Key para operações de admin.
  - Realiza rollback (deleta usuário do Auth) se a criação do perfil falhar.
================================================================================
*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // [--BLOCO--] Lógica de CORS para preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, profileData } = await req.json()

    if (!email || !password || !profileData) {
      throw new Error('Email, senha e dados do perfil são obrigatórios.')
    }

    // [--BLOCO--] Criação do cliente admin do Supabase com a Service Role Key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // [--BLOCO--] 1. Criar o usuário na tabela auth.users
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // O usuário precisará confirmar o e-mail
    })

    if (authError) {
      // [--NOTA--] Trata erro de e-mail duplicado de forma mais clara
      if (authError.message.includes('already registered')) {
        throw new Error('Este e-mail já está em uso.');
      }
      throw authError
    }

    if (!user) {
      throw new Error('Falha ao criar o usuário na autenticação.');
    }

    // [--BLOCO--] 2. Obter o tenant_id (assumindo single-tenant)
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('org_tenants')
      .select('id')
      .limit(1)
      .single();

    if (tenantError || !tenant) {
      // [--TÉCNICA--] Rollback: deleta o usuário do Auth se não encontrar a organização
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      throw new Error('Não foi possível encontrar uma organização para associar o usuário.');
    }

    // [--BLOCO--] 3. Criar o perfil na tabela public.profiles
    const profilePayload = {
      ...profileData,
      auth_user_id: user.id,
      email: user.email, // Garante que o e-mail seja consistente
      tenant_id: tenant.id,
    }

    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single()

    if (profileError) {
      // [--TÉCNICA--] Rollback: deleta o usuário do Auth se a criação do perfil falhar
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      throw profileError
    }

    return new Response(JSON.stringify(newProfile), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
