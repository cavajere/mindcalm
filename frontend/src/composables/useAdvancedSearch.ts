import { ref, computed, watch, onBeforeUnmount } from 'vue'

export interface SearchOptions {
  debounceMs?: number
  minQueryLength?: number
  onSearch: (query: string) => Promise<void>
  onClear?: () => Promise<void>
}

export function useAdvancedSearch(options: SearchOptions) {
  const {
    debounceMs = 400,
    minQueryLength = 2,
    onSearch,
    onClear
  } = options

  // Search state
  const searchQuery = ref('')
  const isSearching = ref(false)
  const hasSearched = ref(false)
  
  // Internal state
  let searchTimeout: number | null = null
  let currentSearchAbortController: AbortController | null = null

  // Computed properties
  const trimmedQuery = computed(() => searchQuery.value.trim())
  const hasValidQuery = computed(() => trimmedQuery.value.length >= minQueryLength)
  const isQueryEmpty = computed(() => trimmedQuery.value.length === 0)
  // Only show loader after a delay to prevent flash during typing
  const loaderTimeout = ref<number | null>(null)
  const shouldShowLoader = ref(false)
  
  const showSearchLoader = computed(() => shouldShowLoader.value && isSearching.value && hasValidQuery.value)
  
  // Watch isSearching to control loader visibility with delay
  watch(isSearching, (newValue) => {
    if (newValue) {
      // Show loader after 300ms delay
      loaderTimeout.value = window.setTimeout(() => {
        shouldShowLoader.value = true
      }, 300)
    } else {
      // Hide immediately when search completes
      if (loaderTimeout.value) {
        clearTimeout(loaderTimeout.value)
        loaderTimeout.value = null
      }
      shouldShowLoader.value = false
    }
  })

  // Helper to cancel ongoing search
  function cancelOngoingSearch() {
    if (currentSearchAbortController) {
      currentSearchAbortController.abort()
      currentSearchAbortController = null
    }
    if (searchTimeout !== null) {
      clearTimeout(searchTimeout)
      searchTimeout = null
    }
    if (loaderTimeout.value !== null) {
      clearTimeout(loaderTimeout.value)
      loaderTimeout.value = null
    }
  }

  // Execute search with abort capability
  async function executeSearch(query: string) {
    // Cancel any ongoing search
    cancelOngoingSearch()
    
    // Create new abort controller for this search
    currentSearchAbortController = new AbortController()
    
    isSearching.value = true
    
    try {
      await onSearch(query)
      hasSearched.value = true
    } catch (error) {
      // Only log error if it's not an abort error
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Search error:', error)
      }
    } finally {
      isSearching.value = false
      currentSearchAbortController = null
    }
  }

  // Clear search results
  async function clearSearch() {
    cancelOngoingSearch()
    searchQuery.value = ''
    hasSearched.value = false
    
    if (onClear) {
      isSearching.value = true
      try {
        await onClear()
      } finally {
        isSearching.value = false
      }
    }
  }

  // Watch for search query changes with debounce
  watch(searchQuery, (newQuery) => {
    const query = newQuery.trim()
    
    // Cancel any pending search
    cancelOngoingSearch()
    
    // If query is empty, clear results
    if (query.length === 0) {
      if (hasSearched.value && onClear) {
        isSearching.value = true
        onClear().finally(() => {
          isSearching.value = false
          hasSearched.value = false
        })
      }
      return
    }
    
    // If query is too short, don't search
    if (query.length < minQueryLength) {
      return
    }
    
    // Set up debounced search
    searchTimeout = window.setTimeout(() => {
      executeSearch(query)
    }, debounceMs)
  })

  // Cleanup on unmount
  onBeforeUnmount(() => {
    cancelOngoingSearch()
  })

  return {
    // State
    searchQuery,
    isSearching,
    hasSearched,
    
    // Computed
    trimmedQuery,
    hasValidQuery,
    isQueryEmpty,
    showSearchLoader,
    
    // Methods
    clearSearch,
    executeSearch: (query: string) => executeSearch(query)
  }
}

// Search result scoring utilities
export class SearchScorer {
  static scoreText(text: string, query: string): number {
    if (!text || !query) return 0
    
    const normalizedText = text.toLowerCase()
    const normalizedQuery = query.toLowerCase()
    const words = normalizedQuery.split(/\s+/).filter(Boolean)
    
    let score = 0
    
    // Exact match bonus
    if (normalizedText.includes(normalizedQuery)) {
      score += 100
      
      // Start of text bonus
      if (normalizedText.startsWith(normalizedQuery)) {
        score += 50
      }
    }
    
    // Word matching
    for (const word of words) {
      if (normalizedText.includes(word)) {
        score += 20
        
        // Word boundary bonus
        const wordBoundaryRegex = new RegExp(`\\b${word}\\b`)
        if (wordBoundaryRegex.test(normalizedText)) {
          score += 30
        }
        
        // Start of word bonus
        const startWordRegex = new RegExp(`\\b${word}`)
        if (startWordRegex.test(normalizedText)) {
          score += 15
        }
      }
    }
    
    // Proximity bonus for multiple words
    if (words.length > 1) {
      let proximityScore = 0
      for (let i = 0; i < words.length - 1; i++) {
        const word1Index = normalizedText.indexOf(words[i])
        const word2Index = normalizedText.indexOf(words[i + 1])
        
        if (word1Index !== -1 && word2Index !== -1) {
          const distance = Math.abs(word2Index - word1Index - words[i].length)
          proximityScore += Math.max(0, 20 - distance)
        }
      }
      score += proximityScore
    }
    
    return score
  }
  
  static scoreItem<T extends Record<string, any>>(
    item: T, 
    query: string, 
    fields: Array<{
      key: keyof T
      weight?: number
      isArray?: boolean
    }>
  ): number {
    let totalScore = 0
    
    for (const field of fields) {
      const value = item[field.key]
      const weight = field.weight ?? 1
      let fieldScore = 0
      
      if (field.isArray && Array.isArray(value)) {
        // Handle array fields (like tags)
        for (const arrayItem of value) {
          if (arrayItem && typeof arrayItem === 'object') {
            const itemText = arrayItem.label || arrayItem.name || String(arrayItem)
            fieldScore += SearchScorer.scoreText(itemText, query)
          } else if (arrayItem) {
            fieldScore += SearchScorer.scoreText(String(arrayItem), query)
          }
        }
      } else if (value) {
        // Handle string fields
        fieldScore = SearchScorer.scoreText(String(value), query)
      }
      
      totalScore += fieldScore * weight
    }
    
    return totalScore
  }
}