import { createBrowserRouter, Navigate } from 'react-router-dom'
import { GuestOnly } from './components/auth/GuestOnly'
import { RequireAuth } from './components/auth/RequireAuth'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestOnly>
        <RegisterPage />
      </GuestOnly>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    ),
  },
])
