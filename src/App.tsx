import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserRoleProvider } from '@/contexts/UserRoleContext'
import { SimulationProvider } from '@/contexts/SimulationContext'
import { router } from '@/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserRoleProvider>
        <SimulationProvider>
          <RouterProvider router={router} />
        </SimulationProvider>
      </UserRoleProvider>
    </QueryClientProvider>
  )
}
