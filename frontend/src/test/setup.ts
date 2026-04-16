import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
    params: {},
    path: '/',
    fullPath: '/',
    meta: {}
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  })
}))

// Mock window methods
Object.defineProperty(window, 'setTimeout', {
  value: vi.fn((fn) => fn()),
  writable: true
})

Object.defineProperty(window, 'clearTimeout', {
  value: vi.fn(),
  writable: true
})