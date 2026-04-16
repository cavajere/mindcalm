import { describe, it, expect } from 'vitest'
import { SearchScorer } from '../composables/useAdvancedSearch'

describe('Manual Search Testing - Real Scenarios', () => {
  // Test data that simulates real MindCalm content
  const realAudioData = [
    {
      id: '1',
      title: 'Meditazione Guidata per Principianti',
      description: 'Una dolce introduzione alla pratica meditativa',
      tags: [{ id: '1', label: 'meditation' }, { id: '2', label: 'beginner' }],
      category: { id: '1', name: 'Mindfulness' },
      level: 'BEGINNER',
      durationSeconds: 600
    },
    {
      id: '2', 
      title: 'Tecniche di Respirazione Avanzate',
      description: 'Esercizi di respirazione profonda per praticanti esperti',
      tags: [{ id: '3', label: 'breathing' }, { id: '4', label: 'advanced' }],
      category: { id: '2', name: 'Breathing' },
      level: 'ADVANCED',
      durationSeconds: 1200
    },
    {
      id: '3',
      title: 'Meditazione per il Sonno',
      description: 'Rilassamento profondo per addormentarsi facilmente',
      tags: [{ id: '1', label: 'meditation' }, { id: '5', label: 'sleep' }],
      category: { id: '1', name: 'Mindfulness' },
      level: 'BEGINNER',
      durationSeconds: 1800
    },
    {
      id: '4',
      title: 'Camminata Consapevole',
      description: 'Pratica di mindfulness durante la camminata',
      tags: [{ id: '6', label: 'mindfulness' }, { id: '7', label: 'walking' }],
      category: { id: '3', name: 'Movement' },
      level: 'INTERMEDIATE',
      durationSeconds: 900
    }
  ]

  const realPostData = [
    {
      id: '1',
      title: 'I Benefici Scientifici della Meditazione',
      slug: 'benefici-scientifici-meditazione',
      excerpt: 'Ricerca scientifica sui benefici della pratica meditativa quotidiana',
      tags: [{ id: '1', label: 'meditation' }, { id: '8', label: 'science' }],
      author: 'Dr. Rossi',
      publishedAt: '2024-01-15T00:00:00Z'
    },
    {
      id: '2',
      title: 'Alimentazione Consapevole',
      slug: 'alimentazione-consapevole',
      excerpt: 'Come portare mindfulness nei tuoi pasti quotidiani',
      tags: [{ id: '6', label: 'mindfulness' }, { id: '9', label: 'nutrition' }],
      author: 'Maria Bianchi',
      publishedAt: '2024-01-10T00:00:00Z'
    },
    {
      id: '3',
      title: 'Gestire lo Stress con la Respirazione',
      slug: 'gestire-stress-respirazione',
      excerpt: 'Tecniche di respirazione per ridurre ansia e stress',
      tags: [{ id: '3', label: 'breathing' }, { id: '10', label: 'stress' }],
      author: 'Luca Verde',
      publishedAt: '2024-01-05T00:00:00Z'
    }
  ]

  const realEventData = [
    {
      id: '1',
      title: 'Ritiro di Meditazione Weekend',
      slug: 'ritiro-meditazione-weekend',
      excerpt: 'Workshop intensivo di meditazione di due giorni',
      city: 'Milano',
      venue: 'Centro Benessere Zen',
      organizer: 'Team MindCalm',
      startsAt: '2024-06-15T09:00:00Z',
      cancelledAt: null,
      bookingRequired: true,
      participationMode: 'PAID'
    },
    {
      id: '2',
      title: 'Workshop Gratuito di Respirazione',
      slug: 'workshop-respirazione-gratuito',
      excerpt: 'Impara le tecniche di base di respirazione consapevole',
      city: 'Roma',
      venue: 'Sala Comunale',
      organizer: 'Istituto Benessere',
      startsAt: '2024-06-20T18:00:00Z',
      cancelledAt: null,
      bookingRequired: false,
      participationMode: 'FREE'
    },
    {
      id: '3',
      title: 'Mindfulness in Azienda',
      slug: 'mindfulness-azienda',
      excerpt: 'Corso di mindfulness per il team aziendale',
      city: 'Firenze',
      venue: 'Spazio Coworking',
      organizer: 'Mindful Business',
      startsAt: '2024-07-01T14:00:00Z',
      cancelledAt: null,
      bookingRequired: true,
      participationMode: 'PAID'
    }
  ]

  describe('Audio Search Tests', () => {
    const audioFieldConfig = [
      { key: 'title', weight: 3 },
      { key: 'description', weight: 2 },
      { key: 'tags', weight: 1, isArray: true }
    ]

    it('should find meditation content in Italian', () => {
      const query = 'meditazione'
      const results = realAudioData
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, query, audioFieldConfig)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      expect(results.length).toBeGreaterThan(0)
      console.log('🔍 Search for "meditazione":')
      results.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" (Score: ${item.score})`)
      })
      
      // Should find items with 'meditazione' in title
      const foundTitles = results.map(item => item.title)
      expect(foundTitles.some(title => title.toLowerCase().includes('meditazione'))).toBe(true)
    })

    it('should find content by English tags', () => {
      const query = 'breathing'
      const results = realAudioData
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, query, audioFieldConfig)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      expect(results.length).toBeGreaterThan(0)
      console.log('🔍 Search for "breathing":')
      results.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" (Score: ${item.score})`)
      })
    })

    it('should apply category and level filters', () => {
      const query = 'meditazione'
      const categoryFilter = '1' // Mindfulness
      const levelFilter = 'BEGINNER'

      // Apply search
      let results = realAudioData.filter(item => {
        const score = SearchScorer.scoreItem(item, query, audioFieldConfig)
        return score > 0
      })

      // Apply filters
      results = results
        .filter(item => item.category.id === categoryFilter)
        .filter(item => item.level === levelFilter)

      console.log('🔍 Search for "meditazione" + Mindfulness + Beginner:')
      results.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" (${item.category.name}, ${item.level})`)
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(item => 
        item.category.id === categoryFilter && item.level === levelFilter
      )).toBe(true)
    })

    it('should apply duration filters', () => {
      // Test different duration ranges
      const shortAudio = realAudioData.filter(item => item.durationSeconds < 600)
      const mediumAudio = realAudioData.filter(item => 
        item.durationSeconds >= 600 && item.durationSeconds <= 1200
      )
      const longAudio = realAudioData.filter(item => item.durationSeconds > 1200)

      console.log('📊 Audio by duration:')
      console.log(`Short (<10min): ${shortAudio.length} items`)
      console.log(`Medium (10-20min): ${mediumAudio.length} items`)
      console.log(`Long (>20min): ${longAudio.length} items`)

      expect(shortAudio.length + mediumAudio.length + longAudio.length).toBe(realAudioData.length)
    })
  })

  describe('Posts Search Tests', () => {
    const postFieldConfig = [
      { key: 'title', weight: 3 },
      { key: 'excerpt', weight: 2 },
      { key: 'tags', weight: 1, isArray: true }
    ]

    it('should find posts about mindfulness', () => {
      const query = 'mindfulness'
      const results = realPostData
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, query, postFieldConfig)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      console.log('🔍 Posts search for "mindfulness":')
      results.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" by ${item.author} (Score: ${item.score})`)
      })

      expect(results.length).toBeGreaterThan(0)
    })

    it('should find posts by author or topic', () => {
      const stressQuery = 'stress'
      const results = realPostData
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, stressQuery, postFieldConfig)
        }))
        .filter(item => item.score > 0)

      console.log('🔍 Posts search for "stress":')
      results.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" - ${item.excerpt}`)
      })

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Events Search Tests', () => {
    const eventFieldConfig = [
      { key: 'title', weight: 3 },
      { key: 'excerpt', weight: 2 },
      { key: 'city', weight: 1.5 },
      { key: 'venue', weight: 1.5 },
      { key: 'organizer', weight: 1 }
    ]

    it('should find events by location', () => {
      const query = 'milano'
      const results = realEventData
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, query, eventFieldConfig)
        }))
        .filter(item => item.score > 0)

      console.log('🔍 Events search for "milano":')
      results.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" in ${item.city} at ${item.venue}`)
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results.every(item => 
        item.city.toLowerCase().includes('milano')
      )).toBe(true)
    })

    it('should find events by topic', () => {
      const query = 'respirazione'
      const results = realEventData
        .map(item => ({
          ...item,
          score: SearchScorer.scoreItem(item, query, eventFieldConfig)
        }))
        .filter(item => item.score > 0)

      console.log('🔍 Events search for "respirazione":')
      results.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" - ${item.excerpt}`)
      })

      expect(results.length).toBeGreaterThan(0)
    })

    it('should find free vs paid events', () => {
      const freeEvents = realEventData.filter(item => 
        item.participationMode === 'FREE'
      )
      const paidEvents = realEventData.filter(item => 
        item.participationMode === 'PAID'
      )

      console.log('💰 Events by participation:')
      console.log(`Free events: ${freeEvents.length}`)
      freeEvents.forEach(item => console.log(`  - ${item.title}`))
      console.log(`Paid events: ${paidEvents.length}`)
      paidEvents.forEach(item => console.log(`  - ${item.title}`))

      expect(freeEvents.length + paidEvents.length).toBe(realEventData.length)
    })
  })

  describe('Cross-Content Search', () => {
    it('should search across all content types', () => {
      const query = 'mindfulness'
      const allFieldConfig = [
        { key: 'title', weight: 3 },
        { key: 'description', weight: 2 },
        { key: 'excerpt', weight: 2 },
        { key: 'tags', weight: 1, isArray: true }
      ]

      const audioResults = realAudioData
        .map(item => ({ ...item, type: 'audio', score: SearchScorer.scoreItem(item, query, allFieldConfig) }))
        .filter(item => item.score > 0)

      const postResults = realPostData
        .map(item => ({ ...item, type: 'post', score: SearchScorer.scoreItem(item, query, allFieldConfig) }))
        .filter(item => item.score > 0)

      const eventResults = realEventData
        .map(item => ({ ...item, type: 'event', score: SearchScorer.scoreItem(item, query, [
          { key: 'title', weight: 3 },
          { key: 'excerpt', weight: 2 },
          { key: 'city', weight: 1.5 },
          { key: 'venue', weight: 1.5 }
        ]) }))
        .filter(item => item.score > 0)

      const allResults = [...audioResults, ...postResults, ...eventResults]
        .sort((a, b) => b.score - a.score)

      console.log('🌐 Cross-content search for "mindfulness":')
      allResults.forEach((item, index) => {
        console.log(`${index + 1}. [${item.type.toUpperCase()}] "${item.title}" (Score: ${item.score})`)
      })

      expect(allResults.length).toBeGreaterThan(0)
      
      // Should find content across different types
      const contentTypes = [...new Set(allResults.map(item => item.type))]
      expect(contentTypes.length).toBeGreaterThan(1)
    })
  })

  describe('Performance Testing', () => {
    it('should handle realistic dataset sizes efficiently', () => {
      // Create larger dataset (simulate real app scale)
      const largeAudioDataset = Array.from({ length: 200 }, (_, i) => ({
        id: `audio-${i}`,
        title: `Audio Session ${i}`,
        description: i % 10 === 0 ? 'Meditation practice for relaxation' : 'Various wellness content',
        tags: [
          { id: '1', label: i % 5 === 0 ? 'meditation' : 'other' },
          { id: '2', label: i % 7 === 0 ? 'relaxation' : 'content' }
        ]
      }))

      const start = performance.now()
      
      const results = largeAudioDataset
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
        .slice(0, 20) // Simulate pagination

      const end = performance.now()
      const duration = end - start

      console.log(`⚡ Performance test:`)
      console.log(`  Dataset size: ${largeAudioDataset.length} items`)
      console.log(`  Search duration: ${duration.toFixed(2)}ms`)
      console.log(`  Results found: ${results.length}`)
      console.log(`  Results per ms: ${(results.length / duration).toFixed(2)}`)

      expect(duration).toBeLessThan(100) // Should complete within 100ms
      expect(results.length).toBeGreaterThan(0)
    })
  })
})