import { QueryClient } from '@tanstack/react-query'
import { afterEach } from 'vitest'

const clients = new Set<QueryClient>()

export function createTestQueryClient(config?: ConstructorParameters<typeof QueryClient>[0]) {
  const client = new QueryClient(config)
  clients.add(client)
  return client
}

afterEach(() => {
  for (const client of clients) {
    client.clear()
  }

  clients.clear()
})
