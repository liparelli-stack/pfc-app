/*
-- ===================================================
-- Código             : /src/pages/ResetPasswordPage.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-06 21:05 America/Sao_Paulo
-- Autor              : FL / Execução via Eva
-- Objetivo do código : Adicionar “olhinho” (toggle de visibilidade)
--                      aos campos de senha e confirmar senha.
-- ===================================================
*/

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const { updateUserPassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error } = await updateUserPassword(password)
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="p-6 bg-plate rounded-xl">
          <h1 className="text-xl font-bold text-center mb-4">Senha redefinida!</h1>
          <p className="text-center">Agora você pode fazer login com sua nova senha.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-plate dark:bg-dark-s1">
      <div className="w-full max-w-sm p-8 space-y-6 bg-plate dark:bg-dark-s1 rounded-2xl neumorphic-convex">

        <h1 className="text-2xl font-bold text-center">Defina sua nova senha</h1>

        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* CAMPO SENHA */}
          <Input
            label="Nova senha"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            icon={showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            onIconClick={() => setShowPassword(!showPassword)}
          />

          {/* CAMPO CONFIRMAR SENHA */}
          <Input
            label="Confirmar senha"
            type={showConfirm ? 'text' : 'password'}
            required
            minLength={6}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            icon={showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            onIconClick={() => setShowConfirm(!showConfirm)}
          />

          <Button className="w-full" isLoading={loading}>
            Salvar nova senha
          </Button>
        </form>
      </div>
    </div>
  )
}
