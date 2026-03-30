/*
-- ===================================================
-- Código             : /src/components/settings/IntegrationKeysSettings.tsx
-- Versão (.v20)      : 0.9.0
-- Data/Hora          : 2026-03-28 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo do codigo : Gerenciar chaves de integração por tenant.
--                      Inclui preset LLM editável (temperatura, topP, maxTokens)
--                      persistido em localStorage para uso pelo Gemini.
-- Alterações (0.8.0) :
--   • [NEW] Seção de sliders de preset LLM no formulário (apenas provider gemini)
--   • [NEW] Coluna "Modelo" na tabela de chaves
--   • [REMOVE] Botão e modal "Modelos Gemini" removidos
--   • [FIX] Preset salvo em localStorage ao salvar chave gemini
-- Alterações (0.9.0) :
--   • [NEW] Provider select dropdown com catálogo LLM_PROVIDERS
--   • [NEW] Model select dropdown filtrado por provider
--   • [NEW] Sliders de preset para todos os providers LLM
--   • [NEW] model_default salvo em metadata.model_default no submit
--   • [NEW] Coluna Modelo usa getModelById() em vez de string estática
--   • [NEW] Botão "Adicionar Chave" no padrão DS v0101 (native button + SVG)
--   • [NEW] Botão "Testar Conexão" placeholder
-- Dependências       : React, lucide-react, clsx,
--                      @/contexts/ToastContext,
--                      @/components/ui/Button, @/components/ui/Modal,
--                      @/services/integrationKeysService,
--                      @/hooks/useLLMPreset,
--                      @/config/llmPreset,
--                      @/config/llmProviders
-- ===================================================
*/

import React, { useEffect, useMemo, useState } from "react";
import {
  Trash,
  RefreshCw,
  Pencil,
  Eye,
  EyeOff,
  Bot,
  MessageCircle,
  Key,
  Zap,
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
import { useLLMPreset } from "@/hooks/useLLMPreset";
import {
  LLM_DEFAULT_PRESET,
  LLMPreset,
} from "@/config/llmPreset";
import {
  LLM_PROVIDERS,
  getProviderById,
  getModelById,
  tierLabel,
} from "@/config/llmProviders";

/* ========================================================= */
/* Tipos locais                                              */
/* ========================================================= */

type Mode = "create" | "edit";

/* ========================================================= */
/* Constantes                                                */
/* ========================================================= */

const LLM_PROVIDER_IDS = new Set(LLM_PROVIDERS.map((p) => p.id));


/* ========================================================= */
/* Helpers de UI                                             */
/* ========================================================= */

const getProviderIcon = (provider: string) => {
  const p = provider.toLowerCase();
  if (LLM_PROVIDER_IDS.has(p)) {
    return <Bot className="h-4 w-4 text-purple-500" />;
  }
  if (p.includes("whatsapp") || p.includes("telegram") || p.includes("sms") || p.includes("meta")) {
    return <MessageCircle className="h-4 w-4 text-green-500" />;
  }
  return <Key className="h-4 w-4 text-gray-400" />;
};

/* ========================================================= */
/* Slider helper                                             */
/* ========================================================= */

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
};

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <label className="text-xs" style={{ color: "var(--t3)" }}>
        {label}
      </label>
      <span className="text-xs font-mono" style={{ color: "var(--acc)" }}>
        {display}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full llm-range"
    />
  </div>
);

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
  /* ── Helpers para inicializar estado do provider ── */
  function initProviderOption(prov?: string): string {
    if (!prov) return "";
    if (LLM_PROVIDER_IDS.has(prov)) return prov;
    return "";
  }

  function initModelId(prov?: string, meta?: Record<string, any> | null): string {
    if (!prov) return "";
    const fromMeta = meta?.model_default as string | undefined;
    if (fromMeta) return fromMeta;
    return getProviderById(prov)?.models.find((m) => m.isDefault)?.id ?? "";
  }

  const [providerOption, setProviderOption] = useState<string>(
    initProviderOption(initial?.provider)
  );
  const [modelId, setModelId] = useState<string>(
    initModelId(initial?.provider, initial?.metadata as any)
  );
  const [label, setLabel] = useState(initial?.label ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [metadataText, setMetadataText] = useState(
    initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : ""
  );
  const [testingConnection, setTestingConnection] = useState(false);

  const { addToast } = useToast();
  const { preset, savePreset, resetToFactory } = useLLMPreset();
  const [localPreset, setLocalPreset] = useState<LLMPreset>(preset);

  /* ── Derivados ── */
  const effectiveProvider = providerOption;
  const isLLMProvider = LLM_PROVIDER_IDS.has(effectiveProvider);
  const providerModels = getProviderById(effectiveProvider)?.models ?? [];
  const selectedModel = getModelById(effectiveProvider, modelId);
  const providerObj = getProviderById(effectiveProvider);

  const title = useMemo(() => {
    const modelName = selectedModel?.name;
    const provName = providerObj?.name ?? effectiveProvider;
    if (!provName) return mode === "create" ? "Adicionar Chave" : "Editar Chave";
    const suffix = modelName ? ` — ${modelName}` : ` — ${provName}`;
    return mode === "create" ? `Adicionar Chave${suffix}` : `Editar Chave${suffix}`;
  }, [mode, effectiveProvider, selectedModel, providerObj]);

  /* ── Sincroniza quando initial/mode muda ── */
  useEffect(() => {
    const prov = initial?.provider ?? "";
    const opt = initProviderOption(prov);
    setProviderOption(opt);
    setModelId(initModelId(prov, initial?.metadata as any));
    setLabel(initial?.label ?? "");
    setApiKey(initial?.apiKey ?? "");
    setIsActive(initial?.isActive ?? true);
    setIsDefault(initial?.isDefault ?? false);
    setMetadataText(
      initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : ""
    );
    setShowApiKey(false);
    setLocalPreset(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial]);

  /* ── Quando provider muda, auto-seleciona modelo padrão ── */
  function handleProviderOptionChange(val: string) {
    setProviderOption(val);
    if (val !== "outro") {
      const defModel = getProviderById(val)?.models.find((m) => m.isDefault)?.id ?? "";
      setModelId(defModel);
    } else {
      setModelId("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!effectiveProvider) {
      addToast("Selecione um provider.", "error");
      return;
    }
    if (!label.trim()) {
      addToast("Informe um rótulo (label) para a chave.", "error");
      return;
    }
    if (!apiKey.trim()) {
      addToast("Informe a API Key.", "error");
      return;
    }

    let metadata: Record<string, any> | undefined;
    const trimmed = metadataText.trim();
    if (trimmed) {
      try {
        metadata = JSON.parse(trimmed);
      } catch {
        addToast("Metadata inválido. Use um JSON válido ou deixe em branco.", "error");
        return;
      }
    }

    /* Injeta model_default no metadata para providers LLM */
    if (isLLMProvider && modelId) {
      metadata = { ...(metadata ?? {}), model_default: modelId };
    }

    const input: IntegrationKeyInput = {
      id: initial?.id,
      provider: effectiveProvider,
      label: label.trim(),
      apiKey: apiKey.trim(),
      isActive,
      isDefault,
      metadata,
    };

    await onSubmit(input);

    /* Persiste preset para qualquer provider LLM */
    if (isLLMProvider) {
      savePreset(localPreset);
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      addToast("Conexão testada com sucesso (funcionalidade em breve).", "success");
    } finally {
      setTestingConnection(false);
    }
  }

  /* ── Input style reutilizável ── */
  const inputClass =
    "px-3 py-2 rounded-lg text-sm w-full bg-plate dark:bg-dark-s1 border border-dark-shadow/20 dark:border-dark-dark-shadow/20 focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>

      {/* Provider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Provider</label>
          <select
            className={inputClass}
            value={providerOption}
            onChange={(e) => handleProviderOptionChange(e.target.value)}
            disabled={mode === "edit"}
          >
            <option value="">Selecione um provider</option>
            {LLM_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon ? `${p.icon} ` : ""}{p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Modelo — só para providers LLM */}
        {isLLMProvider && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Modelo</label>
            <select
              className={inputClass}
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            >
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {tierLabel(m.tier)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Label ocupa 2 colunas quando modelo não exibido */}
        <div className={clsx("flex flex-col gap-1", !isLLMProvider && "md:col-span-1")}>
          <label className="text-sm font-medium">Label</label>
          <input
            type="text"
            className={inputClass}
            placeholder="ex: CRMAPPY_AI"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>

      {/* API Key */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            className={inputClass + " pr-10"}
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
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Checkboxes */}
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

      {/* Metadata */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">
          Metadata (JSON opcional – configs extras)
        </label>
        <textarea
          className="px-3 py-2 rounded-lg text-xs min-h-[72px] font-mono bg-plate dark:bg-dark-s1 border border-dark-shadow/20 dark:border-dark-dark-shadow/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder='{ "webhook_url": "https://..." }'
          value={metadataText}
          onChange={(e) => setMetadataText(e.target.value)}
        />
      </div>

      {/* ── Preset LLM — para todos os providers LLM ── */}
      {isLLMProvider && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium" style={{ color: "var(--t2)" }}>
            ⚙️ Parâmetros de Geração
          </h3>

          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--s1)", border: "0.5px solid var(--bmd)" }}
          >
            {(() => {
              const supportsOpenAiParams = !['gemini', 'mistral'].includes(providerOption);
              return (
                <>
                  <SliderRow
                    label="Temperatura"
                    value={localPreset.temperature}
                    min={0} max={1} step={0.01}
                    display={localPreset.temperature.toFixed(2)}
                    onChange={(v) => setLocalPreset({ ...localPreset, temperature: v })}
                  />
                  <SliderRow
                    label="Diversidade de resposta"
                    value={localPreset.top_p}
                    min={0} max={1} step={0.01}
                    display={localPreset.top_p.toFixed(2)}
                    onChange={(v) => setLocalPreset({ ...localPreset, top_p: v })}
                  />
                  <SliderRow
                    label="Max Tokens"
                    value={localPreset.max_tokens}
                    min={100} max={50000} step={200}
                    display={String(localPreset.max_tokens)}
                    onChange={(v) => setLocalPreset({ ...localPreset, max_tokens: Math.round(v) })}
                  />
                  <div className={!supportsOpenAiParams ? 'opacity-50 cursor-not-allowed' : ''}>
                    <SliderRow
                      label={`Controle de repetição${!supportsOpenAiParams ? ' — OpenAI / DeepSeek / Qwen only' : ''}`}
                      value={localPreset.frequency_penalty}
                      min={0} max={2} step={0.01}
                      display={localPreset.frequency_penalty.toFixed(2)}
                      onChange={(v) => { if (supportsOpenAiParams) setLocalPreset({ ...localPreset, frequency_penalty: v }); }}
                    />
                  </div>
                  <div className={!supportsOpenAiParams ? 'opacity-50 cursor-not-allowed' : ''}>
                    <SliderRow
                      label={`Variedade de tópicos${!supportsOpenAiParams ? ' — OpenAI / DeepSeek / Qwen only' : ''}`}
                      value={localPreset.presence_penalty}
                      min={0} max={2} step={0.01}
                      display={localPreset.presence_penalty.toFixed(2)}
                      onChange={(v) => { if (supportsOpenAiParams) setLocalPreset({ ...localPreset, presence_penalty: v }); }}
                    />
                  </div>
                </>
              );
            })()}
          </div>

          <button
            type="button"
            onClick={() => {
              setLocalPreset(LLM_DEFAULT_PRESET);
              resetToFactory();
            }}
            style={{
              background: "transparent",
              border: "0.5px solid var(--bmd)",
              color: "var(--t2)",
              padding: "8px 16px",
              borderRadius: "8px",
              width: "100%",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            🔄 Restaurar Padrões Recomendados
          </button>
        </div>
      )}

      {/* Footer de ações */}
      <div className="flex justify-between items-center gap-2 pt-2">
        {/* Testar conexão */}
        <button
          type="button"
          disabled={testingConnection || !effectiveProvider || !apiKey.trim()}
          onClick={handleTestConnection}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "transparent",
            border: "0.5px solid var(--bmd)",
            color: "var(--t2)",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            cursor: testingConnection || !effectiveProvider || !apiKey.trim() ? "not-allowed" : "pointer",
            opacity: !effectiveProvider || !apiKey.trim() ? 0.45 : 1,
          }}
        >
          <Zap className="h-3.5 w-3.5" />
          {testingConnection ? "Testando…" : "Testar Conexão"}
        </button>

        <div className="flex gap-2">
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
      addToast(err?.message || "Falha ao carregar chaves de integração.", "error");
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

  function handleCloseFormModal() {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingKey(null);
    setMode("create");
  }

  return (
    <div className="neumorphic-convex rounded-2xl p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-semibold mb-1">Chaves & IA</h1>
          <p className="text-sm text-gray-600 dark:text-dark-t2">
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
              className={clsx("h-4 w-4", { "animate-spin": isRefreshing })}
            />
            <span>Atualizar</span>
          </Button>

          {/* Botão primário DS v0101 */}
          <button
            type="button"
            onClick={handleAdd}
            style={{
              display: "inline-flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "8px",
              background: "#3b68f5",
              color: "#ffffff",
              border: "0.5px solid rgba(59,104,245,0.38)",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 1px 8px rgba(59,104,245,0.35)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v7M4.5 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>Adicionar Chave</span>
          </button>
        </div>
      </div>

      {/* Lista de chaves */}
      <div className="rounded-2xl bg-white/60 dark:bg-dark-s3 p-3 md:p-4 shadow-inner border border-gray-200/50 dark:border-white/10/50">
        {isLoading ? (
          <div className="text-sm text-gray-500 p-4">Carregando chaves...</div>
        ) : !hasKeys ? (
          <div className="text-sm text-gray-500 p-4">
            Nenhuma chave cadastrada ainda. Clique em{" "}
            <span className="font-semibold">"Adicionar Chave"</span> para criar
            a primeira.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-dark-t2 border-b border-gray-200 dark:border-white/10">
                  <th className="py-3 pr-3 pl-2">Provider</th>
                  <th className="py-3 pr-3">Label</th>
                  <th className="py-3 pr-3">Modelo</th>
                  <th className="py-3 pr-3">Ativa</th>
                  <th className="py-3 pr-3">Padrão</th>
                  <th className="py-3 pr-3 hidden md:table-cell">Criada em</th>
                  <th className="py-3 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map((k) => {
                  const modelName = getModelById(
                    k.provider,
                    (k.metadata as any)?.model_default as string
                  )?.name ?? null;

                  return (
                    <tr
                      key={k.id}
                      className="border-b border-gray-100 dark:border-white/[0.06] last:border-b-0 hover:bg-gray-50/70 dark:hover:bg-dark-s2/50 transition-colors"
                    >
                      <td className="py-3 pr-3 pl-2 align-middle font-medium text-gray-800 dark:text-dark-t1">
                        <div className="flex items-center gap-2">
                          {getProviderIcon(k.provider)}
                          <span>{k.provider}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 align-middle text-gray-700 dark:text-dark-t1">
                        {k.label}
                      </td>
                      <td className="py-3 pr-3 align-middle text-xs text-gray-500 dark:text-dark-t2">
                        {modelName ?? "—"}
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
                      <td className="py-3 pr-3 align-middle hidden md:table-cell text-xs text-gray-500 dark:text-dark-t2">
                        {new Date(k.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-s2 text-gray-500 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400 transition-colors shadow-sm"
                            onClick={() => handleEdit(k)}
                            title="Editar"
                            aria-label={`Editar chave ${k.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            className="p-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-s2 text-gray-500 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 transition-colors shadow-sm"
                            onClick={() => handleDelete(k)}
                            title="Excluir"
                            aria-label={`Excluir chave ${k.label}`}
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
};

export default IntegrationKeysSettings;
