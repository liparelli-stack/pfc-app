/*
-- ===================================================
-- Código             : /src/components/superMa/SuperMaUserPickerModal.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-09 21:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Modal de seleção de usuário para o modo Super MA,
--                      permitindo escolher qual profile será simulado
--                      quando acionado via Shift+Ctrl+|.
-- Fluxo              :
--   AppContent (Shift+Ctrl+|) ->
--     abre SuperMaUserPickerModal ->
--       seleciona usuário ->
--       onConfirm(profileId) ->
--         toggleMaImpersonation({ action: 'enter', simulatedProfileId })
-- Alterações (1.0.0) :
--   • Criação do modal com carregamento direto de profiles ativos via Supabase.
-- Dependências       :
--   • supabase client em src/lib/supabaseClient
-- ===================================================
*/

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface SuperMaUserPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (profileId: string) => void;
}

interface ProfileOption {
  id: string;
  full_name: string;
  email: string;
  role?: string | null;
  is_master_admin?: boolean | null;
}

export const SuperMaUserPickerModal: React.FC<SuperMaUserPickerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadProfiles = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, is_master_admin, status')
          .eq('status', 'active')
          .order('full_name', { ascending: true });

        if (error) {
          console.error('Erro ao carregar perfis para Super MA:', error);
          setErrorMessage('Não foi possível carregar a lista de usuários.');
          setProfiles([]);
          return;
        }

        // Opcional: filtrar para não listar outros MAs
        const filtered =
          data?.filter((p) => !p.is_master_admin) ??
          [];

        setProfiles(filtered);
      } catch (err) {
        console.error('Erro inesperado ao carregar perfis para Super MA:', err);
        setErrorMessage('Ocorreu um erro ao carregar a lista de usuários.');
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, [isOpen]);

  const handleConfirmClick = () => {
    if (!selectedProfileId) return;
    onConfirm(selectedProfileId);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Selecionar usuário para Super MA
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-sm"
          >
            Fechar
          </button>
        </div>

        <div className="px-4 py-3 max-h-80 overflow-y-auto">
          {loading && (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Carregando usuários...
            </p>
          )}

          {!loading && errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          )}

          {!loading && !errorMessage && profiles.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Nenhum usuário disponível para simulação.
            </p>
          )}

          {!loading && !errorMessage && profiles.length > 0 && (
            <ul className="space-y-1 mt-1">
              {profiles.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm 
                      ${
                        selectedProfileId === profile.id
                          ? 'border-red-500 bg-red-50 text-red-900'
                          : 'border-slate-200 hover:border-red-300 hover:bg-red-50/60 text-slate-800 dark:text-slate-100 dark:border-slate-700'
                      }`}
                    onClick={() => setSelectedProfileId(profile.id)}
                  >
                    <div className="font-medium">
                      {profile.full_name || '(Sem nome)'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {profile.email}
                      {profile.role ? ` • ${profile.role}` : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedProfileId}
            onClick={handleConfirmClick}
            className={`px-3 py-1.5 text-sm rounded-md font-medium
              ${
                selectedProfileId
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-300 text-white cursor-not-allowed'
              }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
