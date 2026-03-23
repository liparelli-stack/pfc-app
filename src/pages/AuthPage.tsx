/*
-- ===================================================
-- Código             : /src/pages/AuthPage.tsx
-- Versão (.v20)      : 3.2.0
-- Data/Hora          : 2025-12-06 21:30 America/Sao_Paulo
-- Autor              : FL / Execução via Eva
-- Objetivo do codigo : Tela de autenticação com:
--                      • Login por senha
--                      • Cadastro (signup)
--                      • Recuperação de senha (forgot)
--                      • Login sem senha via Magic Link (signInWithOtp)
-- Fluxo              : App -> AuthPage
--                      - view=login   → e-mail + senha OU Magic Link
--                      - view=signup  → criação de senha
--                      - view=forgot  → envia e-mail de reset de senha
-- Alterações (3.2.0) :
--   • [ADD] Botão "Entrar com Magic Link" usando supabase.auth.signInWithOtp.
--   • [UX] Reuso das mensagens de feedback (message/error) para o fluxo do Magic Link.
-- Alterações (3.1.0) :
--   • [CLEAN] Removida dependência do RPC ensureProfileAfterLogin e dos headers x_profile_id/x_tenant_id.
--   • [AUTH] Login depende apenas do JWT + RLS, alinhado ao novo modelo do CRM Appy.
-- Dependências       : AuthContext, ForgotPasswordPage, supabaseClient, Input, Button, lucide-react
-- ===================================================
*/

import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import ForgotPasswordPage from './ForgotPasswordPage';
import { supabase } from '@/lib/supabaseClient';

type AuthView = 'login' | 'signup' | 'forgot';

export const AuthPage = () => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { signIn, signUp } = useAuth();
  
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);
  
  const handleViewChange = (newView: AuthView) => {
    setView(newView);
    setError('');
    setMessage('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (view === 'login') {
      const { error } = await signIn({ email, password });

      if (error) {
        setError(error.message);
      } else {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
      }
    } else if (view === 'signup') {
      const { error } = await signUp({ email, password });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Cadastro realizado! Verifique seu e-mail para confirmar e depois faça login.');
        handleViewChange('login');
      }
    }

    setLoading(false);
  };

  const getTitle = () => (view === 'signup' ? 'Crie sua Senha' : 'Bem-vindo');

  // ---------------------------------------------------------------------------
  // VIEW: FORGOT PASSWORD (Esqueci minha senha)
  // ---------------------------------------------------------------------------
  if (view === 'forgot') {
    return <ForgotPasswordPage onBack={() => handleViewChange('login')} />;
  }

  // ---------------------------------------------------------------------------
  // VIEW: LOGIN / SIGNUP
  // ---------------------------------------------------------------------------
  return (
    <div className="flex items-center justify-center min-h-screen bg-plate dark:bg-dark-s1">
      <div className="w-full max-w-sm p-8 space-y-6 bg-plate dark:bg-dark-s1 rounded-2xl neumorphic-convex">
        
        <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-dark-t1">
          {getTitle()}
        </h1>
        
        {message && (
          <p className="text-center text-sm text-green-500 dark:text-green-400">
            {message}
          </p>
        )}
        {error && (
          <p className="text-center text-sm text-red-500">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={view === 'login' || view === 'signup'}
            minLength={6}
            autoComplete={view === 'login' ? 'current-password' : 'new-password'}
            icon={showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            onIconClick={() => setShowPassword(!showPassword)}
          />
          
          {view === 'login' && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-400 dark:border-gray-500 bg-plate dark:bg-dark-s1 text-primary focus:ring-primary focus:ring-offset-0"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-gray-700 dark:text-dark-t1"
                >
                  Lembrar login
                </label>
              </div>

              <button
                type="button"
                onClick={() => handleViewChange('forgot')}
                className="text-primary hover:underline ml-2"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <div className="pt-2 space-y-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={loading && view !== 'login'} // loading principal para signup; login também usa mas o magic link tem lógica própria
            >
              {view === 'login' && 'Entrar'}
              {view === 'signup' && 'Cadastrar'}
            </Button>

            {/* -----------------------------------------------------------------
               Botão Magic Link (apenas na view de login)
               ----------------------------------------------------------------- */}
            {view === 'login' && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                isLoading={loading && message.startsWith('Enviamos um link mágico')}
                onClick={async () => {
                  setError('');
                  setMessage('');

                  if (!email || !email.includes('@')) {
                    setError('Informe um e-mail válido para enviar o Magic Link.');
                    return;
                  }

                  setLoading(true);

                  const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                      emailRedirectTo: window.location.origin,
                    },
                  });

                  setLoading(false);

                  if (error) {
                    setError(error.message);
                  } else {
                    setMessage('Enviamos um link mágico para seu e-mail. Verifique sua caixa de entrada!');
                  }
                }}
              >
                Entrar com Magic Link
              </Button>
            )}
          </div>
        </form>
        
        <p className="text-center text-sm">
          {view === 'login' && 'Não tem uma senha?'}
          {view === 'signup' && 'Já tem uma senha?'}
          <button 
            onClick={() => handleViewChange(view === 'signup' ? 'login' : 'signup')} 
            className="font-semibold text-primary ml-1 hover:underline"
          >
            {view === 'login' && 'Crie aqui'}
            {view === 'signup' && 'Faça login'}
          </button>
        </p>
      </div>
    </div>
  );
};
