/**
 * Remove diacritical marks (acentos) e converte para lowercase.
 * Permite comparações accent-insensitive no frontend.
 *
 * Exemplos:
 *   normalizeText("LICITAÇÃO") → "licitacao"
 *   normalizeText("licitacão") → "licitacao"
 *   normalizeText("licitacao") → "licitacao"
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
