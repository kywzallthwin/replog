import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { queryClient } from './lib/queryClient'
import { router } from './router'
import { ApiStartupGate } from './components/startup/ApiStartupGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiStartupGate>
        <RouterProvider router={router} />
      </ApiStartupGate>
    </QueryClientProvider>
  </StrictMode>,
)
