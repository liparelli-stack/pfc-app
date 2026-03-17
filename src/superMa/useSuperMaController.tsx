/*
-- ===================================================
-- Código             : /src/superMa/useSuperMaController.tsx
-- Versão (.v20)      : 1.3.4
-- Data/Hora          : 2025-12-10 07:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo :
--   Controlar o estado do Super MA:
--     • Hotkey (Ctrl+Shift+|)
--     • Abrir/fechar modal
--     • Acionar Strategy DEV/PROD
--     • Guardar tema original em memória (opcional)
--     • Restringir uso ao MA:
--         - profiles.role = 'admin'
--         - profiles.is_master_admin = true
--
--   Integração fina com AuthContext:
--     • Usa session.user.id (AuthContext) como fonte de verdade
--       para buscar o profile via getCurrentProfile(authUserId).
--     • Não depende mais de supabase.auth.getUser() dentro do
--       fluxo do SuperMA, evitando divergência de timing em
--       sessões persistidas.
--
-- Fluxo:
--   App -> handleSuperMaHotkey(event)
--        -> (checa session) -> getCurrentProfile(session.user.id)
--        -> Service (DEV/PROD) -> state.isActive / currentMode
--
-- Alterações (1.3.4):
--   • ensurePermission agora:
--       - Usa session.user.id vindo de useAuth().
--       - Chama getCurrentProfile(authUserId) com esse id.
--     Isso garante que a hotkey funcione da mesma forma
--     em login normal e em sessão persistida.
-- ===================================================
*/

import { useState, useCallback } from "react";
import { superMaFactory } from "./superMaFactory";
import { SuperMaUIMode } from "./superMaTypes";
import { SuperMaUserPickerModal } from "@/components/superMa/SuperMaUserPickerModal";
import { getCurrentProfile } from "@/services/profilesService";
import { useAuth } from "@/contexts/AuthContext";

type SuperMaProfile = {
  id?: string;
  email?: string;
  full_name?: string;
  role?: string | null;
  is_master_admin?: boolean | null;
};

//---------------------------------------------------------
// Instancia o service correto (DEV SAFE / PROD REAL / OFF)
//---------------------------------------------------------
const service = superMaFactory();

export function useSuperMaController() {
  //---------------------------------------------------------
  // Estados internos da UI / modo
  //---------------------------------------------------------
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentMode, setCurrentMode] = useState<SuperMaUIMode>("IDLE");

  // Guarda o tema do usuário antes de ativar o Super MA (string simples)
  const [previousTheme, setPreviousTheme] = useState<string | null>(null);

  // Sessão atual vinda do AuthContext (JWT já resolvido)
  const { session } = useAuth();

  //---------------------------------------------------------
  // Captura o tema atual uma única vez ao entrar em Super MA
  //---------------------------------------------------------
  const capturePreviousTheme = useCallback(() => {
    if (previousTheme) return; // já capturado

    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("theme") || "light";
        setPreviousTheme(stored);
      } else {
        setPreviousTheme("light");
      }
    } catch {
      setPreviousTheme("light");
    }
  }, [previousTheme]);

  //---------------------------------------------------------
  // Valida se o usuário atual pode usar o Super MA
  // Regra: profiles.role = 'admin' AND is_master_admin = true
  // Usa authUserId do AuthContext (session.user.id).
  //---------------------------------------------------------
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const authUserId = session?.user?.id;

    if (!authUserId) {
      // Sem sessão válida, apenas ignoramos a ação.
      return false;
    }

    try {
      const profile = (await getCurrentProfile(authUserId)) as SuperMaProfile | null;

      if (!profile) {
        window.alert(
          "Não foi possível localizar um profile ativo para o usuário atual.\n\n" +
            "Verifique se existe um registro em 'profiles' com status = 'active' " +
            "associado ao seu usuário."
        );
        return false;
      }

      const role = profile.role ?? null;
      const isMasterAdmin = profile.is_master_admin ?? false;

      const allowed = role === "admin" && isMasterAdmin === true;

      if (!allowed) {
        window.alert(
          "Modo Super MA disponível apenas para usuários Master Admin.\n\n" +
            "Requisitos:\n" +
            ' • profiles.role = "admin"\n' +
            " • profiles.is_master_admin = true\n\n" +
            "Seu profile atual:\n" +
            ` • email ..............: ${profile.email ?? "(desconhecido)"}\n` +
            ` • id .................: ${profile.id ?? "(desconhecido)"}\n` +
            ` • full_name ..........: ${profile.full_name ?? "(desconhecido)"}\n` +
            ` • role ...............: ${String(role)}\n` +
            ` • is_master_admin ....: ${String(isMasterAdmin)}`
        );
      }

      return allowed;
    } catch (error: any) {
      const msg = String(error?.message ?? error ?? "Erro desconhecido.");
      window.alert(
        "Não foi possível validar se você pode usar o modo Super MA.\n\n" +
          "Detalhes internos:\n" +
          ` • ${msg}`
      );
      return false;
    }
  }, [session]);

  //---------------------------------------------------------
  // ENTRAR em AS_USER (DEV SAFE ou PROD REAL, conforme service)
  //---------------------------------------------------------
  const enterSuperMa = useCallback(
    async (profileId: string) => {
      try {
        const { mode } = await service.enter(profileId);

        if (mode === "AS_USER") {
          capturePreviousTheme();
          setIsActive(true);
          setCurrentMode(mode);
        } else if (mode === "IDLE") {
          console.warn(
            "[Super MA] Service retornou modo IDLE ao tentar entrar."
          );
          setCurrentMode("IDLE");
        } else {
          console.warn(
            "[Super MA] Service retornou modo inesperado ao tentar entrar:",
            mode
          );
          setCurrentMode(mode);
        }
      } catch (error) {
        console.error("[Super MA] Erro ao entrar no modo Super MA", error);
        window.alert(
          'Não foi possível ativar o modo Super MA.\n\n' +
            'Verifique se a função "ma-impersonation" está acessível e se o ambiente está configurado corretamente.\n' +
            "Detalhes internos disponíveis para análise."
        );
        setCurrentMode("IDLE");
      } finally {
        setIsModalOpen(false);
      }
    },
    [capturePreviousTheme]
  );

  //---------------------------------------------------------
  // SAIR do modo AS_USER (retornar para MA_GLOBAL / IDLE)
  //---------------------------------------------------------
  const exitSuperMa = useCallback(async () => {
    try {
      const result = await service.exit();
      const mode = (result && result.mode) || "IDLE";

      if (mode !== "AS_USER") {
        setCurrentMode(mode);
      } else {
        console.warn(
          "[Super MA] Service.exit retornou AS_USER; forçando IDLE na UI."
        );
        setCurrentMode("IDLE");
      }
    } catch (error) {
      console.error("[Super MA] Erro ao sair do modo Super MA", error);
      window.alert(
        "Não foi possível retornar ao usuário Master Admin.\n\n" +
          "A sessão pode não ter sido restaurada corretamente no backend.\n" +
          "A interface foi ajustada para sair do modo Super MA."
      );
      setCurrentMode("IDLE");
    } finally {
      setIsActive(false);
    }
  }, []);

  //---------------------------------------------------------
  // Hotkey global do Super MA (Ctrl+Shift+|)
  //---------------------------------------------------------
  const handleHotkey = useCallback(
    async (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      if (event.key !== "|" && event.key !== "\\") return;

      event.preventDefault();

      const allowed = await ensurePermission();
      if (!allowed) return;

      if (!isActive) {
        setIsModalOpen(true);
      } else {
        exitSuperMa();
      }
    },
    [ensurePermission, isActive, exitSuperMa]
  );

  //---------------------------------------------------------
  // Componente Modal
  //---------------------------------------------------------
  const SuperMaModal = () => (
    <SuperMaUserPickerModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onConfirm={(profileId) => enterSuperMa(profileId)}
    />
  );

  //---------------------------------------------------------
  // Retorno final do Hook
  //---------------------------------------------------------
  return {
    state: {
      isActive,
      currentMode,
      previousTheme,
      isModalOpen,
    },
    handleSuperMaHotkey: handleHotkey,
    SuperMaModal,
  };
}
