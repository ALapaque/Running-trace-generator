import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimeoutError, fetchWithTimeout } from '../utils/fetch-timeout'

/** Mock `fetch` qui ne résout jamais mais rejette quand son signal est abort. */
function abortableFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const fail = () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        reject(e)
      }
      const signal = init?.signal
      if (signal?.aborted) return fail()
      signal?.addEventListener('abort', fail)
    })
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fetchWithTimeout', () => {
  it('résout normalement quand la réponse arrive avant le délai', async () => {
    const res = new Response('{"ok":true}', { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => res))
    const out = await fetchWithTimeout('https://example.test', { timeoutMs: 1000 })
    expect(out).toBe(res)
  })

  it('rejette avec TimeoutError quand la requête dépasse le délai', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', abortableFetch())
    const promise = fetchWithTimeout('https://example.test', { timeoutMs: 100 })
    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError)
    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })

  it('rejette si le signal externe est déjà abort', async () => {
    vi.stubGlobal('fetch', abortableFetch())
    const ac = new AbortController()
    ac.abort()
    await expect(
      fetchWithTimeout('https://example.test', {
        timeoutMs: 5000,
        externalSignal: ac.signal,
      }),
    ).rejects.toThrow()
  })

  it('propage l’abort du signal externe (pas un TimeoutError)', async () => {
    vi.stubGlobal('fetch', abortableFetch())
    const ac = new AbortController()
    const promise = fetchWithTimeout('https://example.test', {
      timeoutMs: 5000,
      externalSignal: ac.signal,
    })
    const assertion = expect(promise).rejects.not.toBeInstanceOf(TimeoutError)
    ac.abort()
    await assertion
  })
})
