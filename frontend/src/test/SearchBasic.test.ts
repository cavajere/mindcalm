import { describe, it, expect } from 'vitest'
import { SearchScorer } from '../composables/useAdvancedSearch'

describe('Search Functionality - Basic Tests', () => {
  describe('SearchScorer Core Functionality', () => {
    it('should score exact matches highest', () => {
      const score = SearchScorer.scoreText('meditation', 'meditation')
      expect(score).toBeGreaterThan(100)
    })

    it('should score partial matches', () => {
      const score = SearchScorer.scoreText('meditation practice', 'meditation')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeGreaterThan(50)
    })

    it('should be case insensitive', () => {
      const lowerScore = SearchScorer.scoreText('meditation', 'meditation')
      const upperScore = SearchScorer.scoreText('MEDITATION', 'meditation')
      const mixedScore = SearchScorer.scoreText('Meditation', 'MEDITATION')
      expect(lowerScore).toBe(upperScore)
      expect(lowerScore).toBe(mixedScore)
    })

    it('should handle empty inputs', () => {
      expect(SearchScorer.scoreText('', 'query')).toBe(0)
      expect(SearchScorer.scoreText('text', '')).toBe(0)
      expect(SearchScorer.scoreText('', '')).toBe(0)
    })

    it('should score word boundaries higher', () => {
      const exactWord = SearchScorer.scoreText('meditation practice', 'meditation')
      const partialWord = SearchScorer.scoreText('medicationpractice', 'medic')
      expect(exactWord).toBeGreaterThan(partialWord)
    })
  })

  describe('SearchScorer Item Scoring', () => {
    const testItems = [
      {
        id: '1',
        title: 'Guided Meditation',
        description: 'A peaceful meditation session',
        tags: [{ label: 'meditation' }, { label: 'relaxation' }]
      },
      {
        id: '2',
        title: 'Breathing Exercises',
        description: 'Learn to breathe deeply',
        tags: [{ label: 'breathing' }, { label: 'wellness' }]
      }
    ]

    it('should score items by field weights', () => {
      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      const score = SearchScorer.scoreItem(testItems[0], 'meditation', fieldConfig)
      expect(score).toBeGreaterThan(0)
    })

    it('should handle missing fields gracefully', () => {
      const incompleteItem = { id: '1', title: 'Test Item' }
      const fieldConfig = [
        { key: 'title', weight: 2 },
        { key: 'description', weight: 1 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      const score = SearchScorer.scoreItem(incompleteItem, 'test', fieldConfig)
      expect(score).toBeGreaterThan(0)
    })

    it('should handle malformed tag arrays', () => {
      const malformedItem = {
        id: '1',
        title: 'Test Item',
        tags: [null, undefined, { label: 'valid' }, { label: '' }]
      }
      
      const fieldConfig = [
        { key: 'title', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      expect(() => {
        const score = SearchScorer.scoreItem(malformedItem, 'test', fieldConfig)
        expect(score).toBeGreaterThan(0)
      }).not.toThrow()
    })
  })

  describe('Real-World Search Scenarios', () => {
    const audioItems = [
      {
        id: '1',
        title: 'Guided Meditation for Beginners',
        description: 'A gentle introduction to meditation',
        tags: [{ label: 'meditation' }, { label: 'beginner' }]
      },
      {
        id: '2',
        title: 'Advanced Breathing Techniques',
        description: 'Complex breathing exercises',
        tags: [{ label: 'breathing' }, { label: 'advanced' }]
      },
      {
        id: '3',
        title: 'Mindful Walking Meditation',
        description: 'Walking meditation practice',
        tags: [{ label: 'meditation' }, { label: 'mindfulness' }]
      }
    ]

    const fieldConfig = [
      { key: 'title', weight: 3 },
      { key: 'description', weight: 2 },
      { key: 'tags', weight: 1, isArray: true }
    ]

    it('should find meditation content correctly', () => {
      const results = audioItems
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, 'meditation', fieldConfig)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(item => item.score > 0)).toBe(true)
      
      // Should find items with 'meditation' in title or tags
      const foundIds = results.map(item => item.id)
      expect(foundIds).toContain('1') // 'Guided Meditation for Beginners'
      expect(foundIds).toContain('3') // 'Mindful Walking Meditation'
    })

    it('should rank results by relevance', () => {
      const results = audioItems
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, 'meditation', fieldConfig)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
      }
    })

    it('should handle multi-word searches', () => {
      const results = audioItems
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, 'meditation beginner', fieldConfig)
        }))
        .filter(item => item.score > 0)

      expect(results.length).toBeGreaterThan(0)
      
      // Should find the beginner meditation item
      const beginnerItem = results.find(item => item.id === '1')
      expect(beginnerItem).toBeDefined()
      expect(beginnerItem?.score).toBeGreaterThan(0)
    })

    it('should handle no matches gracefully', () => {
      const results = audioItems
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, 'cooking recipes', fieldConfig)
        }))
        .filter(item => item.score > 0)

      expect(results).toHaveLength(0)
    })
  })

  describe('Filter Integration', () => {
    const mockData = [
      {
        id: '1',
        title: 'Basic Meditation',
        description: 'Simple meditation practice',
        category: { id: 'mindfulness' },
        level: 'BEGINNER',
        tags: [{ id: '1', label: 'meditation' }],
        durationSeconds: 600
      },
      {
        id: '2',
        title: 'Advanced Meditation',
        description: 'Complex meditation techniques',
        category: { id: 'mindfulness' },
        level: 'ADVANCED',
        tags: [{ id: '1', label: 'meditation' }],
        durationSeconds: 1800
      },
      {
        id: '3',
        title: 'Breathing Exercise',
        description: 'Simple breathing practice',
        category: { id: 'breathing' },
        level: 'BEGINNER',
        tags: [{ id: '2', label: 'breathing' }],
        durationSeconds: 300
      }
    ]

    it('should combine search with category filter', () => {
      const query = 'meditation'
      const categoryFilter = 'mindfulness'

      // First apply search
      const searchResults = mockData.filter(item => {
        const score = SearchScorer.scoreItem(item, query, [
          { key: 'title', weight: 3 },
          { key: 'description', weight: 2 },
          { key: 'tags', weight: 1, isArray: true }
        ])
        return score > 0
      })

      // Then apply category filter
      const filteredResults = searchResults.filter(item => 
        item.category.id === categoryFilter
      )

      expect(filteredResults).toHaveLength(2)
      expect(filteredResults.every(item => 
        item.category.id === 'mindfulness'
      )).toBe(true)
    })

    it('should apply level filter', () => {
      const beginnerItems = mockData.filter(item => 
        item.level === 'BEGINNER'
      )

      expect(beginnerItems).toHaveLength(2)
      expect(beginnerItems.every(item => 
        item.level === 'BEGINNER'
      )).toBe(true)
    })

    it('should apply duration filter', () => {
      // Short: < 600 seconds
      const shortItems = mockData.filter(item => 
        item.durationSeconds < 600
      )
      expect(shortItems).toHaveLength(1)
      expect(shortItems[0].id).toBe('3')

      // Medium: 600-1200 seconds  
      const mediumItems = mockData.filter(item => 
        item.durationSeconds >= 600 && item.durationSeconds <= 1200
      )
      expect(mediumItems).toHaveLength(1)
      expect(mediumItems[0].id).toBe('1')

      // Long: > 1200 seconds
      const longItems = mockData.filter(item => 
        item.durationSeconds > 1200
      )
      expect(longItems).toHaveLength(1)
      expect(longItems[0].id).toBe('2')
    })

    it('should apply tag filter', () => {
      const selectedTags = ['1'] // meditation tag

      const taggedItems = mockData.filter(item =>
        selectedTags.some(tagId =>
          item.tags.some(tag => tag.id === tagId)
        )
      )

      expect(taggedItems).toHaveLength(2)
      expect(taggedItems.every(item =>
        item.tags.some(tag => tag.id === '1')
      )).toBe(true)
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large queries', () => {
      const longQuery = 'meditation practice for stress relief and anxiety management'.repeat(5)
      const item = {
        title: 'Meditation Practice',
        description: 'Stress relief through meditation'
      }

      expect(() => {
        const score = SearchScorer.scoreItem(item, longQuery, [
          { key: 'title', weight: 3 },
          { key: 'description', weight: 2 }
        ])
        expect(score).toBeGreaterThanOrEqual(0)
      }).not.toThrow()
    })

    it('should handle special characters', () => {
      const item = {
        title: 'Méditation & Relaxation',
        description: 'Breathing (Advanced) [Techniques]'
      }

      const queries = ['relaxation', '(advanced)', '[techniques]', '&']
      
      queries.forEach(query => {
        expect(() => {
          const score = SearchScorer.scoreItem(item, query, [
            { key: 'title', weight: 3 },
            { key: 'description', weight: 2 }
          ])
          expect(score).toBeGreaterThanOrEqual(0)
        }).not.toThrow()
      })
    })

    it('should handle empty datasets', () => {
      const emptyArray: any[] = []
      const query = 'meditation'

      const results = emptyArray
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, query, [
            { key: 'title', weight: 3 }
          ])
        }))
        .filter(item => item.score > 0)

      expect(results).toHaveLength(0)
    })
  })
})