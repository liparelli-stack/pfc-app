import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth, RedirectIfAuth } from '@/components/layout/RequireAuth'
import { Dashboard } from '@/pages/Dashboard'
import { Banks } from '@/pages/Banks'
import { Cards } from '@/pages/Cards'
import { Transactions } from '@/pages/Transactions'
import { Import } from '@/pages/Import'
import { Analysis } from '@/pages/Analysis'
import { Budget } from '@/pages/Budget'
import { Settings } from '@/pages/Settings'
import { Categories } from '@/pages/Categories'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: (
      <RedirectIfAuth>
        <Login />
      </RedirectIfAuth>
    ),
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuth>
        <Register />
      </RedirectIfAuth>
    ),
  },
  {
    path: '/esqueci-senha',
    element: (
      <RedirectIfAuth>
        <ForgotPassword />
      </RedirectIfAuth>
    ),
  },
  // Password reset — must stay public so the Supabase link works before session is set
  {
    path: '/redefinir-senha',
    element: <ResetPassword />,
  },

  // Protected routes
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'bancos', element: <Banks /> },
      { path: 'cartoes', element: <Cards /> },
      { path: 'transacoes', element: <Transactions /> },
      { path: 'importar', element: <Import /> },
      { path: 'analise', element: <Analysis /> },
      { path: 'orcamento', element: <Budget /> },
      { path: 'categorias', element: <Categories /> },
      { path: 'configuracoes', element: <Settings /> },
    ],
  },
])
