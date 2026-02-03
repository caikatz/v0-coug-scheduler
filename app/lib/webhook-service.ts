import type { Message, UserPreferences, ScheduleItems } from './schemas'
import { getUserId } from './storage-utils'

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL

interface WebhookPayload {
  userId: string
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>
  userPreferences: UserPreferences | null
  schedule: ScheduleItems
  currentMessage: string
}

interface WebhookResponse {
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
      userId: getUserId(),
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

    // Fallback to random lion response - return the original messages plus a fallback AI message
    const fallbackResponses = [
      "I'm having trouble connecting right now, but I'm still here to help!",
      "That's the spirit! My connection is a bit spotty, but let's keep going!",
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
