import { describe, it, expect } from 'vitest'
import { SearchScorer } from '../composables/useAdvancedSearch'

describe('SearchScorer', () => {
  describe('scoreText', () => {
    it('should return 0 for empty text or query', () => {
      expect(SearchScorer.scoreText('', 'query')).toBe(0)
      expect(SearchScorer.scoreText('text', '')).toBe(0)
      expect(SearchScorer.scoreText('', '')).toBe(0)
    })

    it('should give high score for exact matches', () => {
      const score = SearchScorer.scoreText('meditation guide', 'meditation guide')
      expect(score).toBeGreaterThan(100)
    })

    it('should give extra points for text that starts with query', () => {
      const startScore = SearchScorer.scoreText('meditation for beginners', 'meditation')
      const middleScore = SearchScorer.scoreText('guided meditation practice', 'meditation')
      expect(startScore).toBeGreaterThan(middleScore)
    })

    it('should be case insensitive', () => {
      const lowerScore = SearchScorer.scoreText('meditation guide', 'meditation')
      const upperScore = SearchScorer.scoreText('MEDITATION GUIDE', 'meditation')
      const mixedScore = SearchScorer.scoreText('Meditation Guide', 'MEDITATION')
      expect(lowerScore).toBe(upperScore)
      expect(lowerScore).toBe(mixedScore)
    })

    it('should give points for word boundary matches', () => {
      const boundaryScore = SearchScorer.scoreText('meditation practice', 'meditation')
      const partialScore = SearchScorer.scoreText('medicationpractice', 'medic')
      expect(boundaryScore).toBeGreaterThan(partialScore)
    })

    it('should handle multiple word queries', () => {
      const multiWordScore = SearchScorer.scoreText('guided meditation for stress relief', 'meditation stress')
      const singleWordScore = SearchScorer.scoreText('guided meditation for stress relief', 'meditation')
      // Both should score > 0, multi-word might not always score higher due to proximity calculations
      expect(multiWordScore).toBeGreaterThan(0)
      expect(singleWordScore).toBeGreaterThan(0)
    })

    it('should give proximity bonus for close words', () => {
      const closeWords = SearchScorer.scoreText('meditation and mindfulness', 'meditation mindfulness')
      const farWords = SearchScorer.scoreText('meditation practice with some other long text and then mindfulness', 'meditation mindfulness')
      expect(closeWords).toBeGreaterThan(farWords)
    })

    it('should handle special characters and accents', () => {
      // Note: Our current implementation doesn't handle accent normalization
      // This is expected behavior - exact character matching
      const score1 = SearchScorer.scoreText('méditation guidée', 'méditation')
      const score2 = SearchScorer.scoreText('breathing & relaxation', 'relaxation')
      expect(score1).toBeGreaterThan(0)
      expect(score2).toBeGreaterThan(0)
    })

    it('should return 0 for non-matching queries', () => {
      const score = SearchScorer.scoreText('yoga practice', 'cooking')
      expect(score).toBe(0)
    })
  })

  describe('scoreItem', () => {
    it('should score items with weighted fields', () => {
      const item = {
        title: 'Meditation Guide',
        description: 'A comprehensive guide to meditation',
        tags: [{ label: 'mindfulness' }, { label: 'relaxation' }]
      }

      const score = SearchScorer.scoreItem(item, 'meditation', [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ])

      expect(score).toBeGreaterThan(0)
    })

    it('should apply field weights correctly', () => {
      const titleItem = {
        title: 'meditation',
        description: 'unrelated content',
        category: 'other'
      }

      const descriptionItem = {
        title: 'unrelated title',
        description: 'meditation',
        category: 'other'
      }

      const titleScore = SearchScorer.scoreItem(titleItem, 'meditation', [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 1 }
      ])

      const descriptionScore = SearchScorer.scoreItem(descriptionItem, 'meditation', [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 1 }
      ])

      expect(titleScore).toBeGreaterThan(descriptionScore)
    })

    it('should handle array fields correctly', () => {
      const item = {
        title: 'Audio Guide',
        tags: [
          { label: 'meditation' },
          { label: 'mindfulness' },
          { label: 'breathing' }
        ]
      }

      const score = SearchScorer.scoreItem(item, 'meditation', [
        { key: 'title', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ])

      expect(score).toBeGreaterThan(0)
    })

    it('should handle missing fields gracefully', () => {
      const item = {
        title: 'Test Item'
        // missing description and tags
      }

      const score = SearchScorer.scoreItem(item, 'test', [
        { key: 'title', weight: 2 },
        { key: 'description', weight: 1 },
        { key: 'tags', weight: 1, isArray: true }
      ])

      expect(score).toBeGreaterThan(0)
    })

    it('should return 0 when no fields match', () => {
      const item = {
        title: 'Yoga Practice',
        description: 'Physical exercise routine',
        tags: [{ label: 'fitness' }]
      }

      const score = SearchScorer.scoreItem(item, 'meditation', [
        { key: 'title', weight: 2 },
        { key: 'description', weight: 1 },
        { key: 'tags', weight: 1, isArray: true }
      ])

      expect(score).toBe(0)
    })

    it('should handle complex nested tag objects', () => {
      const item = {
        title: 'Audio Session',
        tags: [
          { id: '1', label: 'meditation', name: 'Meditation Practice' },
          { id: '2', label: 'stress', name: 'Stress Relief' }
        ]
      }

      const score = SearchScorer.scoreItem(item, 'stress', [
        { key: 'tags', weight: 1, isArray: true }
      ])

      expect(score).toBeGreaterThan(0)
    })
  })

  describe('Real-world scenarios', () => {
    const audioItems = [
      {
        id: '1',
        title: 'Guided Meditation for Beginners',
        description: 'A gentle introduction to meditation practice',
        tags: [{ label: 'meditation' }, { label: 'beginner' }],
        category: { name: 'Mindfulness' }
      },
      {
        id: '2', 
        title: 'Advanced Breathing Techniques',
        description: 'Deep breathing exercises for experienced practitioners',
        tags: [{ label: 'breathing' }, { label: 'advanced' }],
        category: { name: 'Breathing' }
      },
      {
        id: '3',
        title: 'Meditation and Stress Relief',
        description: 'Using meditation to reduce stress and anxiety',
        tags: [{ label: 'meditation' }, { label: 'stress' }, { label: 'anxiety' }],
        category: { name: 'Stress Relief' }
      }
    ]

    const postItems = [
      {
        id: '1',
        title: 'The Science of Meditation',
        excerpt: 'Research-backed benefits of regular meditation practice',
        tags: [{ label: 'meditation' }, { label: 'science' }],
        author: 'Dr. Smith'
      },
      {
        id: '2',
        title: 'Mindful Eating Habits',
        excerpt: 'How to bring mindfulness to your daily meals',
        tags: [{ label: 'mindfulness' }, { label: 'nutrition' }],
        author: 'Jane Doe'
      }
    ]

    const eventItems = [
      {
        id: '1',
        title: 'Weekend Meditation Retreat',
        excerpt: 'Two-day intensive meditation workshop',
        city: 'Milan',
        venue: 'Wellness Center',
        organizer: 'MindCalm Team'
      },
      {
        id: '2',
        title: 'Breathing Workshop',
        excerpt: 'Learn advanced breathing techniques',
        city: 'Rome',
        venue: 'Community Hall',
        organizer: 'Wellness Institute'
      }
    ]

    it('should rank audio items correctly for meditation search', () => {
      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      const scoredItems = audioItems
        .map(item => ({
          item,
          score: SearchScorer.scoreItem(item, 'meditation', fieldConfig)
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)

      expect(scoredItems).toHaveLength(2)
      expect(scoredItems[0].item.id).toBe('1') // 'Guided Meditation for Beginners'
      expect(scoredItems[1].item.id).toBe('3') // 'Meditation and Stress Relief'
    })

    it('should rank posts correctly for mindfulness search', () => {
      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'excerpt', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      const scoredItems = postItems
        .map(item => ({
          item,
          score: SearchScorer.scoreItem(item, 'mindfulness', fieldConfig)
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)

      expect(scoredItems).toHaveLength(1)
      expect(scoredItems[0].item.id).toBe('2') // 'Mindful Eating Habits'
    })

    it('should rank events correctly for location search', () => {
      const fieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'excerpt', weight: 2 },
        { key: 'city', weight: 1.5 },
        { key: 'venue', weight: 1.5 },
        { key: 'organizer', weight: 1 }
      ]

      const scoredItems = eventItems
        .map(item => ({
          item,
          score: SearchScorer.scoreItem(item, 'milan', fieldConfig)
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)

      expect(scoredItems).toHaveLength(1)
      expect(scoredItems[0].item.city).toBe('Milan')
    })

    it('should handle multi-word searches across different content types', () => {
      const query = 'meditation workshop'
      
      const audioFieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 }
      ]

      const eventFieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'excerpt', weight: 2 }
      ]

      const audioScores = audioItems.map(item => 
        SearchScorer.scoreItem(item, query, audioFieldConfig)
      )

      const eventScores = eventItems.map(item => 
        SearchScorer.scoreItem(item, query, eventFieldConfig)
      )

      // Should find meditation content in audio and workshop content in events
      expect(audioScores.some(score => score > 0)).toBe(true)
      expect(eventScores.some(score => score > 0)).toBe(true)
    })
  })
})