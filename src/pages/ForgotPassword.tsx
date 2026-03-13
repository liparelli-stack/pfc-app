import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/services/auth.service'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})

type Fields = z.infer<typeof schema>

export function ForgotPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<Fields>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Fields) {
    try {
      await resetPassword(values.email)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar o e-mail. Tente novamente.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl">💰</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Esqueci minha senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          {isSubmitSuccessful ? (
            <div className="space-y-4 text-center">
              <div className="text-4xl">📬</div>
              <p className="text-sm text-muted-foreground">
                Se este e-mail estiver cadastrado, você receberá o link em breve.
                Verifique também a pasta de spam.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar link de redefinição
              </Button>
            </form>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}
