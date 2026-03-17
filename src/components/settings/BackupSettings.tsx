/*
  Código             : /src/components/settings/BackupSettings.tsx
  Versão (.v20)      : v1.2.0
  Data/Hora          : 2025-12-04 23:25
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Tela de Configurações para Backup de Dados
  Fluxo              : SettingsPage -> BackupSettings -> backupService.generateFullBackup()
  Alterações (1.2.0) :
    • Botão principal "Fazer Backup de Dados Agora" em azul, posicionado no cabeçalho (layout atualizado).
    • Removido "(em breve)" do botão Incremental e a frase "Por enquanto apenas o backup total está disponível.".
    • Modal de histórico de backups aprimorado:
      - Lista de backups clicável.
      - Painel de detalhes com todas as informações do registro.
      - Campo JSON "tables" exibido em grid organizado (Tabela / Registros).
      - Colunas e labels em português, com nome do usuário em vez de ID.
  Dependências       : react-query, backupTablesCatalog, backupService, backupHistoryService
*/

import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  BACKUP_TABLES,
  BACKUP_TABLE_GROUP_LABELS,
  type BackupTableGroup,
  type BackupTableItem,
} from "@/services/backup/backupTablesCatalog";

import { generateFullBackup } from "@/services/backup/backupService";
import {
  getBackupHistory,
  type BackupHistoryItem,
} from "@/services/backup/backupHistoryService";

type BackupType = "full" | "incremental";

interface TableSelectionState {
  [key: string]: boolean;
}

function getTableKey(table: BackupTableItem): string {
  return `${table.schema}.${table.name}`;
}

function groupTables(
  tables: BackupTableItem[]
): Record<BackupTableGroup, BackupTableItem[]> {
  return tables.reduce(
    (acc, table) => {
      acc[table.group].push(table);
      return acc;
    },
    {
      organizacao: [] as BackupTableItem[],
      cadastros: [] as BackupTableItem[],
      operacoes: [] as BackupTableItem[],
      sistema: [] as BackupTableItem[],
    }
  );
}

function formatBackupDate(value: string): string {
  if (!value) return "-";
  const d = new Date(value);

  const data = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const semana = d.toLocaleDateString("pt-BR", {
    weekday: "short",
  });

  return `${data} ${hora} ${semana}`;
}

function translateStatus(status: string | null | undefined): string {
  switch (status) {
    case "requested":
      return "Solicitado";
    case "processing":
      return "Processando";
    case "completed":
      return "Concluído";
    case "failed":
      return "Falhou";
    default:
      return status || "-";
  }
}

function translateType(type: string | null | undefined): string {
  switch (type) {
    case "full":
      return "Total";
    case "incremental":
      return "Incremental";
    default:
      return type || "-";
  }
}

const BackupSettings: React.FC = () => {
  const [backupType] = useState<BackupType>("full");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);

  const initialSelection: TableSelectionState = useMemo(() => {
    const state: TableSelectionState = {};
    BACKUP_TABLES.forEach((table) => {
      state[getTableKey(table)] = true;
    });
    return state;
  }, []);

  const [selection, setSelection] = useState<TableSelectionState>(
    initialSelection
  );

  const groupedTables = useMemo(
    () => groupTables(BACKUP_TABLES),
    []
  );

  const allSelected = useMemo(
    () => Object.values(selection).every(Boolean),
    [selection]
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      if (!allSelected) {
        throw new Error(
          "Para executar o backup completo é necessário manter todas as tabelas selecionadas."
        );
      }

      const selectedNames = BACKUP_TABLES.filter(
        (t) => selection[getTableKey(t)]
      ).map((t) => t.name);

      await generateFullBackup({
        type: "full",
        selectedTableNames: selectedNames,
      });
    },
    onSuccess: () => {
      setSuccessMessage("Backup gerado com sucesso. O download foi iniciado.");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o backup.";
      setErrorMessage(message);
      // eslint-disable-next-line no-console
      console.error("[BackupSettings] Erro ao gerar backup:", error);
    },
  });

  const {
    data: history,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<BackupHistoryItem[], unknown>({
    queryKey: ["backupHistory"],
    queryFn: getBackupHistory,
    enabled: isHistoryOpen,
  });

  const toggleTable = (table: BackupTableItem) => {
    const key = getTableKey(table);
    setSelection((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleGroup = (group: BackupTableGroup, value: boolean) => {
    const tables = groupedTables[group];
    setSelection((prev) => {
      const next = { ...prev };
      tables.forEach((t) => {
        next[getTableKey(t)] = value;
      });
      return next;
    });
  };

  const isIncrementalDisabled = true;
  const isExecuting = mutation.isLoading;

  const openHistory = () => {
    setIsHistoryOpen(true);
    void refetchHistory();
  };

  const closeHistory = () => {
    setIsHistoryOpen(false);
    setSelectedBackupId(null);
  };

  const selectedBackup: BackupHistoryItem | null =
    history && history.length > 0
      ? history.find((b) => b.id === selectedBackupId) ?? history[0]
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho + ações */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Backup de Dados</h2>
          <p className="text-sm text-gray-500">
            Gere um backup completo das principais tabelas do CRM Appy em formato CSV,
            compactado em um único arquivo ZIP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            onClick={openHistory}
          >
            Ver histórico de backups
          </button>

          <button
            type="button"
            className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium shadow-sm ${
              !allSelected || isExecuting
                ? "cursor-not-allowed bg-gray-200 text-gray-500"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            onClick={() => mutation.mutate()}
            disabled={!allSelected || isExecuting}
          >
            {isExecuting ? "Gerando backup..." : "Fazer Backup de Dados Agora"}
          </button>
        </div>
      </div>

      {/* Tipo de backup */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-medium text-gray-700">Tipo de backup</h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md border border-blue-600 bg-blue-50 px-3 py-1.5 text-sm text-blue-700"
          >
            Total (recomendado)
          </button>
          <button
            type="button"
            className="cursor-not-allowed rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-400"
            disabled={isIncrementalDisabled}
          >
            Incremental
          </button>
        </div>
      </div>

      {/* Aviso de integridade */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800">
        <p className="font-medium">
          Atenção: para garantir a integridade do backup é recomendado manter todas as tabelas
          selecionadas.
        </p>
        <p className="mt-1">
          Se você desmarcar <strong>qualquer item</strong>, o backup completo não será executado.
        </p>
      </div>

      {/* Grid de grupos */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(groupedTables) as BackupTableGroup[]).map((groupKey) => {
          const groupLabel = BACKUP_TABLE_GROUP_LABELS[groupKey];
          const tables = groupedTables[groupKey];
          const allGroupSelected = tables.every(
            (t) => selection[getTableKey(t)]
          );

          return (
            <div
              key={groupKey}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800">
                  {groupLabel}
                </h4>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={allGroupSelected}
                    onChange={(e) => toggleGroup(groupKey, e.target.checked)}
                  />
                  <span>Selecionar grupo</span>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                {tables.map((table) => {
                  const key = getTableKey(table);
                  const checked = selection[key];

                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={checked}
                          onChange={() => toggleTable(table)}
                        />
                        <span className="text-sm text-gray-800">
                          {table.label}
                        </span>
                      </div>
                      <span className="text-[0.7rem] font-mono text-gray-400">
                        {table.schema}.{table.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mensagens inline */}
      {(errorMessage || successMessage) && (
        <div className="space-y-2 text-xs">
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
              {successMessage}
            </div>
          )}
        </div>
      )}

      {/* Modal de histórico de backups */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Cabeçalho do modal */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Histórico de Backups
                </h3>
                <p className="text-xs text-gray-500">
                  Visualize os backups gerados, incluindo detalhes completos e tabelas exportadas.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                onClick={closeHistory}
              >
                Fechar
              </button>
            </div>

            <div className="grid max-h-[75vh] grid-cols-1 divide-y divide-gray-200 md:grid-cols-3 md:divide-x md:divide-y-0">
              {/* Lista de backups */}
              <div className="md:col-span-1 overflow-auto px-4 py-3 text-xs">
                {isHistoryLoading && (
                  <p className="text-gray-500">Carregando histórico de backups...</p>
                )}

                {isHistoryError && (
                  <p className="text-red-600">
                    Não foi possível carregar o histórico de backups.
                    {historyError instanceof Error ? ` (${historyError.message})` : null}
                  </p>
                )}

                {!isHistoryLoading &&
                  !isHistoryError &&
                  history &&
                  history.length > 0 && (
                    <ul className="space-y-1">
                      {history.map((item) => {
                        const isSelected =
                          (selectedBackup && item.id === selectedBackup.id) ||
                          (!selectedBackup && history[0]?.id === item.id);

                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={`w-full rounded-md border px-2 py-2 text-left text-[0.75rem] ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 text-blue-800"
                                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                              }`}
                              onClick={() => setSelectedBackupId(item.id)}
                            >
                              <div className="font-medium">
                                {formatBackupDate(item.created_at)}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.7rem]">
                                <span className="rounded bg-gray-100 px-1 py-[1px]">
                                  {translateType(item.backup_type)}
                                </span>
                                <span className="rounded bg-gray-100 px-1 py-[1px]">
                                  {translateStatus(item.status)}
                                </span>
                                {item.profile_name && (
                                  <span className="truncate text-gray-500">
                                    por {item.profile_name}
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                {!isHistoryLoading &&
                  !isHistoryError &&
                  (!history || history.length === 0) && (
                    <p className="text-gray-500">Nenhum backup registrado até o momento.</p>
                  )}
              </div>

              {/* Detalhes do backup selecionado */}
              <div className="md:col-span-2 overflow-auto px-4 py-3 text-xs">
                {selectedBackup ? (
                  <div className="space-y-4">
                    {/* Resumo */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Data do backup
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatBackupDate(selectedBackup.created_at)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Tipo
                        </p>
                        <p className="text-sm text-gray-900">
                          {translateType(selectedBackup.backup_type)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Status
                        </p>
                        <p className="text-sm text-gray-900">
                          {translateStatus(selectedBackup.status)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Quem fez
                        </p>
                        <p className="text-sm text-gray-900">
                          {selectedBackup.profile_name || "-"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Total de tabelas
                        </p>
                        <p className="text-sm text-gray-900">
                          {selectedBackup.total_tables ?? 0}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Destinos
                        </p>
                        <p className="text-sm text-gray-900">
                          {Array.isArray(selectedBackup.destinations)
                            ? (selectedBackup.destinations as string[]).join(", ")
                            : "-"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Arquivo (nome)
                        </p>
                        <p className="text-sm text-gray-900">
                          {selectedBackup.file_name || "-"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-semibold text-gray-500">
                          Caminho / Referência externa
                        </p>
                        <p className="text-[0.7rem] text-gray-900">
                          {selectedBackup.file_path || "-"}
                        </p>
                        {selectedBackup.external_reference && (
                          <p className="text-[0.7rem] text-gray-700">
                            Ref: {selectedBackup.external_reference}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Erro, se existir */}
                    {selectedBackup.error_message && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-2">
                        <p className="text-[0.7rem] font-semibold text-red-700">
                          Mensagem de erro
                        </p>
                        <p className="mt-1 text-[0.7rem] text-red-800">
                          {selectedBackup.error_message}
                        </p>
                      </div>
                    )}

                    {/* Tabelas (campo JSON organizado) */}
                    <div>
                      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-gray-500">
                        Tabelas incluídas no backup
                      </p>
                      {selectedBackup.tables.length === 0 ? (
                        <p className="text-[0.75rem] text-gray-500">
                          Nenhuma tabela registrada neste backup.
                        </p>
                      ) : (
                        <table className="min-w-full border-collapse text-[0.75rem]">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-[0.7rem] uppercase tracking-wide text-gray-500">
                              <th className="px-2 py-2 text-left">Tabela</th>
                              <th className="px-2 py-2 text-right">Registros</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedBackup.tables.map((t) => (
                              <tr
                                key={t.table}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="px-2 py-1 align-top font-mono text-[0.7rem] text-gray-800">
                                  {t.table}
                                </td>
                                <td className="px-2 py-1 align-top text-right text-gray-800">
                                  {t.rows ?? 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Nenhum backup selecionado.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupSettings;
