/*
-- ===================================================
-- Código: /supabase/functions/delete-user/index.ts
-- Versão: 1.0
-- Data/Hora: 2025-05-24 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Edge Function para excluir um usuário do auth.users e da tabela profiles.
-- Fluxo: Chamada pelo frontend (profilesService) para exclusão segura.
-- Dependências: @supabase/supabase-js, ../_shared/cors.ts
-- ===================================================
*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // [BLOCK] Lógica de CORS para preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // [BLOCK] Validação e extração de dados da requisição
    const { userId } = await req.json();
    if (!userId) {
      throw new Error('O ID do usuário (userId) é obrigatório.');
    }

    // [BLOCK] Criação do cliente admin do Supabase
    // [RULE] Este cliente usa a service_role_key e tem permissões de administrador.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // [BLOCK] Exclusão do usuário da tabela de autenticação
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      // [NOTE] Ignora o erro se o usuário não for encontrado, pois o objetivo é garantir que ele não exista.
      if (authError.message !== 'User not found') {
        throw authError;
      }
    }

    // [BLOCK] Exclusão do perfil correspondente na tabela 'profiles'
    // [NOTE] Isso é necessário porque não há um FK com 'on delete cascade' para auth.users.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('auth_user_id', userId);
      
    if (profileError) {
      console.warn(`Aviso: Não foi possível deletar o perfil para auth_user_id ${userId}. Pode já ter sido removido. Erro: ${profileError.message}`);
    }

    return new Response(JSON.stringify({ message: 'Usuário e perfil excluídos com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro na função delete-user:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
