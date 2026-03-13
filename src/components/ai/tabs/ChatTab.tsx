import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Send, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { callLLM, type LLMProvider, type ChatMessage } from '@/services/llm.service'
import { formatMonthLabel } from '@/services/dashboard.service'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatTabProps {
  provider: LLMProvider | null
  apiKey: string | null
  periodStart: string
  periodEnd: string
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage & { error?: boolean } }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : msg.error
            ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 rounded-tl-sm'
            : 'bg-muted rounded-tl-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

// ─── ChatTab ─────────────────────────────────────────────────────────────────

export function ChatTab({ provider, apiKey, periodStart, periodEnd }: ChatTabProps) {
  const [messages, setMessages] = useState<(ChatMessage & { error?: boolean })[]>([])
  const [input, setInput]       = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef               = useRef<HTMLDivElement>(null)
  const textareaRef             = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const systemPrompt = `Você é um assistente financeiro pessoal.
O usuário está analisando o período de ${formatMonthLabel(periodStart)} a ${formatMonthLabel(periodEnd)}.
Responda sempre em português brasileiro de forma clara, direta e prática.
Foque em análise financeira pessoal: gastos, economias, orçamento e investimentos.`

  async function handleSend() {
    const text = input.trim()
    if (!text) return

    if (!provider || !apiKey) {
      toast.error('Configure e selecione um provedor de IA antes de usar o chat.')
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setThinking(true)

    try {
      const history: ChatMessage[] = [...messages, userMsg].map(({ role, content }) => ({ role, content }))
      const reply = await callLLM(provider, apiKey, history, systemPrompt)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Erro ao contatar o provedor de IA.'
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg, error: true }])
      toast.error('Falha na resposta do LLM.')
    } finally {
      setThinking(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = Boolean(provider && apiKey && input.trim() && !thinking)

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Messages area */}
      <ScrollArea className="flex-1 px-1">
        <div className="space-y-4 py-4 px-2">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12 space-y-2">
              <Bot className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="font-medium">Assistente financeiro pronto.</p>
              <p className="text-xs">
                Período: {formatMonthLabel(periodStart)} — {formatMonthLabel(periodEnd)}
                <br />
                Pergunte sobre seus gastos, categorias, tendências…
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {thinking && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-muted-foreground flex gap-1 items-center">
                <span className="animate-bounce [animation-delay:0ms]">●</span>
                <span className="animate-bounce [animation-delay:150ms]">●</span>
                <span className="animate-bounce [animation-delay:300ms]">●</span>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t pt-3 flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          placeholder={
            !provider || !apiKey
              ? 'Configure um provedor de IA no botão ⚙ antes de usar o chat…'
              : 'Escreva sua pergunta… (Enter para enviar, Shift+Enter para nova linha)'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!provider || !apiKey || thinking}
          rows={2}
          className="resize-none flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="shrink-0 h-[60px] w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
