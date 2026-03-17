/*
-- ===================================================
-- Código             : /src/components/DebugOverlay.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-10 05:05 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do código :
--   • Fornecer um painel interno de debug (overlay) sem uso de DevTools.
--   • Exibir:
--       - Dados do profile atual (role, is_master_admin, tenant_id etc.).
--       - Estado do Super MA (isActive, currentMode, isModalOpen,
--         debugPermission.hasPermission, debugPermission.isCheckingPermission).
--       - Contexto de UI (view ativa, tema base, tema super-ma ativo).
--   • Ser acionado via hotkey global (Ctrl+Shift+0) e fechado via botão "X".
--
-- Fluxo              :
--   AppContent -> DebugOverlay (isOpen, onClose, props de estado)
--      ↳ DebugOverlay chama getCurrentProfile() quando aberto.
--
-- Alterações (1.0.0) :
--   • Criação inicial do componente.
-- Dependências       : @/services/profilesService, @/types/profile
-- ===================================================
*/

import { useEffect, useState } from "react";
import type { Profile } from "@/types/profile";
import { getCurrentProfile } from "@/services/profilesService";

type DebugOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  activeView: string;
  theme: string;
  superMaState: {
    isActive: boolean;
    currentMode: string;
    isModalOpen: boolean;
    previousTheme: string | null;
    debugPermission?: {
      hasPermission: boolean | null;
      isCheckingPermission: boolean;
    };
  };
};

export function DebugOverlay(props: DebugOverlayProps) {
  const { isOpen, onClose, activeView, theme, superMaState } = props;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        setProfileError(null);

        const current = await getCurrentProfile();
        if (!isCancelled) {
          setProfile(current);
        }
      } catch (e: any) {
        if (!isCancelled) {
          setProfileError(String(e?.message ?? e ?? "Erro ao carregar profile."));
        }
      } finally {
        if (!isCancelled) {
          setLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const permission = superMaState.debugPermission ?? {
    hasPermission: null,
    isCheckingPermission: false,
  };

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* "Backdrop" clicável apenas atrás do painel */}
      <div className="absolute inset-0 pointer-events-none" />

      <div className="absolute bottom-4 right-4 max-w-xl w-[90vw] pointer-events-auto">
        <div className="rounded-2xl bg-slate-900/95 text-slate-50 shadow-2xl border border-slate-700 p-4 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                DebugOverlay
              </div>
              <div className="font-semibold text-slate-100">
                Ambiente AD • SuperMA
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-600 px-2 py-1 text-[11px] font-semibold hover:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              fechar
            </button>
          </div>

          {/* Info de hotkey */}
          <div className="mb-3 text-[10px] text-slate-400 flex items-center justify-between">
            <span>
              Hotkey: <span className="font-mono">Ctrl+Shift+0</span> para abrir/fechar
            </span>
            <span className="font-mono">
              view: {activeView || "—"} • theme: {theme}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Bloco Profile */}
            <section className="border border-slate-700/80 rounded-xl p-3 bg-slate-950/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[11px] text-slate-100">
                  Profile Atual (JWT → profiles)
                </span>
                <span className="text-[10px] text-slate-400">
                  {loadingProfile
                    ? "carregando..."
                    : profileError
                    ? "erro"
                    : profile
                    ? "ok"
                    : "nenhum"}
                </span>
              </div>

              {profileError && (
                <div className="text-[10px] text-red-400 mb-2">
                  {profileError}
                </div>
              )}

              <pre className="text-[10px] bg-slate-950/70 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                {profile
                  ? JSON.stringify(
                      {
                        id: profile.id,
                        email: profile.email,
                        tenant_id: profile.tenant_id,
                        role: profile.role,
                        is_master_admin: (profile as any).is_master_admin,
                        status: profile.status,
                        full_name: profile.full_name,
                      },
                      null,
                      2
                    )
                  : "// sem profile ativo (getCurrentProfile retornou null)"}
              </pre>
            </section>

            {/* Bloco SuperMA */}
            <section className="border border-fuchsia-700/80 rounded-xl p-3 bg-slate-950/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[11px] text-fuchsia-100">
                  SuperMA State
                </span>
                <span className="text-[10px] text-fuchsia-300 font-mono">
                  {superMaState.isActive ? "ATIVO" : "INATIVO"} •{" "}
                  {superMaState.currentMode || "IDLE"}
                </span>
              </div>

              <pre className="text-[10px] bg-slate-950/70 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                {JSON.stringify(
                  {
                    isActive: superMaState.isActive,
                    currentMode: superMaState.currentMode,
                    isModalOpen: superMaState.isModalOpen,
                    previousTheme: superMaState.previousTheme,
                    permission: {
                      hasPermission: permission.hasPermission,
                      isCheckingPermission: permission.isCheckingPermission,
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </section>

            {/* Bloco UI Context */}
            <section className="border border-sky-700/80 rounded-xl p-3 bg-slate-950/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[11px] text-sky-100">
                  UI Context
                </span>
                <span className="text-[10px] text-sky-300 font-mono">
                  super-ma: {superMaState.isActive ? "on" : "off"}
                </span>
              </div>

              <pre className="text-[10px] bg-slate-950/70 rounded-lg p-2 overflow-auto max-h-32 whitespace-pre-wrap break-words">
                {JSON.stringify(
                  {
                    activeView,
                    themeBase: theme,
                    themeOverlaySuperMa: superMaState.isActive,
                  },
                  null,
                  2
                )}
              </pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
