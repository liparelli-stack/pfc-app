/*
-- ===================================================
-- Código: /src/contexts/ToastContext.tsx
-- Versão: 2.0.0
-- Data/Hora: 2025-10-10 09:44 -03
-- Autor: FL / Eva (E.V.A.)
-- Objetivo:
--   - Prover toasts com escopo e portal:
--       • GLOBAL (padrão, no body, acima do app)
--       • MODAL (renderiza dentro do modal aberto, sem afetar a tela por baixo)
--   - Redirecionar automaticamente para o escopo MODAL quando um modal estiver ativo.
-- Fluxo:
--   - Envolvido em App.tsx.
--   - Modal chama setModalScope(true) ao abrir e setModalScope(false) ao fechar.
-- Dependências: react, react-dom, framer-motion, lucide-react
-- Notas:
--   - Quando escopo=MODAL e o container #modal-toast-portal não existir, faz fallback para GLOBAL.
--   - z-index GLOBAL: 1000 | z-index MODAL: 1100 (acima do conteúdo do modal).
-- ===================================================
*/
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning';
type ToastScope = 'global' | 'modal';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  scope: ToastScope;
  durationMs?: number;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType, opts?: { scope?: ToastScope; durationMs?: number }) => void;
  setModalScope: (isOpen: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="text-green-500" />,
  error:   <XCircle className="text-red-500" />,
  warning: <AlertTriangle className="text-yellow-500" />,
};

function useAutoRemoval(removeFn: (id: number, scope: ToastScope) => void) {
  const schedule = useCallback((id: number, scope: ToastScope, durationMs?: number) => {
    const timeout = typeof durationMs === 'number' ? durationMs : 5000;
    window.setTimeout(() => removeFn(id, scope), timeout);
  }, [removeFn]);
  return { schedule };
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [globalToasts, setGlobalToasts] = useState<ToastMessage[]>([]);
  const [modalToasts, setModalToasts] = useState<ToastMessage[]>([]);
  const [modalScopeActive, setModalScopeActive] = useState<boolean>(false);

  const removeToast = useCallback((id: number, scope: ToastScope) => {
    if (scope === 'modal') setModalToasts(prev => prev.filter(t => t.id !== id));
    else setGlobalToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const { schedule } = useAutoRemoval(removeToast);

  const addToast = useCallback(
    (message: string, type: ToastType, opts?: { scope?: ToastScope; durationMs?: number }) => {
      const scope: ToastScope = opts?.scope ?? (modalScopeActive ? 'modal' : 'global');
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const toast: ToastMessage = { id, message, type, scope, durationMs: opts?.durationMs };

      if (scope === 'modal') {
        setModalToasts(prev => [...prev, toast]);
      } else {
        setGlobalToasts(prev => [...prev, toast]);
      }
      schedule(id, scope, opts?.durationMs);
    },
    [modalScopeActive, schedule]
  );

  const setModalScope = useCallback((isOpen: boolean) => {
    setModalScopeActive(isOpen);
  }, []);

  // Containers
  const GlobalContainer = (
    <div className="pointer-events-none fixed top-5 right-5 z-[1000]">
      <AnimatePresence>
        {globalToasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } }}
            className="mb-3"
          >
            <div className="pointer-events-auto flex items-center p-4 rounded-lg neumorphic-convex dark:neumorphic-convex-dark bg-plate dark:bg-dark-s1 shadow-lg">
              <div className="mr-3">{toastIcons[toast.type]}</div>
              <p className="font-semibold">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id, 'global')}
                className="ml-4 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                aria-label="Fechar notificação"
              >
                &times;
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  // Portal para o MODAL (se existir o target, renderiza nele; caso contrário, cai no global)
  const modalTarget = typeof document !== 'undefined'
    ? document.getElementById('modal-toast-portal')
    : null;

  const ModalContainer = modalTarget ? createPortal(
    <div className="pointer-events-none fixed top-4 right-4 z-[1100]">
      <AnimatePresence>
        {modalToasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.2 } }}
            className="mb-2"
          >
            <div className="pointer-events-auto flex items-center p-3 rounded-lg neumorphic-convex dark:neumorphic-convex-dark bg-plate dark:bg-dark-s1 shadow-md">
              <div className="mr-2">{toastIcons[toast.type]}</div>
              <p className="font-semibold text-sm">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id, 'modal')}
                className="ml-3 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                aria-label="Fechar notificação do modal"
              >
                &times;
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    modalTarget
  ) : null;

  return (
    <ToastContext.Provider value={{ addToast, setModalScope }}>
      {children}
      {createPortal(GlobalContainer, document.body)}
      {ModalContainer}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
