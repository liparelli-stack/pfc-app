/*
-- ===================================================
-- Código             : /src/pages/ForgotPasswordPage.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-25 15:10 America/Sao_Paulo
-- Autor              : FL / Execução via Eva
-- Objetivo do código : Tela para solicitar link de recuperação de senha.
-- Fluxo              : AuthPage(view=forgot) -> sendPasswordResetEmail -> Supabase envia link.
-- ===================================================
*/

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const { sendPasswordResetEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const { error } = await sendPasswordResetEmail(email)
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setMessage('Se este e-mail existir, você receberá um link para redefinir sua senha.')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-plate dark:bg-plate-dark">
      <div className="w-full max-w-sm p-8 space-y-6 bg-plate dark:bg-plate-dark rounded-2xl neumorphic-convex">

        <h1 className="text-2xl font-bold text-center">Redefinir Senha</h1>

        {message && <p className="text-center text-green-600 text-sm">{message}</p>}
        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <Button className="w-full" isLoading={loading}>
            Enviar link de redefinição
          </Button>
        </form>

        <p className="text-center text-sm">
          Lembrou sua senha?
          <button onClick={onBack} className="ml-1 text-primary hover:underline">
            Voltar ao login
          </button>
        </p>
      </div>
    </div>
  )
}
