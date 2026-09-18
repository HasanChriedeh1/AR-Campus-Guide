import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('chat webhook adapter', () => {
  it('stays unavailable when no webhook URL is configured', async () => {
    vi.stubEnv('VITE_CHAT_API_URL', '')
    const chat = await import('./chatApi')
    expect(chat.isChatConfigured).toBe(false)
    await expect(chat.sendChatMessage('Hello', 'session-1')).rejects.toThrow(/not been configured/)
  })

  it('posts the standard message contract and returns the reply', async () => {
    vi.stubEnv('VITE_CHAT_API_URL', '/api/chat-test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'Welcome to RHU.' }) }))
    const chat = await import('./chatApi')
    await expect(chat.sendChatMessage('Hello', 'session-2')).resolves.toBe('Welcome to RHU.')
    expect(fetch).toHaveBeenCalledWith('/api/chat-test', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', sessionId: 'session-2' }),
    }))
  })

  it('rejects failed and malformed webhook responses', async () => {
    vi.stubEnv('VITE_CHAT_API_URL', '/api/chat-test')
    const request = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: 'wrong field' }) })
    vi.stubGlobal('fetch', request)
    const chat = await import('./chatApi')
    await expect(chat.sendChatMessage('Hello', 'session-3')).rejects.toThrow(/503/)
    await expect(chat.sendChatMessage('Hello', 'session-3')).rejects.toThrow(/unexpected response/)
  })
})
