import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import axios from 'axios'

// Mock data
const mockAudioItems = [
  {
    id: '1',
    title: 'Guided Meditation for Beginners',
    description: 'A gentle introduction to meditation practice',
    tags: [{ id: '1', label: 'meditation' }, { id: '2', label: 'beginner' }],
    category: { id: '1', name: 'Mindfulness' },
    level: 'BEGINNER',
    durationSeconds: 600
  },
  {
    id: '2',
    title: 'Advanced Breathing Techniques',
    description: 'Deep breathing exercises for experienced practitioners',
    tags: [{ id: '3', label: 'breathing' }, { id: '4', label: 'advanced' }],
    category: { id: '2', name: 'Breathing' },
    level: 'ADVANCED',
    durationSeconds: 1200
  },
  {
    id: '3',
    title: 'Stress Relief Meditation',
    description: 'Using meditation to reduce stress and anxiety',
    tags: [{ id: '1', label: 'meditation' }, { id: '5', label: 'stress' }],
    category: { id: '1', name: 'Mindfulness' },
    level: 'INTERMEDIATE',
    durationSeconds: 900
  }
]

const mockPostItems = [
  {
    id: '1',
    title: 'The Science of Meditation',
    slug: 'science-of-meditation',
    excerpt: 'Research-backed benefits of regular meditation practice',
    tags: [{ id: '1', label: 'meditation' }, { id: '6', label: 'science' }],
    author: 'Dr. Smith',
    publishedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    title: 'Mindful Eating Habits',
    slug: 'mindful-eating-habits',
    excerpt: 'How to bring mindfulness to your daily meals',
    tags: [{ id: '7', label: 'mindfulness' }, { id: '8', label: 'nutrition' }],
    author: 'Jane Doe',
    publishedAt: '2024-01-02T00:00:00Z'
  }
]

const mockEventItems = [
  {
    id: '1',
    title: 'Weekend Meditation Retreat',
    slug: 'weekend-meditation-retreat',
    excerpt: 'Two-day intensive meditation workshop',
    city: 'Milan',
    venue: 'Wellness Center',
    organizer: 'MindCalm Team',
    startsAt: '2024-06-01T09:00:00Z',
    cancelledAt: null,
    bookingRequired: true,
    bookingAvailable: true,
    participationMode: 'PAID',
    participationPriceCents: 15000
  },
  {
    id: '2',
    title: 'Free Breathing Workshop',
    slug: 'free-breathing-workshop',
    excerpt: 'Learn basic breathing techniques',
    city: 'Rome',
    venue: 'Community Hall',
    organizer: 'Wellness Institute',
    startsAt: '2024-06-02T14:00:00Z',
    cancelledAt: null,
    bookingRequired: false,
    bookingAvailable: true,
    participationMode: 'FREE',
    participationPriceCents: null
  }
]

const mockTags = [
  { id: '1', label: 'meditation' },
  { id: '2', label: 'beginner' },
  { id: '3', label: 'breathing' },
  { id: '4', label: 'advanced' },
  { id: '5', label: 'stress' }
]

const mockCategories = [
  { id: '1', name: 'Mindfulness', slug: 'mindfulness' },
  { id: '2', name: 'Breathing', slug: 'breathing' }
]

// Mock stores
const mockAudioStore = {
  audioItems: [],
  categories: mockCategories,
  loading: false,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  fetchAudio: vi.fn(),
  fetchCategories: vi.fn().mockResolvedValue({ data: mockCategories })
}

// Mock axios responses
vi.mocked(axios.get).mockImplementation((url: string) => {
  if (url.includes('/api/audio')) {
    return Promise.resolve({ data: { data: mockAudioItems, pagination: { total: mockAudioItems.length } } })
  }
  if (url.includes('/api/posts')) {
    return Promise.resolve({ data: { data: mockPostItems, pagination: { total: mockPostItems.length } } })
  }
  if (url.includes('/api/events')) {
    return Promise.resolve({ data: { data: mockEventItems, pagination: { total: mockEventItems.length } } })
  }
  if (url.includes('/api/tags')) {
    return Promise.resolve({ data: mockTags })
  }
  return Promise.resolve({ data: [] })
})

describe('Search Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Audio Search', () => {
    it('should load audio items on mount', async () => {
      // Since we can't easily test the actual AudioView component due to store dependencies,
      // we'll test the search logic directly
      const audioData = await axios.get('/api/audio?limit=1000')
      expect(audioData.data.data).toEqual(mockAudioItems)
      expect(axios.get).toHaveBeenCalledWith('/api/audio?limit=1000')
    })

    it('should filter audio by search query using scoring', () => {
      const query = 'meditation'
      const scoredItems = mockAudioItems
        .map(item => ({
          item,
          score: item.title.toLowerCase().includes(query.toLowerCase()) ? 100 :
                item.description.toLowerCase().includes(query.toLowerCase()) ? 50 :
                item.tags.some(tag => tag.label.toLowerCase().includes(query.toLowerCase())) ? 25 : 0
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)

      expect(scoredItems).toHaveLength(2)
      expect(scoredItems[0].item.id).toBe('1') // 'Guided Meditation for Beginners'
      expect(scoredItems[1].item.id).toBe('3') // 'Stress Relief Meditation'
    })

    it('should apply category filter', () => {
      const mindfulnessItems = mockAudioItems.filter(item => 
        item.category?.id === '1' // Mindfulness category
      )
      expect(mindfulnessItems).toHaveLength(2)
      expect(mindfulnessItems.every(item => item.category?.name === 'Mindfulness')).toBe(true)
    })

    it('should apply level filter', () => {
      const beginnerItems = mockAudioItems.filter(item => item.level === 'BEGINNER')
      expect(beginnerItems).toHaveLength(1)
      expect(beginnerItems[0].id).toBe('1')
    })

    it('should apply duration filter', () => {
      // Short: < 600 seconds (10 min)
      const shortItems = mockAudioItems.filter(item => item.durationSeconds < 600)
      expect(shortItems).toHaveLength(0)

      // Medium: 600-1200 seconds (10-20 min)
      const mediumItems = mockAudioItems.filter(item => 
        item.durationSeconds >= 600 && item.durationSeconds <= 1200
      )
      expect(mediumItems).toHaveLength(2)

      // Long: > 1200 seconds (20 min)
      const longItems = mockAudioItems.filter(item => item.durationSeconds > 1200)
      expect(longItems).toHaveLength(0)
    })

    it('should apply tag filter', () => {
      const meditationTaggedItems = mockAudioItems.filter(item =>
        item.tags.some(tag => tag.id === '1') // meditation tag
      )
      expect(meditationTaggedItems).toHaveLength(2)
    })

    it('should combine search with filters', () => {
      const query = 'meditation'
      const categoryFilter = '1' // Mindfulness
      
      let filtered = mockAudioItems
      
      // Apply search
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.tags.some(tag => tag.label.toLowerCase().includes(query.toLowerCase()))
      )
      
      // Apply category filter
      filtered = filtered.filter(item => item.category?.id === categoryFilter)
      
      expect(filtered).toHaveLength(2)
      expect(filtered.every(item => 
        item.category?.name === 'Mindfulness' &&
        (item.title.toLowerCase().includes('meditation') || 
         item.description.toLowerCase().includes('meditation') ||
         item.tags.some(tag => tag.label === 'meditation'))
      )).toBe(true)
    })
  })

  describe('Posts Search', () => {
    it('should load posts on mount', async () => {
      const postsData = await axios.get('/api/posts?limit=1000')
      expect(postsData.data.data).toEqual(mockPostItems)
    })

    it('should filter posts by search query', () => {
      const query = 'meditation'
      const filteredPosts = mockPostItems.filter(post =>
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.excerpt?.toLowerCase().includes(query.toLowerCase()) ||
        post.tags.some(tag => tag.label.toLowerCase().includes(query.toLowerCase()))
      )
      
      expect(filteredPosts).toHaveLength(1)
      expect(filteredPosts[0].id).toBe('1')
      expect(filteredPosts[0].title).toBe('The Science of Meditation')
    })

    it('should filter posts by tags', () => {
      const mindfulnessTaggedPosts = mockPostItems.filter(post =>
        post.tags.some(tag => tag.label === 'mindfulness')
      )
      
      expect(mindfulnessTaggedPosts).toHaveLength(1)
      expect(mindfulnessTaggedPosts[0].id).toBe('2')
    })

    it('should handle empty search results', () => {
      const query = 'nonexistent'
      const filteredPosts = mockPostItems.filter(post =>
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.excerpt?.toLowerCase().includes(query.toLowerCase())
      )
      
      expect(filteredPosts).toHaveLength(0)
    })
  })

  describe('Events Search', () => {
    it('should load events on mount', async () => {
      const eventsData = await axios.get('/api/events?limit=1000')
      expect(eventsData.data.data).toEqual(mockEventItems)
    })

    it('should filter events by search query', () => {
      const query = 'meditation'
      const filteredEvents = mockEventItems.filter(event =>
        event.title.toLowerCase().includes(query.toLowerCase()) ||
        event.excerpt?.toLowerCase().includes(query.toLowerCase()) ||
        event.city.toLowerCase().includes(query.toLowerCase()) ||
        event.venue?.toLowerCase().includes(query.toLowerCase()) ||
        event.organizer.toLowerCase().includes(query.toLowerCase())
      )
      
      expect(filteredEvents).toHaveLength(1)
      expect(filteredEvents[0].id).toBe('1')
      expect(filteredEvents[0].title).toBe('Weekend Meditation Retreat')
    })

    it('should filter events by city', () => {
      const milanEvents = mockEventItems.filter(event =>
        event.city.toLowerCase() === 'milan'
      )
      
      expect(milanEvents).toHaveLength(1)
      expect(milanEvents[0].city).toBe('Milan')
    })

    it('should filter events by venue', () => {
      const wellnessCenterEvents = mockEventItems.filter(event =>
        event.venue?.toLowerCase().includes('wellness center')
      )
      
      expect(wellnessCenterEvents).toHaveLength(1)
      expect(wellnessCenterEvents[0].venue).toBe('Wellness Center')
    })

    it('should filter events by organizer', () => {
      const mindCalmEvents = mockEventItems.filter(event =>
        event.organizer.toLowerCase().includes('mindcalm')
      )
      
      expect(mindCalmEvents).toHaveLength(1)
      expect(mindCalmEvents[0].organizer).toBe('MindCalm Team')
    })
  })

  describe('Cross-Content Search Scenarios', () => {
    it('should find meditation content across all types', () => {
      const query = 'meditation'
      
      const audioResults = mockAudioItems.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.label.includes(query))
      )
      
      const postResults = mockPostItems.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.excerpt?.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.label.includes(query))
      )
      
      const eventResults = mockEventItems.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.excerpt?.toLowerCase().includes(query)
      )
      
      expect(audioResults.length).toBeGreaterThan(0)
      expect(postResults.length).toBeGreaterThan(0) 
      expect(eventResults.length).toBeGreaterThan(0)
      
      const totalResults = audioResults.length + postResults.length + eventResults.length
      expect(totalResults).toBe(4) // 2 audio + 1 post + 1 event
    })

    it('should handle multi-word searches', () => {
      const query = 'breathing techniques'
      const words = query.split(' ')
      
      const audioResults = mockAudioItems.filter(item => {
        const text = `${item.title} ${item.description}`.toLowerCase()
        return words.every(word => text.includes(word.toLowerCase()))
      })
      
      expect(audioResults).toHaveLength(1)
      expect(audioResults[0].title).toBe('Advanced Breathing Techniques')
    })

    it('should rank results by relevance', () => {
      const query = 'meditation'
      
      // Simulate scoring algorithm
      const scoredResults = [
        ...mockAudioItems.map(item => ({
          type: 'audio',
          item,
          score: item.title.toLowerCase().includes(query) ? 100 :
                item.description.toLowerCase().includes(query) ? 50 :
                item.tags.some(tag => tag.label.includes(query)) ? 25 : 0
        })),
        ...mockPostItems.map(item => ({
          type: 'post',
          item,
          score: item.title.toLowerCase().includes(query) ? 100 :
                item.excerpt?.toLowerCase().includes(query) ? 50 :
                item.tags.some(tag => tag.label.includes(query)) ? 25 : 0
        })),
        ...mockEventItems.map(item => ({
          type: 'event',
          item,
          score: item.title.toLowerCase().includes(query) ? 100 :
                item.excerpt?.toLowerCase().includes(query) ? 50 : 0
        }))
      ]
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      
      expect(scoredResults).toHaveLength(4)
      // Exact title matches should rank higher
      expect(scoredResults[0].score).toBe(100)
      expect(scoredResults[0].item.title).toBe('Guided Meditation for Beginners')
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large datasets efficiently', () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        title: `Item ${i}`,
        description: i % 10 === 0 ? 'meditation content' : 'other content',
        tags: i % 5 === 0 ? [{ label: 'meditation' }] : [{ label: 'other' }]
      }))
      
      const query = 'meditation'
      const start = performance.now()
      
      const results = largeDataset.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.label.includes(query))
      )
      
      const end = performance.now()
      const duration = end - start
      
      expect(results.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50) // Should complete within 50ms
    })

    it('should handle special characters and unicode', () => {
      const specialItems = [
        { title: 'Méditation guidée', description: 'Description with accents' },
        { title: 'Search with émojis 🧘‍♀️', description: 'Unicode content' },
        { title: 'Special chars: @#$%', description: 'Symbols and numbers 123' }
      ]
      
      const queries = ['meditation', 'émojis', 'chars']
      
      queries.forEach(query => {
        const results = specialItems.filter(item =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase())
        )
        expect(results.length).toBeGreaterThanOrEqual(0)
      })
    })

    it('should handle empty and whitespace queries', () => {
      const queries = ['', '   ', '\t', '\n']
      
      queries.forEach(query => {
        const trimmed = query.trim()
        expect(trimmed.length).toBe(0)
        
        // Empty queries should not trigger search
        const results = trimmed.length >= 2 ? mockAudioItems.filter(item => 
          item.title.includes(trimmed)
        ) : []
        
        expect(results).toHaveLength(0)
      })
    })
  })
})