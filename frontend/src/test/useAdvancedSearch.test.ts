import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'

// Test component that uses the composable
const TestComponent = {
  template: '<div></div>',
  setup() {
    const mockSearch = vi.fn()
    const mockClear = vi.fn()
    
    const searchHook = useAdvancedSearch({
      debounceMs: 100,
      minQueryLength: 2,
      onSearch: mockSearch,
      onClear: mockClear
    })
    
    return {
      ...searchHook,
      mockSearch,
      mockClear
    }
  }
}

describe('useAdvancedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with correct default values', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    expect(vm.searchQuery).toBe('')
    expect(vm.isSearching).toBe(false)
    expect(vm.hasSearched).toBe(false)
    expect(vm.hasValidQuery).toBe(false)
    expect(vm.isQueryEmpty).toBe(true)
    expect(vm.showSearchLoader).toBe(false)
  })

  it('should update computed properties when search query changes', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    vm.searchQuery = 'test'
    await nextTick()

    expect(vm.trimmedQuery).toBe('test')
    expect(vm.hasValidQuery).toBe(true)
    expect(vm.isQueryEmpty).toBe(false)
  })

  it('should respect minimum query length', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Query too short
    vm.searchQuery = 'a'
    await nextTick()
    expect(vm.hasValidQuery).toBe(false)

    // Query meets minimum length
    vm.searchQuery = 'ab'
    await nextTick()
    expect(vm.hasValidQuery).toBe(true)
  })

  it('should debounce search calls', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    vm.searchQuery = 'test query'
    await nextTick()

    // Should not call search immediately
    expect(vm.mockSearch).not.toHaveBeenCalled()

    // Advance timers past debounce delay
    vi.advanceTimersByTime(100)
    await nextTick()

    expect(vm.mockSearch).toHaveBeenCalledWith('test query')
    expect(vm.mockSearch).toHaveBeenCalledTimes(1)
  })

  it('should cancel previous search when query changes rapidly', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Type rapidly
    vm.searchQuery = 'test'
    await nextTick()
    
    vm.searchQuery = 'test query'
    await nextTick()
    
    vm.searchQuery = 'test query final'
    await nextTick()

    // Advance timers
    vi.advanceTimersByTime(100)
    await nextTick()

    // Should only call search once with final query
    expect(vm.mockSearch).toHaveBeenCalledWith('test query final')
    expect(vm.mockSearch).toHaveBeenCalledTimes(1)
  })

  it('should call onClear when query is cleared', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // First set a search query and trigger search
    vm.searchQuery = 'test'
    vi.advanceTimersByTime(100)
    await nextTick()
    
    vm.hasSearched = true // Simulate that search has been performed

    // Clear the query
    vm.searchQuery = ''
    await nextTick()

    expect(vm.mockClear).toHaveBeenCalled()
  })

  it('should not call onClear if no search was performed', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Clear empty query (no search was performed)
    vm.searchQuery = ''
    await nextTick()

    expect(vm.mockClear).not.toHaveBeenCalled()
  })

  it('should handle search loading state correctly', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Mock search function that takes time
    vm.mockSearch.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(resolve, 50)
      })
    })

    vm.searchQuery = 'test'
    vi.advanceTimersByTime(100)
    await nextTick()

    expect(vm.isSearching).toBe(true)

    // Complete the search
    vi.advanceTimersByTime(50)
    await nextTick()

    expect(vm.isSearching).toBe(false)
    expect(vm.hasSearched).toBe(true)
  })

  it('should show loader only after delay', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Mock search function
    vm.mockSearch.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(resolve, 500) // Search takes 500ms
      })
    })

    vm.searchQuery = 'test'
    vi.advanceTimersByTime(100) // Trigger search
    await nextTick()

    expect(vm.isSearching).toBe(true)
    expect(vm.showSearchLoader).toBe(false) // Should not show immediately

    // Advance past loader delay (300ms)
    vi.advanceTimersByTime(300)
    await nextTick()

    expect(vm.showSearchLoader).toBe(true) // Now should show

    // Complete search
    vi.advanceTimersByTime(200)
    await nextTick()

    expect(vm.showSearchLoader).toBe(false) // Should hide immediately
  })

  it('should not show loader for fast searches', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Mock fast search function
    vm.mockSearch.mockImplementation(() => {
      return Promise.resolve()
    })

    vm.searchQuery = 'test'
    vi.advanceTimersByTime(100) // Trigger search
    await nextTick()

    // Search completes immediately
    expect(vm.isSearching).toBe(false)
    expect(vm.showSearchLoader).toBe(false)

    // Even after loader delay, should not show
    vi.advanceTimersByTime(300)
    await nextTick()

    expect(vm.showSearchLoader).toBe(false)
  })

  it('should handle search errors gracefully', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock search function that throws
    vm.mockSearch.mockRejectedValue(new Error('Search failed'))

    vm.searchQuery = 'test'
    vi.advanceTimersByTime(100)
    await nextTick()

    expect(vm.isSearching).toBe(false)
    expect(consoleError).toHaveBeenCalledWith('Search error:', expect.any(Error))

    consoleError.mockRestore()
  })

  it('should handle AbortError gracefully without logging', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock search function that throws AbortError
    const abortError = new Error('Operation aborted')
    abortError.name = 'AbortError'
    vm.mockSearch.mockRejectedValue(abortError)

    vm.searchQuery = 'test'
    vi.advanceTimersByTime(100)
    await nextTick()

    expect(vm.isSearching).toBe(false)
    expect(consoleError).not.toHaveBeenCalled() // Should not log AbortError

    consoleError.mockRestore()
  })

  it('should cleanup timers on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    vm.searchQuery = 'test'
    
    // Unmount component
    wrapper.unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('should handle custom debounce timing', async () => {
    const CustomTestComponent = {
      template: '<div></div>',
      setup() {
        const mockSearch = vi.fn()
        
        return {
          ...useAdvancedSearch({
            debounceMs: 300,
            minQueryLength: 3,
            onSearch: mockSearch
          }),
          mockSearch
        }
      }
    }

    const wrapper = mount(CustomTestComponent)
    const vm = wrapper.vm as any

    vm.searchQuery = 'test'
    await nextTick()

    // Should respect custom minQueryLength
    expect(vm.hasValidQuery).toBe(false)

    vm.searchQuery = 'test query'
    await nextTick()
    expect(vm.hasValidQuery).toBe(true)

    // Should respect custom debounce timing
    vi.advanceTimersByTime(200)
    expect(vm.mockSearch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    await nextTick()
    expect(vm.mockSearch).toHaveBeenCalled()
  })

  it('should handle trimmed queries correctly', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Query with leading/trailing spaces
    vm.searchQuery = '  test query  '
    vi.advanceTimersByTime(100)
    await nextTick()

    expect(vm.mockSearch).toHaveBeenCalledWith('test query')
  })

  it('should handle executeSearch method', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    await vm.executeSearch('manual search')
    
    expect(vm.mockSearch).toHaveBeenCalledWith('manual search')
    expect(vm.hasSearched).toBe(true)
  })

  it('should handle clearSearch method', async () => {
    const wrapper = mount(TestComponent)
    const vm = wrapper.vm as any

    // Set up initial state
    vm.searchQuery = 'test'
    vm.hasSearched = true

    await vm.clearSearch()

    expect(vm.searchQuery).toBe('')
    expect(vm.hasSearched).toBe(false)
    expect(vm.mockClear).toHaveBeenCalled()
  })
})

describe('useAdvancedSearch integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should handle realistic search flow', async () => {
    const searchResults = ref([])
    const mockSearch = vi.fn(async (query: string) => {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 200))
      searchResults.value = [{ id: 1, title: `Result for ${query}` }]
    })

    const TestApp = {
      template: '<div></div>',
      setup() {
        return {
          ...useAdvancedSearch({
            debounceMs: 150,
            minQueryLength: 2,
            onSearch: mockSearch
          }),
          searchResults,
          mockSearch
        }
      }
    }

    const wrapper = mount(TestApp)
    const vm = wrapper.vm as any

    // User types gradually
    vm.searchQuery = 'm'
    await nextTick()
    expect(vm.hasValidQuery).toBe(false)

    vm.searchQuery = 'me'
    await nextTick()
    expect(vm.hasValidQuery).toBe(true)
    expect(vm.isSearching).toBe(false) // Not started yet

    vm.searchQuery = 'med'
    await nextTick()
    
    vm.searchQuery = 'meditation'
    await nextTick()

    // Advance past debounce
    vi.advanceTimersByTime(150)
    await nextTick()

    expect(vm.isSearching).toBe(true)
    expect(vm.mockSearch).toHaveBeenCalledWith('meditation')

    // Wait for search to complete
    vi.advanceTimersByTime(200)
    await nextTick()

    expect(vm.isSearching).toBe(false)
    expect(vm.hasSearched).toBe(true)
    expect(searchResults.value).toEqual([{ id: 1, title: 'Result for meditation' }])
  })
})