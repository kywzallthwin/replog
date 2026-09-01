import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Unexpected network request in client tests')
  }))

  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {
    throw new Error('Unexpected network request in client tests')
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
