/*
-- ===================================================
-- Código: /src/components/deals/DealCard.tsx
-- Versão: 2.1.0
-- Data/Hora: 2025-10-16 14:26 -03
-- Autor: E.V.A.
-- Objetivo: Substituir prompt por Modal para marcar oportunidade como "Perdida".
-- Mudanças:
--  1) Modal com textarea para motivo da perda (obrigatório).
--  2) Botões Cancelar/Confirmar usando <Button/>.
--  3) Mantém refinamentos anteriores (clamps, badges, PT-BR).
-- ===================================================
*/
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DealWithRelations } from '@/types/deal';
import { Avatar } from '@/components/ui/Avatar';
import { MoreVertical, Edit, Archive, XCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import * as dealsService from '@/services/dealsService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DealCardProps {
  deal: DealWithRelations;
  onEdit: (deal: DealWithRelations) => void;
  refreshDeals: () => void;
}

const STATUS_LABEL_PT: Record<DealWithRelations['status'], string> = {
  aberta: 'Aberta',
  ganha: 'Ganha',
  perdida: 'Perdida',
  em_espera: 'Em Espera',
};

const DealCard: React.FC<DealCardProps> = ({ deal, onEdit, refreshDeals }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [submittingLost, setSubmittingLost] = useState(false);
  const { addToast } = useToast();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('dealId', deal.id!);
  };

  const handleAction = async (action: () => Promise<any>, successMessage: string) => {
    try {
      await action();
      addToast(successMessage, 'success');
      refreshDeals();
    } catch (error: any) {
      addToast(error.message || 'Falha ao executar ação.', 'error');
    } finally {
      setIsMenuOpen(false);
    }
  };

  const handleArchive = () =>
    handleAction(() => dealsService.archiveDeal(deal.id!, !deal.is_archived), `Oportunidade ${deal.is_archived ? 'desarquivada' : 'arquivada'}.`);

  const handleMarkWon = () => {
    const amount = deal.amount || parseFloat(window.prompt('Informe o valor final da oportunidade:') || '0');
    if (amount > 0) {
      handleAction(() => dealsService.markDealWon(deal.id!, amount, new Date().toISOString()), 'Oportunidade marcada como ganha!');
    } else {
      addToast('Valor inválido.', 'warning');
    }
  };

  // --- Modal "Perdeu"
  const openLostModal = () => {
    setLostReason('');
    setLostOpen(true);
    setIsMenuOpen(false);
  };

  const confirmLost = async () => {
    if (!lostReason.trim()) {
      addToast('Informe o motivo da perda.', 'warning');
      return;
    }
    try {
      setSubmittingLost(true);
      await dealsService.markDealLost(deal.id!, lostReason.trim());
      addToast('Oportunidade marcada como perdida.', 'success');
      setLostOpen(false);
      refreshDeals();
    } catch (e: any) {
      addToast(e?.message || 'Falha ao marcar como perdida.', 'error');
    } finally {
      setSubmittingLost(false);
    }
  };

  const statusDot = {
    aberta: 'bg-blue-500',
    ganha: 'bg-green-500',
    perdida: 'bg-red-500',
    em_espera: 'bg-yellow-500',
  } as const;

  // Título: 2 linhas + trunc 40 chars
  const fullTitle = (deal.name || '').trim();
  const displayTitle = fullTitle.length > 40 ? `${fullTitle.slice(0, 40)}…` : fullTitle;

  // Empresa: clamp 1 linha
  const companyName = (deal.company?.trade_name || '').trim();

  // Temperatura PT-BR
  const t: any = (deal as any).temperature;
  const tempLabelRaw: string | undefined =
    typeof t === 'string' ? t :
    t?.label ? String(t.label) : undefined; // espera 'frio' | 'morno' | 'quente'

  const tempScore: number | undefined =
    typeof t === 'object' && typeof t?.score === 'number' ? t.score : undefined;

  const tone =
    (tempLabelRaw?.toLowerCase() === 'quente' || (tempScore ?? 0) >= 5) ? 'hot' :
    (tempLabelRaw?.toLowerCase() === 'morno'  || (tempScore ?? 0) >= 3) ? 'warm' :
    (tempLabelRaw?.toLowerCase() === 'frio') ? 'cold' : undefined;

  const tempBadgeClass =
    tone === 'hot'  ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30' :
    tone === 'warm' ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30' :
    tone === 'cold' ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30' :
                      'bg-gray-500/10 text-gray-400 ring-1 ring-gray-500/20';

  const cardRing =
    deal.status === 'ganha'  ? 'ring-1 ring-green-500/30' :
    deal.status === 'perdida' ? 'ring-1 ring-red-500/30' :
                                'ring-0';

  return (
    <>
      {/* Modal Perdeu */}
      <Modal isOpen={lostOpen} onClose={() => setLostOpen(false)} title="Marcar como Perdida">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-dark-t1">
            Informe o <strong>motivo da perda</strong> para esta oportunidade.
          </p>
          <textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={4}
            placeholder="Ex.: Preço, timing, concorrência, sem orçamento..."
            className="w-full rounded-lg p-3 bg-transparent border border-dark-shadow dark:border-dark-dark-shadow focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="default" onClick={() => setLostOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" isLoading={submittingLost} onClick={confirmLost}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        draggable={!deal.is_archived}
        onDragStart={handleDragStart}
        className={`p-4 rounded-2xl neumorphic-convex bg-plate dark:bg-dark-s1 cursor-grab active:cursor-grabbing ${cardRing}`}
      >
        <div className="flex justify-between items-start">
          <h4
            className="font-bold text-gray-800 dark:text-dark-t1 pr-2 flex-1 break-words"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
            title={fullTitle}
          >
            {displayTitle}
          </h4>

          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 rounded-full hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow"
              aria-label="Abrir menu"
            >
              <MoreVertical size={18} />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-plate dark:bg-dark-s1 rounded-lg neumorphic-convex p-2 z-20">
                <button
                  onClick={() => { onEdit(deal); setIsMenuOpen(false); }}
                  disabled={deal.is_archived}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Edit size={16} /> Editar
                </button>
                <button
                  onClick={handleArchive}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow"
                >
                  <Archive size={16} /> {deal.is_archived ? 'Desarquivar' : 'Arquivar'}
                </button>
                <div className="h-px bg-dark-shadow dark:bg-dark-dark-shadow my-1" />
                <button
                  onClick={handleMarkWon}
                  disabled={deal.is_archived}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow disabled:opacity-50"
                >
                  <CheckCircle size={16} className="text-green-500" /> Ganhou
                </button>
                <button
                  onClick={openLostModal}
                  disabled={deal.is_archived}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow disabled:opacity-50"
                >
                  <XCircle size={16} className="text-red-500" /> Perdeu
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <p
            className="text-sm text-gray-500 dark:text-dark-t2 flex-1 min-w-0"
            style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }}
            title={companyName}
          >
            {companyName}
          </p>

          {tempLabelRaw && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${tempBadgeClass}`}
              title={`Temperatura: ${tempLabelRaw}${typeof tempScore === 'number' ? ` (${tempScore})` : ''}`}
            >
              {tempLabelRaw}
            </span>
          )}
        </div>

        <div className="flex justify-between items-end mt-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusDot[deal.status]}`} title={`Status: ${STATUS_LABEL_PT[deal.status]}`} />
            <span className="font-bold text-lg text-gray-800 dark:text-dark-t1">
              {(deal.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <Avatar src={deal.owner?.avatar_url} name={deal.owner?.full_name} className="w-8 h-8" />
        </div>

        <p className="text-xs text-gray-400 dark:text-dark-t2 text-right mt-2">
          Atualizado em: {deal.updated_at ? new Date(deal.updated_at as any).toLocaleDateString('pt-BR') : '—'}
        </p>
      </motion.div>
    </>
  );
};

export default DealCard;
