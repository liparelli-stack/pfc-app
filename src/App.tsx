/*
-- ===================================================
-- Código             : /src/App.tsx
-- Versão (.v21)      : 2.26.0
-- Data/Hora          : 2026-03-20 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude Sonnet 4.6)
-- Objetivo do codigo : Migração DS v0101 — wrapper principal e main
-- Fluxo              : App -> QueryClientProvider -> ToastProvider -> AuthProvider -> AppContent
-- Alterações (2.26.0):
--   • [DS] Wrapper principal: bg-plate dark:bg-dark-s1 → bg-dark-bg
--   • [DS] <main>: bg implícito herdado do wrapper (sem mudança)
--   • [KEEP] Toda lógica preservada: tema, SuperMa, DebugOverlay,
--            hotkeys, providers, fluxo de autenticação, renderContent
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

type Theme = "light" | "sepia"; // dark descontinuado temporariamente (v0101)

// Uma instância global de QueryClient
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

  // Tema base (light/dark/sepia) — lógica preservada
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored === "light") return "light";
      if (stored === "sepia") return "sepia";
      if (stored === "dark") return "sepia"; // dark → sepia fallback
      return "light";
    }
    return "light";
  });

  // Hook central do Super MA — intocado
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
  const [isDebugOverlayOpen, setIsDebugOverlayOpen] = useState(false);

  // -------------------------------------------------
  // Tema base + Super MA + reset em logoff — intocado
  // -------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    root.classList.remove("dark");
    root.removeAttribute("data-theme");

    if (!session) return;

    if (superMaState.isActive) {
      root.setAttribute("data-theme", "super-ma");
    } else {
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "sepia") {
        root.setAttribute("data-theme", "sepia");
      }
    }

    localStorage.setItem("theme", theme);
  }, [theme, superMaState.isActive, session]);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "sepia" : "light"));
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

  // Hotkey DebugOverlay (Ctrl+Shift+0) — intocado
  const handleDebugHotkey = useCallback((event: KeyboardEvent) => {
    if (!event.ctrlKey || !event.shiftKey) return;
    if (event.key !== "0") return;
    event.preventDefault();
    setIsDebugOverlayOpen((prev) => !prev);
  }, []);

  // Refs estáveis para hotkeys — intocado
  const superMaHotkeyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const debugHotkeyRef   = useRef<(event: KeyboardEvent) => void>(() => {});

  useEffect(() => { superMaHotkeyRef.current = handleSuperMaHotkey; }, [handleSuperMaHotkey]);
  useEffect(() => { debugHotkeyRef.current   = handleDebugHotkey;   }, [handleDebugHotkey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      superMaHotkeyRef.current(event);
      debugHotkeyRef.current(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fluxo de autenticação — intocado
  if (isPasswordRecovery) return <ResetPasswordPage />;
  if (!session)           return <AuthPage />;

  return (
    <>
      {/*
        Wrapper principal — DS v0101
        dark: bg-dark-bg (#0c0d10) — layer 0 do depth system
        light: bg-plate — mantido até migração completa do light mode
      */}
      <div className="flex h-screen bg-plate dark:bg-dark-bg font-sans overflow-hidden">
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

        {/* Overlay mobile — intocado */}
        {!isDesktop && isMobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-10"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            onMenuClick={() => setIsMobileSidebarOpen(true)}
            title={activeView}
            theme={theme}
          />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8">
            {renderContent()}
          </main>
        </div>
      </div>

      <SuperMaModal />

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
