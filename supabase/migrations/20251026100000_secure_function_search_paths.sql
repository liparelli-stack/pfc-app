/*
================================================================================
Código: /supabase/migrations/20251026100000_secure_function_search_paths.sql
Versão: 1.0.0
Data/Hora: 2025-10-26 10:00
Autor: Dualite Alpha (AD)
Objetivo: Corrigir os avisos de segurança [WARN] Function Search Path Mutable,
          definindo um search_path explícito e seguro para as funções do projeto.
Fluxo: Altera as configurações das funções existentes no banco de dados.
Dependências: Nenhuma.
================================================================================
*/

/*
# [Operação de Segurança] Definir Search Path para Funções
[Descrição da operação]
Esta operação define um `search_path` explícito para várias funções do banco de dados.
Isso previne potenciais ataques de sequestro de caminho de busca (path hijacking),
onde um usuário mal-intencionado poderia criar objetos em um schema temporário
para enganar a função e executar código não autorizado.

## Query Description:
- Impacto nos dados: Nenhum. Esta é uma alteração de metadados e segurança.
- Riscos: Baixo. A operação é segura e segue as melhores práticas recomendadas.
- Precauções: Nenhuma, além da aplicação padrão da migração.

## Metadata:
- Schema-Category: "Security"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true (removendo a configuração do search_path)

## Estrutura Afetada:
- Função: app_set_updated_at()
- Função: contacts_channel_normalize()
- Função: fn_audit_contacts_channels()
- Função: handle_new_tenant_channels()
- Função: populate_default_channels()
- Função: reset_default_channels()

## Security Implications:
- RLS Status: Não aplicável
- Policy Changes: Não
- Auth Requirements: Privilégios de administrador (aplicados via migração)

## Performance Impact:
- Indexes: Nenhum
- Triggers: Nenhum
- Estimated Impact: Nenhum impacto de performance esperado.
*/

-- [--BLOCO--] Corrige o search_path para a função de gatilho app_set_updated_at
ALTER FUNCTION public.app_set_updated_at() SET search_path = public;

-- [--BLOCO--] Corrige o search_path para a função de gatilho contacts_channel_normalize
ALTER FUNCTION public.contacts_channel_normalize() SET search_path = public;

-- [--BLOCO--] Corrige o search_path para a função de gatilho fn_audit_contacts_channels
ALTER FUNCTION public.fn_audit_contacts_channels() SET search_path = public;

-- [--BLOCO--] Corrige o search_path para a função de gatilho handle_new_tenant_channels
ALTER FUNCTION public.handle_new_tenant_channels() SET search_path = public;

-- [--BLOCO--] Corrige o search_path para a função de gatilho populate_default_channels
ALTER FUNCTION public.populate_default_channels() SET search_path = public;

-- [--BLOCO--] Corrige o search_path para a função reset_default_channels
ALTER FUNCTION public.reset_default_channels() SET search_path = public;
