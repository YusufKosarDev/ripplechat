import { describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchLinkPreview } from './linkPreviewsSlice'
import { client } from '../../api/client'

vi.mock('../../api/client', () => ({ client: { get: vi.fn() } }))

const URL_A = 'https://example.com/a'

function makeStore() {
  return configureStore({ reducer: { linkPreviews: reducer } })
}

describe('linkPreviewsSlice', () => {
  it('marks the url as loading while the unfurl is in flight', () => {
    vi.mocked(client.get).mockReturnValueOnce(new Promise(() => {}) as never)
    const store = makeStore()
    void store.dispatch(fetchLinkPreview(URL_A))
    expect(store.getState().linkPreviews.byUrl[URL_A]).toEqual({ status: 'loading', data: null })
  })

  it('stores the unfurled card', async () => {
    const card = { url: URL_A, title: 'Örnek', description: null, image: null }
    vi.mocked(client.get).mockResolvedValueOnce({ status: 200, data: card } as never)
    const store = makeStore()
    await store.dispatch(fetchLinkPreview(URL_A))
    expect(store.getState().linkPreviews.byUrl[URL_A]).toEqual({ status: 'done', data: card })
  })

  it('treats a 204 as "nothing to unfurl" rather than a card', () => {
    // The server answers 204 when the target has no usable metadata.
    vi.mocked(client.get).mockResolvedValueOnce({ status: 204, data: '' } as never)
    const store = makeStore()
    return store.dispatch(fetchLinkPreview(URL_A)).then(() => {
      expect(store.getState().linkPreviews.byUrl[URL_A]).toEqual({ status: 'done', data: null })
    })
  })

  it('settles to done on failure so the card never spins forever', async () => {
    vi.mocked(client.get).mockRejectedValueOnce(new Error('SSRF guard blocked it'))
    const store = makeStore()
    await store.dispatch(fetchLinkPreview(URL_A))
    expect(store.getState().linkPreviews.byUrl[URL_A]).toEqual({ status: 'done', data: null })
  })
})
