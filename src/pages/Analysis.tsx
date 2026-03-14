import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AISettings } from '@/components/ai/AISettings'
import { ChatTab }           from '@/components/ai/tabs/ChatTab'
import { AnalysisTab }       from '@/components/ai/tabs/AnalysisTab'
import { ClassificationTab } from '@/components/ai/tabs/ClassificationTab'
import { SuggestionsTab }    from '@/components/ai/tabs/SuggestionsTab'
import {
  getConfiguredProviders,
  getProviderApiKey,
  setDefaultProvider,
  PROVIDER_META,
  type LLMProvider,
  type LLMConfig,
} from '@/services/llm.service'
import { getLastNMonths, formatMonthLabel } from '@/services/dashboard.service'

// ─── Month helpers ────────────────────────────────────────────────────────────

function getCurrentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function toDateStr(monthStr: string, lastDay = false): string {
  if (!lastDay) return monthStr
  const [y, m] = monthStr.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

function getMonthOptions(): Array<{ value: string; label: string }> {
  const current = getCurrentMonthStr()
  return getLastNMonths(current, 24).reverse().map((m) => ({ value: m, label: formatMonthLabel(m) }))
}

const MONTH_OPTIONS = getMonthOptions()

// ─── Analysis page ────────────────────────────────────────────────────────────

export function Analysis() {
  // Period
  const [periodStart, setPeriodStart] = useState(getCurrentMonthStr)
  const [periodEnd,   setPeriodEnd]   = useState(getCurrentMonthStr)

  // LLM state
  const [configs,          setConfigs]          = useState<LLMConfig[]>([])
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider | null>(null)
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [sessionKeys,      setSessionKeys]      = useState<Partial<Record<LLMProvider, string>>>({})
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [loadingConfigs,   setLoadingConfigs]   = useState(true)

  // Tabs
  const [activeTab, setActiveTab] = useState('chat')

  // ── Load configs on mount ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadConfigs() {
      setLoadingConfigs(true)
      try {
        const cfgs = await getConfiguredProviders()
        setConfigs(cfgs)

        // Pick the default provider
        const defaultCfg = cfgs.find((c) => c.is_default) ?? cfgs[0] ?? null
        if (defaultCfg) {
          setSelectedProvider(defaultCfg.provider)
          setSelectedConfigId(defaultCfg.id)

          // Try to load stored key for this provider
          const stored = await getProviderApiKey(defaultCfg.provider)
          if (stored) {
            setSessionKeys((prev) => ({ ...prev, [defaultCfg.provider]: stored }))
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar configurações de IA.')
      } finally {
        setLoadingConfigs(false)
      }
    }
    loadConfigs()
  }, [])

  // ── Provider selection ──────────────────────────────────────────────────────
  async function handleSelectProvider(provider: LLMProvider) {
    setSelectedProvider(provider)

    const cfg = configs.find((c) => c.provider === provider)
    const configId = cfg?.id ?? null
    setSelectedConfigId(configId)

    // Load stored key if not in session
    if (!sessionKeys[provider]) {
      const stored = await getProviderApiKey(provider).catch(() => null)
      if (stored) setSessionKeys((prev) => ({ ...prev, [provider]: stored }))
    }

    // Persist default provider in DB
    if (configId) {
      setDefaultProvider(configId).catch(() => {})
    }
  }

  // ── Settings saved callback ─────────────────────────────────────────────────
  async function handleSettingsSaved(provider: LLMProvider, apiKey: string, configId: string) {
    setSessionKeys((prev) => ({ ...prev, [provider]: apiKey }))

    // Refresh configs to reflect new has_key state
    try {
      const cfgs = await getConfiguredProviders()
      setConfigs(cfgs)

      // If no provider selected yet, auto-select this one
      if (!selectedProvider) {
        setSelectedProvider(provider)
        setSelectedConfigId(configId)
      }
    } catch {}
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const currentApiKey = selectedProvider ? (sessionKeys[selectedProvider] ?? null) : null
  const configuredProviders = configs.filter((c) => c.has_key)

  const providerOptions = configuredProviders.length > 0 ? configuredProviders : configs

  // Period as YYYY-MM-DD for service calls
  const periodStartDate = periodStart  // already YYYY-MM-01
  const periodEndDate   = toDateStr(periodEnd, true)

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Análise IA</h2>
          <p className="text-sm text-muted-foreground">
            Chat, análise do período, classificação e sugestões de economia.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Period selectors */}
          <span className="text-sm text-muted-foreground">De:</span>
          <Select value={periodStart} onValueChange={setPeriodStart}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">Até:</span>
          <Select value={periodEnd} onValueChange={setPeriodEnd}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.filter((o) => o.value >= periodStart).map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* LLM selector */}
          <Select
            value={selectedProvider ?? ''}
            onValueChange={(v) => handleSelectProvider(v as LLMProvider)}
            disabled={loadingConfigs || providerOptions.length === 0}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder={loadingConfigs ? 'Carregando…' : 'Selecionar LLM'} />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map((c) => (
                <SelectItem key={c.provider} value={c.provider}>
                  {PROVIDER_META[c.provider].label}
                  {!c.has_key && <span className="ml-1 text-xs text-muted-foreground">(sem chave)</span>}
                </SelectItem>
              ))}
              {providerOptions.length === 0 && (
                <SelectItem value="__none__" disabled>
                  Nenhum provedor configurado
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Settings button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-1.5" />
            Configurar LLMs
          </Button>
        </div>
      </div>

      {/* API key warning */}
      {selectedProvider && !currentApiKey && !loadingConfigs && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800 px-4 py-2.5 text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
          <span>⚠</span>
          <span>
            Chave de API para <strong>{PROVIDER_META[selectedProvider].label}</strong> não encontrada na sessão.{' '}
            <button className="underline" onClick={() => setSettingsOpen(true)}>
              Configure aqui
            </button>
            .
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="analysis">Análise</TabsTrigger>
          <TabsTrigger value="classification">Classificação</TabsTrigger>
          <TabsTrigger value="suggestions">Sugestões</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <ChatTab
            provider={selectedProvider}
            apiKey={currentApiKey}
            periodStart={periodStartDate}
            periodEnd={periodEndDate}
          />
        </TabsContent>

        <TabsContent value="analysis">
          <AnalysisTab
            provider={selectedProvider}
            apiKey={currentApiKey}
            llmConfigId={selectedConfigId}
            periodStart={periodStartDate}
            periodEnd={periodEndDate}
          />
        </TabsContent>

        <TabsContent value="classification">
          <ClassificationTab
            provider={selectedProvider}
            apiKey={currentApiKey}
            periodStart={periodStartDate}
            periodEnd={periodEndDate}
          />
        </TabsContent>

        <TabsContent value="suggestions">
          <SuggestionsTab
            provider={selectedProvider}
            apiKey={currentApiKey}
            llmConfigId={selectedConfigId}
            periodStart={periodStartDate}
            periodEnd={periodEndDate}
          />
        </TabsContent>
      </Tabs>

      {/* Settings sheet */}
      <AISettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        configs={configs}
        onSaved={handleSettingsSaved}
      />
    </div>
  )
}
