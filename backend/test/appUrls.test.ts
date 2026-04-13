import { describe, expect, it } from 'vitest'
import { buildAppUrl, resolveAppBaseUrl } from '../src/utils/appUrls'

describe('appUrls', () => {
  it('usa il fallback configurato quando il client non passa alcun URL', () => {
    expect(resolveAppBaseUrl(undefined, 'http://localhost:5473/', 'app pubblica'))
      .toBe('http://localhost:5473')
  })

  it('normalizza il path base senza slash finale', () => {
    expect(resolveAppBaseUrl(undefined, 'http://localhost:5474/admin/', 'admin'))
      .toBe('http://localhost:5474/admin')
  })

  it('compone URL applicativi in modo consistente', () => {
    expect(buildAppUrl('http://localhost:5474/admin/', '/reset-password'))
      .toBe('http://localhost:5474/admin/reset-password')
  })
})
