/*
-- ===================================================
-- Código             : /src/components/settings/IntegrationKeysSettings.tsx
-- Versão (.v20)      : 0.7.0
-- Data/Hora          : 2025-12-08 11:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Gerenciar chaves de integração (IA, mensageria, etc.)
--                      por tenant, consumindo a tabela integration_keys.
-- Fluxo              : SettingsPage -> IntegrationKeysSettings
-- Alterações (0.7.0) :
--   • [FIX] Botões de ação (Editar/Excluir) agora usam tags <button> explícitas
--     com borda e fundo para evitar transparência excessiva.
--   • [FIX] Ícone de exclusão alterado para 'Trash' (lixeira) conforme solicitado.
--   • [FIX] Ícone de edição 'Pencil' garantido.
-- Dependências       : React, lucide-react, clsx,
--                      @/contexts/ToastContext,
--                      @/components/ui/Button, @/components/ui/Modal,
--                      @/services/integrationKeysService,
--                      @/services/geminiModelsService.
-- ===================================================
*/

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash, // Solicitado: Trash (não Trash2)
  RefreshCw,
  Sparkles,
  Pencil,
  Eye,
  EyeOff,
  Bot,
  MessageCircle,
  Key,
} from "lucide-react";
import clsx from "clsx";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  IntegrationKey,
  IntegrationKeyInput,
  listIntegrationKeys,
  saveIntegrationKey,
  deleteIntegrationKey,
} from "@/services/integrationKeysService";
import {
  GeminiModel,
  listGeminiModels,
} from "@/services/geminiModelsService";

/* ========================================================= */
/* Tipos locais                                              */
/* ========================================================= */

type Mode = "create" | "edit";

/* ========================================================= */
/* Helpers de UI                                             */
/* ========================================================= */

const getProviderIcon = (provider: string) => {
  const p = provider.toLowerCase();
  if (
    p.includes("gemini") ||
    p.includes("openai") ||
    p.includes("deepseek") ||
    p.includes("anthropic") ||
    p.includes("gpt")
  ) {
    return <Bot className="h-4 w-4 text-purple-500" />;
  }
  if (
    p.includes("whatsapp") ||
    p.includes("telegram") ||
    p.includes("sms") ||
    p.includes("meta")
  ) {
    return <MessageCircle className="h-4 w-4 text-green-500" />;
  }
  return <Key className="h-4 w-4 text-gray-400" />;
};

/* ========================================================= */
/* Formulário                                                */
/* ========================================================= */

type KeyFormProps = {
  mode: Mode;
  initial?: IntegrationKey | null;
  isSubmitting: boolean;
  onSubmit: (input: IntegrationKeyInput) => Promise<void>;
  onCancel: () => void;
};

const KeyForm: React.FC<KeyFormProps> = ({
  mode,
  initial,
  isSubmitting,
  onSubmit,
  onCancel,
}) => {
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [metadataText, setMetadataText] = useState(
    initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : ""
  );
  const { addToast } = useToast();

  const title = mode === "create" ? "Adicionar Chave" : "Editar Chave";

  // Sincroniza o formulário quando o modo ou o registro inicial mudam
  useEffect(() => {
    setProvider(initial?.provider ?? "");
    setLabel(initial?.label ?? "");
    setApiKey(initial?.apiKey ?? "");
    setIsActive(initial?.isActive ?? true);
    setIsDefault(initial?.isDefault ?? false);
    setMetadataText(
      initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : ""
    );
    setShowApiKey(false);
  }, [mode, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let metadata: Record<string, any> | undefined;
    const trimmed = metadataText.trim();

    if (trimmed) {
      try {
        metadata = JSON.parse(trimmed);
      } catch {
        addToast(
          "Metadata inválido. Use um JSON válido ou deixe em branco.",
          "error"
        );
        return;
      }
    }

    const input: IntegrationKeyInput = {
      id: initial?.id,
      provider: provider.trim(),
      label: label.trim(),
      apiKey: apiKey.trim(),
      isActive,
      isDefault,
      metadata,
    };

    if (!input.provider) {
      addToast("Informe o provider (ex: gemini, openai, whatsapp).", "error");
      return;
    }
    if (!input.label) {
      addToast("Informe um rótulo (label) para a chave.", "error");
      return;
    }
    if (!input.apiKey) {
      addToast("Informe a API Key.", "error");
      return;
    }

    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Provider</label>
          <input
            type="text"
            className="neumorphic-input px-3 py-2 rounded-lg text-sm bg-plate dark:bg-plate-dark border border-dark-shadow/20 dark:border-dark-dark-shadow/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="ex: gemini, openai, whatsapp"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Label</label>
          <input
            type="text"
            className="neumorphic-input px-3 py-2 rounded-lg text-sm bg-plate dark:bg-plate-dark border border-dark-shadow/20 dark:border-dark-dark-shadow/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="ex: CRMAPPY_AI"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            className="neumorphic-input px-3 py-2 rounded-lg text-sm w-full pr-10 bg-plate dark:bg-plate-dark border border-dark-shadow/20 dark:border-dark-dark-shadow/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Cole a chave do provider aqui"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            onClick={() => setShowApiKey((prev) => !prev)}
            aria-label={showApiKey ? "Ocultar chave" : "Mostrar chave"}
          >
            {showApiKey ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Chave ativa</span>
        </label>

        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <span>Chave padrão do provider</span>
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">
          Metadata (JSON opcional – configs extras)
        </label>
        <textarea
          className="neumorphic-input px-3 py-2 rounded-lg text-xs min-h-[120px] font-mono bg-plate dark:bg-plate-dark border border-dark-shadow/20 dark:border-dark-dark-shadow/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder='{ "model_default": "models/gemini-1.5-flash" }'
          value={metadataText}
          onChange={(e) => setMetadataText(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="default"
          className="px-4 py-2 text-sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="px-4 py-2 text-sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
};

/* ========================================================= */
/* Componente principal                                      */
/* ========================================================= */

const IntegrationKeysSettings: React.FC = () => {
  const { addToast } = useToast();
  const [keys, setKeys] = useState<IntegrationKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingKey, setEditingKey] = useState<IntegrationKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modelsModalOpen, setModelsModalOpen] = useState(false);
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const hasKeys = keys.length > 0;

  const sortedKeys = useMemo(
    () =>
      keys.slice().sort((a, b) => {
        const pv = a.provider.localeCompare(b.provider);
        if (pv !== 0) return pv;
        return a.label.localeCompare(b.label);
      }),
    [keys]
  );

  async function fetchKeys(initial = false) {
    try {
      if (initial) setIsLoading(true);
      else setIsRefreshing(true);

      const data = await listIntegrationKeys();
      setKeys(data);
    } catch (err: any) {
      addToast(
        err?.message || "Falha ao carregar chaves de integração.",
        "error"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    fetchKeys(true);
  }, []);

  function handleAdd() {
    setMode("create");
    setEditingKey(null);
    setIsModalOpen(true);
  }

  function handleEdit(key: IntegrationKey) {
    setMode("edit");
    setEditingKey(key);
    setIsModalOpen(true);
  }

  async function handleDelete(key: IntegrationKey) {
    const ok = window.confirm(
      `Confirmar exclusão da chave "${key.label}" (${key.provider})?`
    );
    if (!ok) return;

    try {
      await deleteIntegrationKey(key.id);
      addToast("Chave excluída com sucesso.", "success");
      await fetchKeys();
    } catch (err: any) {
      addToast(err?.message || "Falha ao excluir chave.", "error");
    }
  }

  async function handleSubmit(input: IntegrationKeyInput) {
    try {
      setIsSubmitting(true);
      await saveIntegrationKey(input);
      addToast("Chave salva com sucesso.", "success");
      setIsModalOpen(false);
      setEditingKey(null);
      setMode("create");
      await fetchKeys();
    } catch (err: any) {
      addToast(err?.message || "Falha ao salvar chave.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShowGeminiModels() {
    try {
      setIsLoadingModels(true);
      setModels([]);
      const data = await listGeminiModels();
      setModels(data);
      setModelsModalOpen(true);
    } catch (err: any) {
      addToast(
        err?.message ||
          "Falha ao listar modelos do Gemini. Verifique a chave configurada.",
        "error"
      );
    } finally {
      setIsLoadingModels(false);
    }
  }

  function handleCloseFormModal() {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingKey(null);
    setMode("create");
  }

  return (
    <div className="neumorphic-convex rounded-2xl p-4 md:p-6">
      {/* Cabeçalho (Menu Horizontal) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-semibold mb-1">Chaves & IA</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gerencie chaves de integração (Gemini, OpenAI, WhatsApp, etc.) por
            tenant. Apenas usuários autorizados devem ter acesso a esta seção.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            type="button"
            variant="default"
            className="px-3 py-2 text-sm flex items-center gap-2"
            onClick={() => fetchKeys()}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw
              className={clsx("h-4 w-4", {
                "animate-spin": isRefreshing,
              })}
            />
            <span>Atualizar</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            className="px-3 py-2 text-sm flex items-center gap-2"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar Chave</span>
          </Button>
        </div>
      </div>

      {/* Container dedicado para o botão Modelos Gemini */}
      <div className="flex justify-end my-4">
        <Button
          type="button"
          variant="primary"
          className="px-3 py-2 text-sm flex items-center gap-2"
          onClick={handleShowGeminiModels}
          disabled={isLoadingModels}
        >
          <Sparkles className="h-4 w-4" />
          <span>Modelos Gemini</span>
        </Button>
      </div>

      {/* Lista de chaves (Card) */}
      <div className="rounded-2xl bg-white/60 dark:bg-gray-900/40 p-3 md:p-4 shadow-inner border border-gray-200/50 dark:border-gray-700/50">
        {isLoading ? (
          <div className="text-sm text-gray-500 p-4">Carregando chaves...</div>
        ) : !hasKeys ? (
          <div className="text-sm text-gray-500 p-4">
            Nenhuma chave cadastrada ainda. Clique em{" "}
            <span className="font-semibold">“Adicionar Chave”</span> para criar
            a primeira.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 pr-3 pl-2">Provider</th>
                  <th className="py-3 pr-3">Label</th>
                  <th className="py-3 pr-3">Ativa</th>
                  <th className="py-3 pr-3">Padrão</th>
                  <th className="py-3 pr-3 hidden md:table-cell">Criada em</th>
                  <th className="py-3 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-3 pr-3 pl-2 align-middle font-medium text-gray-800 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        {getProviderIcon(k.provider)}
                        <span>{k.provider}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-middle text-gray-700 dark:text-gray-300">
                      {k.label}
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <span
                        className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                          k.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        )}
                      >
                        {k.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      {k.isDefault ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          Padrão
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 align-middle hidden md:table-cell text-xs text-gray-500 dark:text-gray-400">
                      {new Date(k.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <div className="flex justify-end gap-2">
                        {/* Editar - Botão visível com borda e cor */}
                        <button
                          type="button"
                          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400 transition-colors shadow-sm"
                          onClick={() => handleEdit(k)}
                          title="Editar"
                          aria-label={`Editar chave ${k.label}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {/* Excluir - Botão visível com borda e cor */}
                        <button
                          type="button"
                          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 transition-colors shadow-sm"
                          onClick={() => handleDelete(k)}
                          title="Excluir"
                          aria-label={`Excluir chave ${k.label}`}
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      <Modal isOpen={isModalOpen} onClose={handleCloseFormModal}>
        <KeyForm
          mode={mode}
          initial={editingKey}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={handleCloseFormModal}
        />
      </Modal>

      {/* Modal de modelos Gemini */}
      <Modal
        isOpen={modelsModalOpen}
        onClose={() => setModelsModalOpen(false)}
      >
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800 dark:text-white">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Modelos disponíveis no Gemini</span>
          </h2>
          {isLoadingModels ? (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Consultando modelos do Gemini...
            </div>
          ) : models.length === 0 ? (
            <div className="text-sm text-gray-500">
              Nenhum modelo retornado. Verifique se a chave está correta e se
              possui acesso ao Gemini.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="py-2 px-3">Nome</th>
                    <th className="py-2 px-3">Exibição</th>
                    <th className="py-2 px-3 hidden md:table-cell">
                      Métodos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr
                      key={m.name}
                      className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                    >
                      <td className="py-2 px-3 align-top font-mono text-gray-600 dark:text-gray-300">
                        {m.name}
                      </td>
                      <td className="py-2 px-3 align-top">
                        <div className="font-medium text-[13px] text-gray-800 dark:text-gray-200">
                          {m.displayName}
                        </div>
                        {m.description && (
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                            {m.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 align-top hidden md:table-cell">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {m.supportedGenerationMethods.join(", ") || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="default"
              className="px-4 py-2 text-sm"
              onClick={() => setModelsModalOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IntegrationKeysSettings;
