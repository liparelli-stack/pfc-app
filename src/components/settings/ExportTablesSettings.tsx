/*
-- ===================================================
-- Código             : /src/components/settings/ExportTablesSettings.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-11-20 19:45
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Tela de Exportação de Tabelas para gerar CSVs puros
--                      (todas as colunas relevantes) por tabela, por tenant.
-- Fluxo              : SettingsPage -> ExportTablesSettings -> exportTablesService
-- Alterações (1.1.0) :
--   • Labels das tabelas em português (mais amigáveis).
--   • Checkboxes passam a iniciar desmarcados.
--   • contacts_channel renomeado para "Canais de Comunicação de Contatos".
-- Dependências       : React, Button, ToastContext, exportTablesService.
-- ===================================================
*/

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { exportSelectedTables } from '@/services/exportTablesService';

type ExportSelection = {
  companies: boolean;
  contacts: boolean;
  contacts_channel: boolean;
  chats: boolean;
  tags: boolean;
  profiles: boolean;
  tickets: boolean;
  channels: boolean;
};

const defaultSelection: ExportSelection = {
  companies: false,
  contacts: false,
  contacts_channel: false,
  chats: false,
  tags: false,
  profiles: false,
  tickets: false,
  channels: false,
};

const ExportTablesSettings: React.FC = () => {
  const [selection, setSelection] = useState<ExportSelection>(defaultSelection);
  const [isExporting, setIsExporting] = useState(false);
  const { addToast } = useToast();

  const handleToggle = (key: keyof ExportSelection) => {
    setSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    const anySelected = Object.values(selection).some(v => v);
    if (!anySelected) {
      addToast('Selecione ao menos uma tabela para exportar.', 'warning');
      return;
    }

    try {
      setIsExporting(true);
      await exportSelectedTables(selection);
      addToast('Exportação iniciada. Verifique os arquivos CSV baixados.', 'success');
    } catch (error: any) {
      console.error('Erro ao exportar tabelas:', error);
      addToast(error?.message || 'Falha ao exportar tabelas.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const renderSwitch = (label: string, key: keyof ExportSelection) => (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</span>
      <input
        type="checkbox"
        className="h-5 w-10 rounded-full cursor-pointer accent-primary"
        checked={selection[key]}
        onChange={() => handleToggle(key)}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6 space-y-4">
        <header className="space-y-1">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Exportação de Tabelas
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Gere arquivos CSV puros contendo todas as colunas das tabelas disponíveis
            para este tenant.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Empresas */}
          <div className="neumorphic-concave rounded-2xl p-4 space-y-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Empresas
            </h3>
            {renderSwitch('Empresas', 'companies')}
            {renderSwitch('Contatos', 'contacts')}
            {renderSwitch('Canais de Comunicação de Contatos', 'contacts_channel')}
          </div>

          {/* Ações */}
          <div className="neumorphic-concave rounded-2xl p-4 space-y-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Ações
            </h3>
            {renderSwitch('Ações & Tarefas', 'chats')}
            {renderSwitch('Etiquetas', 'tags')}
          </div>

          {/* Gestão */}
          <div className="neumorphic-concave rounded-2xl p-4 space-y-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Gestão
            </h3>
            {renderSwitch('Pessoas', 'profiles')}
            {renderSwitch('Tickets de Suporte', 'tickets')}
            {renderSwitch('Canais', 'channels')}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleExport}
            disabled={isExporting}
            variant="primary"
          >
            {isExporting ? 'Exportando...' : 'Exportar CSVs Selecionados'}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ExportTablesSettings;
