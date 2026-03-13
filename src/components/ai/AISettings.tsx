import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  PROVIDER_META,
  saveProviderConfig,
  testConnection,
  type LLMProvider,
  type LLMConfig,
} from '@/services/llm.service'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AISettingsProps {
  open: boolean
  onClose: () => void
  configs: LLMConfig[]
  onSaved: (provider: LLMProvider, apiKey: string, configId: string) => void
}

// ─── Per-provider state ───────────────────────────────────────────────────────

interface ProviderState {
  key: string
  model: string
  showKey: boolean
  testing: boolean
  saving: boolean
  testResult: 'ok' | 'fail' | null
}

function initState(provider: LLMProvider): ProviderState {
  return {
    key: '',
    model: PROVIDER_META[provider].model,
    showKey: false,
    testing: false,
    saving: false,
    testResult: null,
  }
}

// ─── ProviderSection ─────────────────────────────────────────────────────────

interface ProviderSectionProps {
  provider: LLMProvider
  config: LLMConfig | undefined
  state: ProviderState
  onChange: (patch: Partial<ProviderState>) => void
  onTest: () => void
  onSave: () => void
}

function ProviderSection({ provider, config, state, onChange, onTest, onSave }: ProviderSectionProps) {
  const meta = PROVIDER_META[provider]
  const isConfigured = config?.has_key ?? false

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{meta.label}</h3>
        {isConfigured ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            configurado
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            não configurado
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          API Key {isConfigured && <span className="text-green-600">(já salva — cole nova para atualizar)</span>}
        </Label>
        <div className="relative">
          <Input
            type={state.showKey ? 'text' : 'password'}
            placeholder={meta.placeholder}
            value={state.key}
            onChange={(e) => onChange({ key: e.target.value, testResult: null })}
            className="pr-9 font-mono text-sm"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onChange({ showKey: !state.showKey })}
          >
            {state.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Modelo</Label>
        <Input
          value={state.model}
          onChange={(e) => onChange({ model: e.target.value })}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={!state.key || state.testing || state.saving}
        >
          {state.testing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : state.testResult === 'ok' ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-600 mr-1.5" />
          ) : state.testResult === 'fail' ? (
            <XCircle className="h-3.5 w-3.5 text-red-600 mr-1.5" />
          ) : null}
          Testar
        </Button>

        <Button
          size="sm"
          onClick={onSave}
          disabled={!state.key || state.saving || state.testing}
        >
          {state.saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Salvar
        </Button>

        {state.testResult === 'ok'  && <span className="text-xs text-green-600">✓ Conexão OK</span>}
        {state.testResult === 'fail' && <span className="text-xs text-red-600">✗ Falha na conexão</span>}
      </div>
    </div>
  )
}

// ─── AISettings ───────────────────────────────────────────────────────────────

const PROVIDERS: LLMProvider[] = ['claude', 'chatgpt', 'gemini', 'deepseek']

export function AISettings({ open, onClose, configs, onSaved }: AISettingsProps) {
  const [states, setStates] = useState<Record<LLMProvider, ProviderState>>(() => ({
    claude:   initState('claude'),
    chatgpt:  initState('chatgpt'),
    gemini:   initState('gemini'),
    deepseek: initState('deepseek'),
  }))

  function patch(provider: LLMProvider, update: Partial<ProviderState>) {
    setStates((prev) => ({ ...prev, [provider]: { ...prev[provider], ...update } }))
  }

  async function handleTest(provider: LLMProvider) {
    const { key } = states[provider]
    if (!key) return
    patch(provider, { testing: true, testResult: null })
    const ok = await testConnection(provider, key)
    patch(provider, { testing: false, testResult: ok ? 'ok' : 'fail' })
    if (ok) toast.success(`${PROVIDER_META[provider].label}: conexão bem-sucedida.`)
    else     toast.error(`${PROVIDER_META[provider].label}: falha na conexão. Verifique a chave.`)
  }

  async function handleSave(provider: LLMProvider) {
    const { key, model } = states[provider]
    if (!key) return
    patch(provider, { saving: true })
    try {
      const configId = await saveProviderConfig(provider, key, model)
      toast.success(`${PROVIDER_META[provider].label} configurado.`)
      onSaved(provider, key, configId)
      patch(provider, { saving: false, key: '', testResult: null })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar configuração.')
      patch(provider, { saving: false })
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Configurar provedores de IA</SheetTitle>
          <SheetDescription>
            Cole a API key de cada provedor que deseja usar. As chaves são salvas no Supabase com RLS.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {PROVIDERS.map((provider, idx) => (
            <div key={provider}>
              <ProviderSection
                provider={provider}
                config={configs.find((c) => c.provider === provider)}
                state={states[provider]}
                onChange={(update) => patch(provider, update)}
                onTest={() => handleTest(provider)}
                onSave={() => handleSave(provider)}
              />
              {idx < PROVIDERS.length - 1 && <Separator className="mt-6" />}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
