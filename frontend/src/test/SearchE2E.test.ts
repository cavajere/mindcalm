import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { SearchScorer } from '../composables/useAdvancedSearch'

// Mock complete user interaction scenarios
describe('Search End-to-End User Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Typical User Search Journey', () => {
    it('should handle complete search workflow from typing to results', async () => {
      // Mock realistic dataset
      const mockData = {
        audio: [
          { id: '1', title: 'Guided Meditation for Sleep', description: 'Relaxing meditation to help you fall asleep', tags: [{ label: 'meditation' }, { label: 'sleep' }] },
          { id: '2', title: 'Morning Breathing Exercise', description: 'Energizing breath work for the morning', tags: [{ label: 'breathing' }, { label: 'energy' }] },
          { id: '3', title: 'Mindful Walking Practice', description: 'Learn to meditate while walking', tags: [{ label: 'mindfulness' }, { label: 'walking' }] }
        ],
        posts: [
          { id: '1', title: 'Benefits of Daily Meditation', excerpt: 'Scientific research on meditation benefits', tags: [{ label: 'meditation' }, { label: 'science' }] },
          { id: '2', title: 'Breathing Techniques Guide', excerpt: 'Comprehensive guide to breathing exercises', tags: [{ label: 'breathing' }, { label: 'guide' }] }
        ],
        events: [
          { id: '1', title: 'Meditation Workshop Milan', excerpt: 'Weekend intensive meditation training', city: 'Milan', venue: 'Zen Center' },
          { id: '2', title: 'Breathing Masterclass Rome', excerpt: 'Advanced breathing techniques workshop', city: 'Rome', venue: 'Wellness Studio' }
        ]
      }

      // Test user searching for "meditation"
      const query = 'meditation'
      
      // Simulate search across all content types
      const audioResults = mockData.audio
        .map(item => ({
          ...item,
          type: 'audio',
          score: SearchScorer.scoreItem(item, query, [
            { key: 'title', weight: 3 },
            { key: 'description', weight: 2 },
            { key: 'tags', weight: 1, isArray: true }
          ])
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      const postResults = mockData.posts
        .map(item => ({
          ...item,
          type: 'post',
          score: SearchScorer.scoreItem(item, query, [
            { key: 'title', weight: 3 },
            { key: 'excerpt', weight: 2 },
            { key: 'tags', weight: 1, isArray: true }
          ])
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      const eventResults = mockData.events
        .map(item => ({
          ...item,
          type: 'event',
          score: SearchScorer.scoreItem(item, query, [
            { key: 'title', weight: 3 },
            { key: 'excerpt', weight: 2 },
            { key: 'city', weight: 1.5 },
            { key: 'venue', weight: 1.5 }
          ])
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      // Verify results quality
      expect(audioResults).toHaveLength(1) // only direct text matches are returned
      expect(postResults).toHaveLength(1)  // "Benefits of Daily Meditation"
      expect(eventResults).toHaveLength(1) // "Meditation Workshop Milan"

      // Verify ranking - exact title matches should rank highest
      expect(audioResults[0].title).toBe('Guided Meditation for Sleep')
      
      expect(postResults[0].title).toBe('Benefits of Daily Meditation')
      expect(eventResults[0].title).toBe('Meditation Workshop Milan')
    })

    it('should handle progressive search refinement', () => {
      const dataset = [
        { id: '1', title: 'Meditation', description: 'Basic meditation', tags: [{ label: 'meditation' }] },
        { id: '2', title: 'Meditation for Beginners', description: 'Beginner friendly meditation', tags: [{ label: 'meditation' }, { label: 'beginner' }] },
        { id: '3', title: 'Advanced Meditation Techniques', description: 'Complex meditation practices', tags: [{ label: 'meditation' }, { label: 'advanced' }] },
        { id: '4', title: 'Meditation for Sleep', description: 'Sleep-focused meditation', tags: [{ label: 'meditation' }, { label: 'sleep' }] }
      ]

      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      // Progressive search: "meditation" -> "meditation for" -> "meditation for beginners"
      const queries = ['meditation', 'meditation for', 'meditation for beginners']
      const results = queries.map(query => 
        dataset
          .map(item => ({ ...item, score: SearchScorer.scoreItem(item, query, fieldConfig) }))
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
      )

      // The current scorer matches any query token, so narrower queries may still keep broad matches.
      expect(results[0]).toHaveLength(4) // "meditation" matches all
      expect(results[1].length).toBeGreaterThanOrEqual(2)
      expect(results[2].length).toBeGreaterThanOrEqual(1)

      // More specific queries should push the most relevant result to the top.
      expect(results[2][0].score).toBeGreaterThan(results[1][0].score)
      expect(results[2][0].id).toBe('2') // "Meditation for Beginners"
    })

    it('should handle typos and partial matches gracefully', () => {
      const dataset = [
        { id: '1', title: 'Meditation Practice', description: 'Daily meditation routine' },
        { id: '2', title: 'Mindfulness Exercise', description: 'Mindful awareness training' }
      ]

      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 }
      ]

      // Test partial matches (user hasn't finished typing)
      const partialQueries = ['med', 'medi', 'medita']
      partialQueries.forEach(query => {
        const results = dataset
          .map(item => ({ ...item, score: SearchScorer.scoreItem(item, query, fieldConfig) }))
          .filter(item => item.score > 0)

        expect(results).toHaveLength(1)
        expect(results[0].id).toBe('1')
      })

      // Test substring matches
      const substringResults = dataset
        .map(item => ({ ...item, score: SearchScorer.scoreItem(item, 'mind', fieldConfig) }))
        .filter(item => item.score > 0)

      expect(substringResults).toHaveLength(1)
      expect(substringResults[0].id).toBe('2')
    })
  })

  describe('Filter Combination Scenarios', () => {
    it('should handle search + tag filters', () => {
      const mockAudio = [
        { 
          id: '1', 
          title: 'Beginner Meditation Guide', 
          description: 'Simple meditation for newcomers',
          tags: [{ id: '1', label: 'meditation' }, { id: '2', label: 'beginner' }],
          category: { id: '1' }
        },
        { 
          id: '2', 
          title: 'Advanced Meditation Practice', 
          description: 'Complex meditation techniques',
          tags: [{ id: '1', label: 'meditation' }, { id: '3', label: 'advanced' }],
          category: { id: '1' }
        },
        { 
          id: '3', 
          title: 'Breathing for Beginners', 
          description: 'Basic breathing exercises',
          tags: [{ id: '4', label: 'breathing' }, { id: '2', label: 'beginner' }],
          category: { id: '2' }
        }
      ]

      const query = 'meditation'
      const selectedTags = ['2'] // beginner tag
      
      // First apply search
      const searchResults = mockAudio.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.label.toLowerCase().includes(query))
      )

      // Then apply tag filter
      const finalResults = searchResults.filter(item =>
        selectedTags.some(tagId =>
          item.tags.some(tag => tag.id === tagId)
        )
      )

      expect(finalResults).toHaveLength(1)
      expect(finalResults[0].id).toBe('1') // Only "Beginner Meditation Guide"
    })

    it('should handle search + category + level filters', () => {
      const mockAudio = [
        { 
          id: '1',
          title: 'Basic Meditation Session',
          description: 'Simple meditation practice',
          category: { id: 'mindfulness' },
          level: 'BEGINNER',
          tags: [{ label: 'meditation' }]
        },
        { 
          id: '2',
          title: 'Intermediate Meditation Flow',
          description: 'Moderate difficulty meditation',
          category: { id: 'mindfulness' },
          level: 'INTERMEDIATE',
          tags: [{ label: 'meditation' }]
        },
        { 
          id: '3',
          title: 'Advanced Meditation Practice',
          description: 'Complex meditation techniques',
          category: { id: 'advanced' },
          level: 'ADVANCED',
          tags: [{ label: 'meditation' }]
        }
      ]

      const query = 'meditation'
      const categoryFilter = 'mindfulness'
      const levelFilter = 'BEGINNER'

      let results = mockAudio

      // Apply search filter
      results = results.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.label.toLowerCase().includes(query))
      )

      // Apply category filter
      results = results.filter(item => item.category.id === categoryFilter)

      // Apply level filter
      results = results.filter(item => item.level === levelFilter)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('1')
      expect(results[0].title).toBe('Basic Meditation Session')
    })
  })

  describe('Performance Scenarios', () => {
    it('should handle rapid typing without performance issues', async () => {
      const mockSearchFunction = vi.fn()
      let isSearching = false
      let searchTimeout: number | null = null
      
      // Simulate rapid typing behavior
      const simulateTyping = (finalQuery: string) => {
        const queries = []
        for (let i = 1; i <= finalQuery.length; i++) {
          queries.push(finalQuery.substring(0, i))
        }

        queries.forEach((query, index) => {
          // Clear previous timeout
          if (searchTimeout) {
            clearTimeout(searchTimeout)
          }

          // Set new timeout
          searchTimeout = window.setTimeout(() => {
            if (!isSearching) {
              isSearching = true
              mockSearchFunction(query)
              isSearching = false
            }
          }, 400) // debounce delay

          // Advance timers for each keystroke
          if (index === queries.length - 1) {
            vi.advanceTimersByTime(400)
          }
        })
      }

      simulateTyping('meditation practice')

      // Should only call search once with the final query
      expect(mockSearchFunction).toHaveBeenCalledTimes(1)
      expect(mockSearchFunction).toHaveBeenCalledWith('meditation practice')
    })

    it('should handle large result sets efficiently', () => {
      // Create a large dataset
      const largeDataset = Array.from({ length: 5000 }, (_, index) => ({
        id: `item-${index}`,
        title: `Title ${index}`,
        description: index % 100 === 0 ? 'meditation content here' : 'other content',
        tags: [{ label: index % 50 === 0 ? 'meditation' : 'other' }]
      }))

      const start = performance.now()
      
      // Simulate search operation
      const results = largeDataset
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, 'meditation', [
            { key: 'title', weight: 3 },
            { key: 'description', weight: 2 },
            { key: 'tags', weight: 1, isArray: true }
          ])
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20) // Pagination limit

      const end = performance.now()
      const duration = end - start

      expect(results.length).toBeLessThanOrEqual(20)
      expect(duration).toBeLessThan(100) // Should complete within 100ms
      expect(results.every(item => item.score > 0)).toBe(true)
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty datasets gracefully', () => {
      const emptyDatasets = {
        audio: [] as Array<Record<string, unknown>>,
        posts: [] as Array<Record<string, unknown>>,
        events: [] as Array<Record<string, unknown>>,
      }

      const query = 'meditation'
      const fieldConfig = [{ key: 'title', weight: 3 }]

      Object.values(emptyDatasets).forEach(dataset => {
        const results = dataset
          .map(item => ({ ...item, score: SearchScorer.scoreItem(item, query, fieldConfig) }))
          .filter(item => item.score > 0)

        expect(results).toHaveLength(0)
      })
    })

    it('should handle malformed data gracefully', () => {
      const malformedData = [
        { id: '1' }, // missing title and description
        { id: '2', title: null, description: undefined },
        { id: '3', title: '', description: '' },
        { id: '4', title: 'Valid Title', description: 'Valid Description', tags: null },
        { id: '5', title: 'Another Valid', description: 'Another Valid', tags: [null, undefined, { label: '' }] }
      ]

      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      // Should not throw errors
      expect(() => {
        const results = malformedData.map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, 'valid', fieldConfig)
        }))
        expect(results).toBeDefined()
      }).not.toThrow()
    })

    it('should handle very long queries', () => {
      const longQuery = 'meditation practice for stress relief and anxiety management with breathing techniques and mindfulness exercises'.repeat(10)
      const dataset = [
        { id: '1', title: 'Meditation Practice', description: 'Stress relief through meditation' },
        { id: '2', title: 'Breathing Techniques', description: 'Anxiety management with breath work' }
      ]

      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 }
      ]

      expect(() => {
        const results = dataset.map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, longQuery, fieldConfig)
        }))
        expect(results).toBeDefined()
      }).not.toThrow()
    })

    it('should handle special characters in search queries', () => {
      const dataset = [
        { id: '1', title: 'Méditation & Relaxation', description: 'Relaxation with special chars' },
        { id: '2', title: 'Breathing (Advanced)', description: 'Advanced breathing [techniques]' },
        { id: '3', title: 'Mind-Body Connection', description: 'Connect mind & body through practice' }
      ]

      const specialQueries = [
        'méditation',
        'breathing (advanced)',
        'mind-body',
        '& relaxation',
        '[techniques]'
      ]

      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 }
      ]

      specialQueries.forEach(query => {
        expect(() => {
          const results = dataset
            .map(item => ({ ...item, score: SearchScorer.scoreItem(item, query, fieldConfig) }))
            .filter(item => item.score > 0)
          
          expect(results).toBeDefined()
        }).not.toThrow()
      })
    })
  })

  describe('Real-World User Behavior Simulation', () => {
    it('should simulate complete user session', async () => {
      // Mock user starting with broad search and refining
      const sessionQueries = [
        'meditation',           // Initial broad search
        'meditation beginner',  // Refinement 1
        'meditation for sleep', // Refinement 2 (specific use case)
        'sleep meditation',     // Alternative phrasing
        'guided sleep'         // Further refinement
      ]

      const mockData = [
        { id: '1', title: 'Guided Meditation for Deep Sleep', description: 'Fall asleep easily with this guided session', tags: [{ label: 'meditation' }, { label: 'sleep' }, { label: 'guided' }] },
        { id: '2', title: 'Beginner Meditation Practice', description: 'Perfect for meditation newcomers', tags: [{ label: 'meditation' }, { label: 'beginner' }] },
        { id: '3', title: 'Advanced Meditation Techniques', description: 'For experienced practitioners', tags: [{ label: 'meditation' }, { label: 'advanced' }] },
        { id: '4', title: 'Sleep Stories for Relaxation', description: 'Calming stories to help you sleep', tags: [{ label: 'sleep' }, { label: 'stories' }] }
      ]

      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      const sessionResults = sessionQueries.map(query => {
        const results = mockData
          .map(item => ({ ...item, score: SearchScorer.scoreItem(item, query, fieldConfig) }))
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)

        return { query, results }
      })

      // Verify progressive refinement keeps surfacing the best candidate.
      expect(sessionResults[0].results).toHaveLength(3) // "meditation" matches 3 items
      expect(sessionResults[1].results.length).toBeGreaterThanOrEqual(1)
      expect(sessionResults[2].results.length).toBeGreaterThanOrEqual(1)
      expect(sessionResults[3].results.length).toBeGreaterThanOrEqual(1)
      expect(sessionResults[4].results.length).toBeGreaterThanOrEqual(1)

      // Final search should return most specific result
      expect(sessionResults[4].results[0].id).toBe('1')
      expect(sessionResults[4].results[0].title).toBe('Guided Meditation for Deep Sleep')
    })
  })
})
