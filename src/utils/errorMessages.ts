/*
-- ===================================================
-- Código             : /src/utils/errorMessages.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-07 10:45
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Converter erros brutos (Supabase, JS, network)
--                      em mensagens amigáveis e contextualizadas.
-- Fluxo              : Utilizado por KnowledgeStoragePanel, MarkdownEditor
--                      e demais recursos de Conhecimento.
-- Alterações (1.0.0) :
--   • Tradução de erros de RLS em mensagens claras sobre permissões de KB.
--   • Tratamento de erros de tamanho de arquivo, MIME, inexistência e rede.
--   • Compatível com qualquer serviço Supabase do módulo Conhecimento.
-- Dependências       : nenhuma
-- ===================================================
*/

export type ErrorContext =
  | 'kb-storage-upload'
  | 'kb-storage-delete'
  | 'kb-storage-list'
  | 'kb-storage-download'
  | 'kb-editor'
  | 'generic';

export function getFriendlyErrorMessage(
  error: unknown,
  context: ErrorContext = 'generic'
): string {
  if (!error) {
    return 'Ocorreu um erro inesperado.';
  }

  // Extrai mensagem crua
  const message =
    (typeof error === 'string'
      ? error
      : (error as any)?.message ||
        (error as any)?.msg ||
        (error as any)?.error_description ||
        '') || '';

  const normalized = message.toLowerCase();

  // ===================================================
  // 1. Erros de RLS (Row Level Security)
  //    Supabase devolve sempre "new row violates row-level security policy"
  //    quando usuário não tem permissão para INSERT/UPDATE/DELETE
  // ===================================================
  if (normalized.includes('row-level security')) {
    switch (context) {
      case 'kb-storage-upload':
      case 'kb-storage-delete':
      case 'kb-storage-download':
      case 'kb-storage-list':
      case 'kb-editor':
        return (
          'Você não tem permissão para editar a Base de Conhecimento deste tenant. ' +
          'Verifique se seu perfil possúi a permissão “Editar KB”.'
        );

      default:
        return (
          'Você não tem permissão para realizar esta ação. Entre em contato com o administrador.'
        );
    }
  }

  // ===================================================
  // 2. Arquivo muito grande ou limite do Supabase Storage
  // ===================================================
  if (
    normalized.includes('payload too large') ||
    normalized.includes('file size exceeds') ||
    normalized.includes('413')
  ) {
    return (
      'O arquivo excede o tamanho máximo permitido pelo sistema. ' +
      'Tente compactar ou reduzir a resolução antes de enviar.'
    );
  }

  // ===================================================
  // 3. Tipos de arquivo não permitidos (da nossa própria validação)
  // ===================================================
  if (normalized.includes('tipo de arquivo não permitido')) {
    return message; // já formatado pelo serviço
  }

  // ===================================================
  // 4. Arquivo inexistente no bucket
  // ===================================================
  if (
    normalized.includes('object not found') ||
    normalized.includes('no such file') ||
    normalized.includes('not found')
  ) {
    return (
      'Arquivo não encontrado no armazenamento. Ele pode ter sido removido, renomeado ou estar inacessível.'
    );
  }

  // ===================================================
  // 5. Falhas de conexão, rede ou CORS
  // ===================================================
  if (
    normalized.includes('network') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('cors')
  ) {
    return 'Falha de comunicação com o servidor. Verifique sua conexão e tente novamente.';
  }

  // ===================================================
  // 6. Fallback: se a mensagem for clara, usa; se não, texto padrão
  // ===================================================
  if (message && message.length < 180) {
    return message;
  }

  return 'Não foi possível concluir a operação. Tente novamente e, se o erro persistir, contate o suporte.';
}
