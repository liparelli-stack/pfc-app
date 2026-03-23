/*
================================================================================
Código: /src/components/catalogs/ContactForm.tsx
Versão: 5.2.0
Data/Hora: 2025-10-22 10:00 -03
Autor: Dualite Alpha (AD)
Objetivo: [CORREÇÃO] Adicionar o campo "Departamento" ao formulário de
          criação e edição de contatos.
================================================================================
*/
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { X } from 'lucide-react';
import type { Contact } from '@/types/contact';
import { CONTACT_GUARD_OPTIONS } from '@/types/contact';
import { updateContact as updateContactSvc, createContact as createContactSvc } from '@/services/contactsService';

type Props = {
  contact: Contact | null;
  companyId?: string;
  tenantId?: string; // Obrigatório para criação
  onSaved?: (c: Contact) => void;
  onCancel?: () => void;
};

const REQUIRED = (s?: string | null) => (s ?? '').trim().length > 0;

export default function ContactForm({ contact, companyId, tenantId, onSaved, onCancel }: Props) {
  const isCreating = !contact;

  const [fullName, setFullName] = useState<string>(contact?.full_name ?? '');
  const [contactGuard, setContactGuard] = useState<string>(contact?.contact_guard ?? '');
  const [position, setPosition] = useState<string>(contact?.position ?? '');
  const [department, setDepartment] = useState<string>(contact?.department ?? ''); // [--NOVO--]
  const [notes, setNotes] = useState<string>(contact?.notes ?? '');
  const [isActive, setIsActive] = useState<boolean>(isCreating ? true : (contact?.status ?? 'active') === 'active');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const isValid = useMemo(() => REQUIRED(fullName), [fullName]);
  const lastLoadedIdRef = useRef<string | null>(contact?.id ?? null);

  const isDirty = useMemo(() => {
    if (isCreating) {
      return fullName.trim() !== '' ||
             (contactGuard && contactGuard !== '') ||
             position.trim() !== '' ||
             department.trim() !== '' || // [--NOVO--]
             notes.trim() !== '';
    }
    if (!contact) return false;
    return (
      fullName !== (contact.full_name ?? '') ||
      contactGuard !== (contact.contact_guard ?? '') ||
      position !== (contact.position ?? '') ||
      department !== (contact.department ?? '') || // [--NOVO--]
      notes !== (contact.notes ?? '') ||
      isActive !== ((contact.status ?? 'active') === 'active')
    );
  }, [isCreating, contact, fullName, contactGuard, position, department, notes, isActive]);

  useEffect(() => {
    const isNewContact = contact?.id !== lastLoadedIdRef.current;
    if (!isNewContact) return;

    setFullName(contact?.full_name ?? '');
    setContactGuard(contact?.contact_guard ?? '');
    setPosition(contact?.position ?? '');
    setDepartment(contact?.department ?? ''); // [--NOVO--]
    setNotes(contact?.notes ?? '');
    setIsActive(isCreating ? true : (contact?.status ?? 'active') === 'active');
    setError(null);
    lastLoadedIdRef.current = contact?.id ?? null;
  }, [contact, isCreating]);

  const handleCancelRequest = useCallback(() => {
    if (isDirty) {
      setIsConfirmModalOpen(true);
    } else {
      onCancel?.();
    }
  }, [isDirty, onCancel]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setError('Preencha o Nome Completo.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Contact> = {
        full_name: fullName.trim(),
        contact_guard: contactGuard && contactGuard !== '---' ? contactGuard : null,
        position: (position ?? '').trim() || null,
        department: (department ?? '').trim() || null, // [--NOVO--]
        notes: (notes ?? '').trim() || null,
        status: isActive ? 'active' : 'inactive',
      };
      
      let saved: Contact;
      if (isCreating) {
        if (!companyId || !tenantId) throw new Error("ID da Empresa e ID do Tenant são obrigatórios para criar um contato.");
        saved = await createContactSvc({ ...payload, company_id: companyId, tenant_id: tenantId });
      } else {
        saved = await updateContactSvc(contact!.id, payload);
      }
      onSaved?.(saved);
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao salvar contato.');
    } finally {
      setSaving(false);
    }
  }, [isCreating, contact, companyId, tenantId, fullName, contactGuard, position, department, notes, isActive, isValid, onSaved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancelRequest();
      if (e.key === 'Enter' && isValid && !saving) {
        e.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isValid, saving, handleSubmit, handleCancelRequest]);

  return (
    <>
      <div className="w-full rounded-2xl bg-plate dark:bg-dark-s1 neumorphic-convex p-4 relative">
        <button
          type="button"
          onClick={handleCancelRequest}
          className="absolute top-3 right-3 p-1 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow transition-colors z-10"
          aria-label="Fechar formulário"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-gray-800 dark:text-dark-t1 mb-3 pr-8">
          {isCreating ? 'Adicionar Novo Contato' : 'Editar Contato'}
        </h3>
        <div className="h-px w-full bg-dark-shadow/40 dark:bg-dark-dark-shadow/40 mb-4" />

        {error && (
          <div className="mb-3 text-sm text-red-500" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome Completo*"
            name="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome e sobrenome"
            aria-required="true"
          />
          <div>
            <Select
              label="Papel do Contato"
              name="contact_guard"
              value={contactGuard ?? ''}
              onChange={(e) => setContactGuard(e.target.value)}
            >
              <option value="">---</option>
              {CONTACT_GUARD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <Input
            label="Cargo"
            name="position"
            value={position ?? ''}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Gerente, Diretor(a), etc."
          />
          <Input
            label="Departamento"
            name="department"
            value={department ?? ''}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Vendas, Financeiro, etc."
          />
          <div className="md:col-span-2">
            <Input
              label="Notas"
              name="notes"
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações gerais"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label
            htmlFor={`switch-status-${contact?.id ?? 'new'}`}
            className="flex items-center justify-between rounded-lg px-3 py-2 neumorphic-convex cursor-pointer"
            title="Ativar/Desativar contato"
          >
            <span className="text-sm text-gray-700 dark:text-dark-t1">Status Ativo</span>
            <Switch
              id={`switch-status-${contact?.id ?? 'new'}`}
              checked={isActive}
              onCheckedChange={setIsActive}
              aria-label="Alternar status ativo do contato"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            isLoading={saving}
            disabled={!isValid || saving}
            aria-label="Salvar contato"
            title="Salvar"
          >
            Salvar
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="default"
              onClick={handleCancelRequest}
              disabled={saving}
              aria-label="Cancelar"
              title="Cancelar"
            >
              Cancelar
            </Button>
          )}
          <span className="ml-auto text-xs text-gray-500 dark:text-dark-t2">
            Enter salva · Esc cancela
          </span>
        </div>
      </div>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Descartar Alterações?"
      >
        <p className="mb-6">Você tem alterações não salvas. Tem certeza que deseja descartá-las?</p>
        <div className="flex justify-end gap-4">
          <Button onClick={() => setIsConfirmModalOpen(false)} variant="default">
            Continuar Editando
          </Button>
          <Button onClick={() => {
            setIsConfirmModalOpen(false);
            onCancel?.();
          }} variant="danger">
            Descartar
          </Button>
        </div>
      </Modal>
    </>
  );
}
