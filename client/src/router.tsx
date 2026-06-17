import { createBrowserRouter, Navigate } from 'react-router-dom'
import { GuestOnly } from './components/auth/GuestOnly'
import { RequireAuth } from './components/auth/RequireAuth'
import { DashboardPage } from './pages/DashboardPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { EditProfilePage } from './pages/EditProfilePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
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
  {
    path: '/profile',
    element: (
      <RequireAuth>
        <ProfilePage />
      </RequireAuth>
    ),
  },
  {
    path: '/profile/edit',
    element: (
      <RequireAuth>
        <EditProfilePage />
      </RequireAuth>
    ),
  },
  {
    path: '/profile/password',
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },
])
