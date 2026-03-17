/*
-- ===================================================
-- Código             : /src/components/settings/OrganizationSettings.tsx
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-11-16 14:10
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Tela de Organização com formulário único (criar/editar),
--                      carregando o tenant visível para o JWT atual.
-- Fluxo              : SettingsPage.tsx -> OrganizationSettings -> TenantForm -> tenantService
-- Alterações (1.2.0) :
--   • Usa getCurrentTenant() (e não mais data[0] de getTenants()).
--   • Remove dependência de supabase.auth.getUser() no fluxo.
--   • Mantém modal de exclusão e reload após operações.
-- Dependências       : React, tenantService, ToastContext, TenantForm, Modal, TenantFormSkeleton.
-- ===================================================
*/

import { useState, useEffect, useCallback } from 'react';
import { Tenant } from '../../types/tenant';
import { getCurrentTenant, deleteTenant } from '../../services/tenantService';
import { useToast } from '../../contexts/ToastContext';
import { TenantForm } from './TenantForm';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TenantFormSkeleton } from './TenantFormSkeleton';

// [BLOCK] Gerenciador de visualização para a seção de Organização (FORMULÁRIO ÚNICO)
export const OrganizationSettings = () => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { addToast } = useToast();

  const fetchTenant = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCurrentTenant();
      setTenant(data);
    } catch (error) {
      console.error('Erro ao carregar organização:', error);
      addToast('Erro ao carregar organização.', 'error');
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const handleSave = () => {
    fetchTenant();
  };

  // [BLOCK] Funções para o modal de exclusão
  const openDeleteModal = () => {
    if (tenant) {
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!tenant) return;
    try {
      await deleteTenant(tenant.id!);
      addToast('Organização excluída com sucesso.', 'success');
      setIsDeleteModalOpen(false);
      setTenant(null);
      fetchTenant();
    } catch (error) {
      console.error('Erro ao excluir organização:', error);
      addToast('Erro ao excluir organização.', 'error');
    }
  };

  return (
    <>
      {isLoading ? (
        <TenantFormSkeleton />
      ) : (
        <TenantForm
          initialData={tenant}
          onSave={handleSave}
          onDelete={openDeleteModal}
        />
      )}

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6">
          Tem certeza que deseja excluir a organização{' '}
          <strong>{tenant?.company_name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-4">
          <Button onClick={() => setIsDeleteModalOpen(false)} variant="default">
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirm} variant="danger">
            Excluir
          </Button>
        </div>
      </Modal>
    </>
  );
};
