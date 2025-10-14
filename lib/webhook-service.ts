import type { Message, UserPreferences, ScheduleItems } from './schemas'

const WEBHOOK_URL =
  'https://n8n.opulencefunnels.com/webhook/03f64a11-e4a9-4ca6-b76f-60ecddc6620f'

export interface WebhookPayload {
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>
  userPreferences: UserPreferences | null
  schedule: ScheduleItems
  currentMessage: string
}

export interface WebhookResponse {
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>
}

/**
 * Send chat context to n8n webhook and get updated messages array
 */
export async function sendChatToWebhook(
  messages: Message[],
  userPreferences: UserPreferences | null,
  schedule: ScheduleItems,
  currentMessage: string
): Promise<Message[]> {
  try {
    const payload: WebhookPayload = {
      messages: messages.map((msg) => ({
        ...msg,
        // Ensure timestamp is serialized as ISO string
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      })),
      userPreferences,
      schedule,
      currentMessage,
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(
        `Webhook request failed: ${response.status} ${response.statusText}`
      )
    }

    const data: WebhookResponse = await response.json()

    if (!data.messages || !Array.isArray(data.messages)) {
      throw new Error('Invalid response format from webhook')
    }

    // Convert the messages back to proper Message objects with Date timestamps
    return data.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  } catch (error) {
    console.error('Webhook error:', error)

    // Fallback to random cougar response - return the original messages plus a fallback AI message
    const fallbackResponses = [
      "Go Cougs! I'm having trouble connecting right now, but I'm still here to help!",
      "That's the Cougar spirit! My connection is a bit spotty, but let's keep going!",
      "Crimson and Gray pride! I'm experiencing some technical difficulties, but I believe in you!",
      "Way to go, Coug! I'm having some connectivity issues, but your dedication is inspiring!",
    ]

    const fallbackMessage: Message = {
      id: Date.now() + 1,
      text: fallbackResponses[
        Math.floor(Math.random() * fallbackResponses.length)
      ],
      sender: 'ai',
      timestamp: new Date(),
    }

    // Add user message and fallback AI response to the original messages
    const userMessage: Message = {
      id: Date.now(),
      text: currentMessage,
      sender: 'user',
      timestamp: new Date(),
    }

    return [...messages, userMessage, fallbackMessage]
  }
}
