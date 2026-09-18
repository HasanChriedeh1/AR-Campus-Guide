const chatUrl = import.meta.env.VITE_CHAT_API_URL?.trim() || ''

export const isChatConfigured = Boolean(chatUrl)

export async function sendChatMessage(message: string, sessionId: string) {
  if (!chatUrl) throw new Error('The Campus Assistant webhook has not been configured yet.')
  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })
  if (!response.ok) throw new Error(`The Campus Assistant is unavailable (${response.status}).`)
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).reply !== 'string') {
    throw new Error('The Campus Assistant returned an unexpected response.')
  }
  return (value as { reply: string }).reply.trim()
}
