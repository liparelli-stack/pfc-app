/*
-- ===================================================
-- Código                 : /src/contexts/AuthContext.tsx
-- Versão (.v16)         : 3.6.0
-- Data/Hora             : 2025-11-13 16:05 America/Sao_Paulo
-- Autor                 : FL/Eva GPT
-- Objetivo              : Publicar currentProfileLite (profile_id/tenant_id/displayName/
--                         salutationPref/timezone) para o Dashboard e demais módulos
--                         renderizarem nome e métricas por usuário, sem fallback de
--                         e-mail nem "Usuário". Propaga JWT imediato (auth:userReady)
--                         e faz bind/validação de profile em paralelo (não bloqueia UI).
-- Fluxo                 : Boot/LOGIN → set session/user → currentProfileLite("") → fetch profile →
--                         currentProfileLite(profile_id, tenant_id, primeiro_nome) → Dashboard exibe.
-- Alterações (3.6.0)    :
--   • [SCOPE] currentProfileLite passa a incluir:
--       - id        = profiles.id (owner lógico para companies, chats, tickets)
--       - tenantId  = profiles.tenant_id
--     permitindo que o Dashboard use owner = profiles.id.
--   • [PROFILE] resolveAndPublishLite agora busca MinimalProfile (id/tenant_id)
--     + dados leves (nome/preferências) em paralelo.
--   • Mantido comportamento visual: sem placeholders de e-mail/"Usuário".
-- Alterações (3.5.0)    :
--   • Adicionado state currentProfileLite ao contexto e inclusão no value.
--   • Resolução assíncrona do profile preenche displayName (primeiro nome) e preferências.
--   • Removidos quaisquer fallbacks visuais ("Usuário"/e-mail). Nome vazio até resolver.
-- Dependências          : react, @supabase/supabase-js, '@/lib/supabaseClient'
-- ===================================================
*/

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { AuthSession, AuthError, UserCredentials, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

/* ============================ Tipos de Contexto ============================ */
type SalutationPref = 'masculino' | 'feminino' | 'neutro';

type CurrentProfileLite = {
  id: string | null;              // profiles.id (owner lógico); null enquanto não resolvido
  tenantId: string | null;        // profiles.tenant_id; null enquanto não resolvido
  displayName: string;            // sempre sem e-mail; pode ser "" enquanto não resolvido
  salutationPref: SalutationPref; // padrão 'neutro' até resolver
  timezone: string;               // padrão 'America/Sao_Paulo'
};

interface AuthContextType {
  session: AuthSession | null;
  user: User | null;
  isPasswordRecovery: boolean;
  identityError: string | null;
  currentProfileLite: CurrentProfileLite | null; // << publicado ao app
  signIn: (credentials: UserCredentials) => Promise<{ session: AuthSession | null; error: AuthError | null }>;
  signUp: (credentials: UserCredentials) => Promise<{ data: { user: User | null; session: AuthSession | null }; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: AuthError | null }>;
  updateUserPassword: (password: string) => Promise<{ error: AuthError | null }>;
}

type MinimalProfile = { id: string; tenant_id: string; status: string };
type FullProfileLite = { full_name?: string | null; salutation_pref?: SalutationPref | null; timezone?: string | null };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* =============================== Helpers ================================== */
const defaultLite: CurrentProfileLite = {
  id: null,
  tenantId: null,
  displayName: '',              // vazio = não mostrar placeholder
  salutationPref: 'neutro',
  timezone: 'America/Sao_Paulo',
};

function firstNameOnly(fullName?: string | null): string {
  const n = (fullName || '').trim();
  return n ? n.split(/\s+/)[0] : '';
}

async function fetchActiveProfile(authUserId: string): Promise<MinimalProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, tenant_id, status')
    .eq('auth_user_id', authUserId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return (data as MinimalProfile) ?? null;
}

async function fetchProfileLite(authUserId: string): Promise<FullProfileLite | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, salutation_pref, timezone')
    .eq('auth_user_id', authUserId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as FullProfileLite) ?? null;
}

const waitForSession = async (maxMs = 3000): Promise<AuthSession | null> => {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
};

const callBindRPC = async (): Promise<{ updated: boolean; reason: string | null }> => {
  const withTimeout = async <T,>(p: Promise<T>, ms = 2000): Promise<T> =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('rpc_timeout')), ms))]);

  try {
    const { data, error } = await withTimeout(supabase.rpc('bind_profile_after_login'));
    if (error) return { updated: false, reason: 'rpc_error' };
    const row: any = Array.isArray(data) ? data?.[0] : data;
    return { updated: !!row?.updated, reason: row?.reason ?? null };
  } catch (e: any) {
    return { updated: false, reason: e?.message || 'rpc_timeout' };
  }
};

/* =============================== Provider ================================= */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // << publicado: usado pelo Dashboard e demais módulos
  const [currentProfileLite, setCurrentProfileLite] = useState<CurrentProfileLite | null>(defaultLite);

  // Propaga evento global para consumidores legados (se existirem)
  const dispatchUserReady = (u: User | null) => {
    if (!u) return;
    try {
      window.dispatchEvent(new CustomEvent('auth:userReady', { detail: u }));
    } catch { /* ignore em SSR */ }
  };

  const bindProfileAfterLogin = async (): Promise<void> => {
    const s = await waitForSession();
    if (!s?.user) { setIdentityError('invalid_session'); return; }

    let res = await callBindRPC();
    if (res.reason === 'rpc_timeout' || res.reason === 'rpc_error') {
      await new Promise((r) => setTimeout(r, 600)); // retry único
      res = await callBindRPC();
    }

    const prof = await fetchActiveProfile(s.user.id);
    setIdentityError(prof ? null : (res.reason ?? 'profile_not_found_after_bind'));
  };

  // Resolve e publica o "profile leve" com id/tenant/nome/preferências
  const resolveAndPublishLite = async (authUserId: string) => {
    // começa “em branco” para nunca renderizar e-mail/placeholder
    setCurrentProfileLite(prev => prev ?? defaultLite);

    const [minimal, lite] = await Promise.all([
      fetchActiveProfile(authUserId),
      fetchProfileLite(authUserId),
    ]);

    if (minimal) {
      setCurrentProfileLite({
        id: minimal.id,
        tenantId: minimal.tenant_id,
        displayName: firstNameOnly(lite?.full_name),
        salutationPref: lite?.salutation_pref ?? 'neutro',
        timezone: lite?.timezone ?? 'America/Sao_Paulo',
      });
    } else if (lite) {
      // Caso raro: encontrou dados leves mas não o minimal (outra query falhou).
      setCurrentProfileLite({
        id: null,
        tenantId: null,
        displayName: firstNameOnly(lite.full_name),
        salutationPref: lite.salutation_pref ?? 'neutro',
        timezone: lite.timezone ?? 'America/Sao_Paulo',
      });
    } else {
      // mantém em branco se não houver profile ativo
      setCurrentProfileLite({
        id: null,
        tenantId: null,
        displayName: '',
        salutationPref: 'neutro',
        timezone: 'America/Sao_Paulo',
      });
    }
  };

  // Boot
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session ?? null);
      setUser(session?.user ?? null);

      if (session?.user) {
        dispatchUserReady(session.user);               // libera consumidores imediatamente
        void resolveAndPublishLite(session.user.id);   // busca leve do profile (assíncrono)
        void bindProfileAfterLogin();                  // bind/validação em paralelo
      } else {
        setCurrentProfileLite(defaultLite);            // estado neutro
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIdentityError(null);
        return;
      }
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        setIdentityError(null);
        setCurrentProfileLite(defaultLite);
        return;
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        dispatchUserReady(session.user);
        // publica imediatamente em branco e preenche quando chegar
        setCurrentProfileLite(defaultLite);
        void resolveAndPublishLite(session.user.id);
        void bindProfileAfterLogin();
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  /* ============================ Ações públicas ============================ */
  const signIn = async (credentials: UserCredentials) => {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (data?.session?.user) {
      dispatchUserReady(data.session.user);
      setCurrentProfileLite(defaultLite);
      void resolveAndPublishLite(data.session.user.id);
      void bindProfileAfterLogin();
    }
    return { session: data.session, error };
  };

  const signUp = async (credentials: UserCredentials) => supabase.auth.signUp(credentials);

  const signOut = async () => {
    setIsPasswordRecovery(false);
    setSession(null);
    setUser(null);
    setIdentityError(null);
    setCurrentProfileLite(defaultLite);
    const { error } = await supabase.auth.signOut();
    return { error: error ?? null };
  };

  const sendPasswordResetEmail = async (email: string) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });

  const updateUserPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) await signOut();
    return { error };
  };

  /* ============================== Value/Render ============================ */
  const value: AuthContextType = {
    session,
    user,
    isPasswordRecovery,
    identityError,
    currentProfileLite,
    signIn,
    signUp,
    signOut,
    sendPasswordResetEmail,
    updateUserPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
