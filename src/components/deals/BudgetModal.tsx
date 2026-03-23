/*
-- ===================================================
-- Código             : /src/components/deals/BudgetModal.tsx
-- Versão (.v17)      : 1.0.0
-- Data/Hora          : 2025-10-29 23:59 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Modal de Orçamento (encapsula Deal) para criar oportunidade.
-- Fluxo              : Aberto a partir de RegisterActionCard/EditActionForm. Cria Deal.
-- Alterações (1.0.0) :
--  • Campos: nome (livre), valor (BRL), status (ganha|perdida|em_espera), nota (local).
--  • Salva Deal com defaults: status = 'ganha' (se não escolher), pipeline_stage = 'Fechamento' (oculto), currency = 'BRL'.
--  • Lista "Orçamentos do cliente" (deals não arquivados) via dealsService.listDealsByCompany().
-- Dependências        : react, @/components/ui/Modal, @/components/ui/Button, @/services/dealsService
-- ===================================================
*/
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import * as dealsService from '@/services/dealsService';
import type { DealWithRelations } from '@/types/deal';
import { useToast } from '@/contexts/ToastContext';

export interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  contactId?: string | null;
  presetName?: string | null;   // opcional: sugestão de título
}

const STATUS_OPTIONS: Array<{ value: 'ganha' | 'perdida' | 'em_espera'; label: string }> = [
  { value: 'ganha', label: 'Ganha' },
  { value: 'perdida', label: 'Perdida' },
  { value: 'em_espera', label: 'Em Espera' },
];

function parseBRLToNumber(v: string): number | null {
  const s = (v || '').replace(/\s/g, '').replace(/[R$r$]/gi, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, companyId, contactId, presetName }) => {
  const { addToast } = useToast();
  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [status, setStatus] = useState<'ganha' | 'perdida' | 'em_espera'>('ganha'); // default pedido
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<DealWithRelations[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setName(presetName || '');
    setAmount('');
    setStatus('ganha');
    setNote('');
    // carregar deals do cliente
    dealsService
      .listDealsByCompany(companyId)
      .then(setList)
      .catch(() => setList([]));
  }, [isOpen, companyId, presetName]);

  const canCreate = useMemo(() => name.trim().length >= 3, [name]);

  const handleCreate = async () => {
    if (!canCreate) {
      addToast('Informe um título (mín. 3 caracteres).', 'warning');
      return;
    }
    const parsed = parseBRLToNumber(amount || '');
    if (amount && parsed == null) {
      addToast('Valor inválido. Use números e vírgula (ex.: 1.490,00).', 'warning');
      return;
    }

    try {
      setLoading(true);
      const deal = await dealsService.createDeal({
        name: name.trim(),
        company_id: companyId,
        primary_contact_id: contactId ?? null,
        amount: parsed ?? null,
        currency: 'BRL',
        status,                      // limitado ao set pedido
        pipeline_stage: 'Fechamento' // fixo/oculto conforme requisito
      } as any);

      addToast('Orçamento criado como oportunidade.', 'success');
      // notificar interessados (board, etc.)
      window.dispatchEvent(new CustomEvent('deals:new', { detail: { dealId: (deal as any).id } }));
      onClose();
    } catch (e: any) {
      addToast(e?.message || 'Falha ao criar orçamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Orçamento:">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coluna esquerda: formulário */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Orçamento: (texto livre)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Orc #1021.3 ou título"
              className="w-full rounded-lg p-3 bg-transparent border border-dark-shadow dark:border-dark-dark-shadow focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor (BRL)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex.: 1.490,00"
              className="w-full rounded-lg p-3 bg-transparent border border-dark-shadow dark:border-dark-dark-shadow focus:outline-none focus:ring-2 focus:ring-primary/50"
              inputMode="decimal"
            />
            <p className="text-xs text-gray-500 mt-1">Somente números e vírgula (centavos). Ex.: 1490,00</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-lg p-3 bg-transparent border border-dark-shadow dark:border-dark-dark-shadow focus:outline-none"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nota</label>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observações internas (não persiste em deals)"
              className="w-full rounded-lg p-3 bg-transparent border border-dark-shadow dark:border-dark-dark-shadow focus:outline-none"
            />
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="button" variant="primary" isLoading={loading} onClick={handleCreate} disabled={!canCreate}>
              Criar
            </Button>
          </div>

          <p className="text-xs text-gray-400 mt-2">Dono do cliente: —</p>
        </div>

        {/* Coluna direita: lista */}
        <div>
          <h4 className="font-semibold mb-2">Orçamentos do cliente</h4>
          {list.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum orçamento encontrado para este cliente.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-auto pr-1">
              {list.map(d => (
                <li key={d.id} className="p-2 rounded-lg neumorphic-convex bg-plate dark:bg-dark-s1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{d.name}</span>
                    <span className="text-xs text-gray-500">{(d.amount ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <p className="text-xs text-gray-500">Status: {d.status}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default BudgetModal;
