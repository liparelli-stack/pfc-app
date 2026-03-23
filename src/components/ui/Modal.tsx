/*
-- ===================================================
-- Código                 : /src/components/ui/Modal.tsx
-- Versão (.v20)          : 2.3.0
-- Data/Hora              : 2025-11-10 09:12 America/Sao_Paulo
-- Autor                  : FL / Execução via você EVA
-- Objetivo do código     : Modal com Portal em document.body, z-index elevado, scroll-lock, foco restaurado
--                          e integração com ToastContext (escopo MODAL).
-- Fluxo                  : Parent controla <Modal isOpen ...>; fechado = pointer-events:none + inert.
--                          Quando isOpen=true, ativa escopo de toast do modal e disponibiliza
--                          o target #modal-toast-portal acima do conteúdo.
-- Alterações (2.3.0)     :
--   • [ADD] Integração com ToastContext: setModalScope(isOpen) + cleanup ao desmontar.
--   • [ADD] Contêiner <div id="modal-toast-portal" /> com z-index acima do conteúdo (z-[1420]).
--   • [KEEP] Scroll-lock, foco e animação inalterados.
-- Dependências           : react, react-dom, framer-motion, @/contexts/ToastContext
-- ===================================================
*/

import React, { ReactNode, MouseEvent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';

type ModalSize = 'lg' | 'xl' | '2xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;         // default: 'xl'
  closeOnEsc?: boolean;     // default: true
}

const sizeToClass: Record<ModalSize, string> = {
  lg:  'max-w-[720px]',
  xl:  'max-w-[960px]',
  '2xl':'max-w-[1200px]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'xl',
  closeOnEsc = true,
}) => {
  const { setModalScope } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedEl = useRef<HTMLElement | null>(null);

  // ESC para fechar
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeOnEsc, onClose]);

  // Foco ao abrir e restaura ao fechar
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedEl.current = (document.activeElement as HTMLElement) ?? null;
      const t = setTimeout(() => contentRef.current?.focus(), 0);
      return () => clearTimeout(t);
    } else {
      previouslyFocusedEl.current?.focus?.();
    }
  }, [isOpen]);

  // Scroll-lock do body ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => { body.style.overflow = prevOverflow; };
  }, [isOpen]);

  // 🔗 Integração com ToastContext: ativa escopo do modal enquanto aberto
  useEffect(() => {
    setModalScope(isOpen);
    return () => setModalScope(false);
  }, [isOpen, setModalScope]);

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const portalNode = (
    <div
      className={[
        'fixed inset-0 flex items-center justify-center transition-opacity duration-200',
        // z-index global alto para sobrepor Cockpit / Aside / etc.
        'z-[1400]',
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      ].join(' ')}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal={isOpen ? 'true' : undefined}
      aria-hidden={!isOpen}
      {...(!isOpen ? { inert: '' as any } : {})}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Conteúdo do modal */}
      <motion.div
        ref={contentRef}
        tabIndex={-1}
        initial={false}
        animate={{ y: isOpen ? 0 : -20, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        onClick={(e) => e.stopPropagation()}
        className={[
          'relative z-[1410]',
          'w-full', sizeToClass[size],
          'bg-plate dark:bg-dark-s1 rounded-2xl neumorphic-convex',
          'p-6 md:p-8',
          'max-h-[85vh] overflow-y-auto',
          'pointer-events-auto focus:outline-none shadow-xl',
        ].join(' ')}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Fechar modal"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Área de conteúdo do modal */}
        {children}
      </motion.div>

      {/* 🔔 Target para toasts do MODAL (acima do conteúdo) */}
      <div id="modal-toast-portal" className="fixed top-0 left-0 w-full h-0 z-[1420]" />
    </div>
  );

  return createPortal(portalNode, document.body);
};

export default Modal;
