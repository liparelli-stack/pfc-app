/*
-- ===================================================
-- Código             : /src/App.tsx
-- Versão (.v20)      : 2.25.2
-- Data/Hora          : 2025-12-10 08:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo :
--   • Manter QueryClientProvider para React Query.
--   • Manter fluxo de autenticação / recuperação de senha.
--   • Integrar o Super MA de forma isolada:
--       - Hotkey Ctrl+Shift+|
--       - Modal de escolha de usuário
--       - Tema visual "super-ma" aplicado via data-theme.
--   • Adicionar DebugOverlay interno:
--       - Hotkey Ctrl+Shift+0 para abrir/fechar.
--       - Mostrar profile atual, estado do Super MA e contexto de UI.
--   • [FIX] Garantir que, ao fazer logoff (session = null),
--           qualquer tema (dark/sepia/super-ma) seja removido,
--           voltando ao visual padrão da tela de login.
--
-- Fluxo              : App -> QueryClientProvider -> ToastProvider -> AuthProvider -> AppContent
-- Alterações (2.25.2):
--   • [RENAME] Atualizado case do switch de "Conhecimento" para "Gestão do Conhecimento".
-- Alterações (2.25.1):
--   • useEffect de tema agora depende de `session`.
--   • Quando `session` é null:
--       - Remove classes/atributos de tema do <html>.
--       - Não aplica dark/sepia/super-ma.
-- Dependências       : react-query, ToastContext, AuthContext,
--                      useSuperMaController, DebugOverlay
-- ===================================================
*/

import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import { SettingsPage } from "./pages/SettingsPage";
import CatalogsPage from "./pages/CatalogsPage";
import KnowledgePage from "./pages/KnowledgePage";
import CockpitPage from "./pages/CockpitPage";
import Vision360Page from "./pages/Vision360Page";
import SupportPage from "./pages/SupportPage";
import AgendaXPage from "./pages/AgendaXPage";
import ListsPage from "./pages/ListsPage";
import HubGestaoPage from "./pages/HubGestaoPage";
import OrcamentosPage from "./pages/OrcamentosPage";

import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useMediaQuery } from "./hooks/useMediaQuery";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSuperMaController } from "./superMa/useSuperMaController";
import { DebugOverlay } from "./components/DebugOverlay";

type Theme = "light" | "dark" | "sepia";

// -------------------------------------------
// Criamos UMA instância de QueryClient global
// -------------------------------------------
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
);

const AppContent = () => {
  const { session, isPasswordRecovery } = useAuth();

  // Tema base do app (o que o Sidebar conhece: light/dark/sepia)
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (!stored) return "light";
      if (stored !== "light" && stored !== "dark" && stored !== "sepia") {
        return "light";
      }
      return stored;
    }
    return "light";
  });

  // Hook central do Super MA (estado + hotkey handler + modal)
  const {
    handleSuperMaHotkey,
    SuperMaModal,
    state: superMaState,
  } = useSuperMaController();

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const isSidebarOpen = isDesktop ? isDesktopSidebarOpen : isMobileSidebarOpen;
  const setIsSidebarOpen = isDesktop ? setIsDesktopSidebarOpen : setIsMobileSidebarOpen;

  const [activeView, setActiveView] = useState("Dashboard");

  // DebugOverlay: estado de visibilidade
  const [isDebugOverlayOpen, setIsDebugOverlayOpen] = useState(false);

  // -------------------------------------------------
  // Tema base + sobreposição visual do Super MA + reset em logoff
  // -------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    // Sempre limpamos o estado anterior
    root.classList.remove("dark");
    root.removeAttribute("data-theme");

    // Se não há sessão (tela de login / reset), não aplicamos tema algum.
    if (!session) {
      return;
    }

    // Usuário autenticado:
    //  - Se SuperMA ativo, sobrepõe com tema "super-ma".
    //  - Caso contrário, aplica tema base (light/dark/sepia).
    if (superMaState.isActive) {
      root.setAttribute("data-theme", "super-ma");
    } else {
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "sepia") {
        root.setAttribute("data-theme", "sepia");
      }
    }

    // Persistimos apenas o tema base
    localStorage.setItem("theme", theme);
  }, [theme, superMaState.isActive, session]);

  const toggleTheme = () => {
    setTheme((current) => {
      if (current === "light") return "dark";
      if (current === "dark") return "sepia";
      return "light";
    });
  };

  const renderContent = () => {
    switch (activeView) {
      case "Configurações":
        return <SettingsPage />;
      case "Catálogos":
        return <CatalogsPage />;
      case "Listas":
        return <ListsPage />;
      case "Negócios":
        return <OrcamentosPage />;
      case "Hub de Gestão":
        return <HubGestaoPage />;
      case "Conhecimento":
        return <KnowledgePage />;
      case "Cockpit":
        return <CockpitPage />;
      case "Agenda":
        return <AgendaXPage />;
      case "Visão 360":
        return <Vision360Page />;
      case "Suporte":
        return <SupportPage />;
      case "Dashboard":
      default:
        return <Dashboard />;
    }
  };

  // -------------------------------------------
  // Hotkey do DebugOverlay (Ctrl+Shift+0)
  // -------------------------------------------
  const handleDebugHotkey = useCallback((event: KeyboardEvent) => {
    if (!event.ctrlKey || !event.shiftKey) return;
    if (event.key !== "0") return;

    event.preventDefault();
    setIsDebugOverlayOpen((prev) => !prev);
  }, []);

  // -------------------------------------------
  // Listeners globais de hotkey
  // - Super MA: handleSuperMaHotkey
  // - DebugOverlay: handleDebugHotkey
  // Ambos são estáveis via refs.
  // -------------------------------------------
  const superMaHotkeyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const debugHotkeyRef = useRef<(event: KeyboardEvent) => void>(() => {});

  useEffect(() => {
    superMaHotkeyRef.current = handleSuperMaHotkey;
  }, [handleSuperMaHotkey]);

  useEffect(() => {
    debugHotkeyRef.current = handleDebugHotkey;
  }, [handleDebugHotkey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      superMaHotkeyRef.current(event);
      debugHotkeyRef.current(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // -------------------------------------------
  // Fluxo de autenticação / recuperação de senha
  // -------------------------------------------
  if (isPasswordRecovery) {
    return <ResetPasswordPage />;
  }

  if (!session) {
    return <AuthPage />;
  }

  // Sessão ativa → app normal + DebugOverlay + SuperMaModal
  return (
    <>
      <div className="flex h-screen bg-plate dark:bg-plate-dark font-sans overflow-hidden">
        <Sidebar
          theme={theme}
          toggleTheme={toggleTheme}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          isDesktop={isDesktop}
          activeItem={activeView}
          setActiveItem={(view) => {
            setActiveView(view);
            if (!isDesktop) setIsMobileSidebarOpen(false);
          }}
        />

        {!isDesktop && isMobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-10"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setIsMobileSidebarOpen(true)} title={activeView} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8">
            {renderContent()}
          </main>
        </div>
      </div>

      {/* Modal do Super MA controlado pelo controller */}
      <SuperMaModal />

      {/* DebugOverlay interno (sem DevTools) */}
      <DebugOverlay
        isOpen={isDebugOverlayOpen}
        onClose={() => setIsDebugOverlayOpen(false)}
        activeView={activeView}
        theme={theme}
        superMaState={superMaState as any}
      />
    </>
  );
};

export default App;
