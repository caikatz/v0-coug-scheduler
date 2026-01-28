import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useSurveyState, useScheduleState } from './persistence-hooks'
import { useEffect, useState, useMemo } from 'react'

export function useAIChat(
  sessionKey?: string | number,
  onboardingCompleted: boolean = false
) {
  const { userPreferences } = useSurveyState()
  const { scheduleItems } = useScheduleState()

  // Generate a unique session ID that changes with sessionKey
  const [sessionId, setSessionId] = useState(
    () => `fred-chat-session-${Date.now()}`
  )

  // Update sessionId when sessionKey changes
  useEffect(() => {
    setSessionId(`fred-chat-session-${Date.now()}`)
  }, [sessionKey])

  // Storage key for persistence
  const storageKey = `fred-chat-messages-${sessionKey ?? 'default'}`

  // Load saved messages from localStorage
  const savedMessages = useMemo(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }, [storageKey])

  // Create the opening message (only if no saved messages exist)
  const openingMessage = useMemo(() => {
    if (savedMessages.length > 0) return null // skip if messages exist

    if (onboardingCompleted) {
      const greetings = [
        "Hey! How's your schedule been working out for you?",
        'How are your classes going this week?',
        "Checking in - how's everything feeling with your current routine?",
        "What's up? How's the semester treating you so far?",
        'Hey there! How have things been going with your schedule?',
      ]
      return greetings[Math.floor(Math.random() * greetings.length)]
    }

    // Onboarding: detailed personal introduction
    let message =
      "Hey! Thanks for taking the time to fill out that survey. I'm Fred, and I'm here to help you build a schedule that actually works for your life."

    if (userPreferences) {
      const sleepHours = userPreferences.sleepHours
      const productiveHours = userPreferences.productiveHours

      if (sleepHours && productiveHours) {
        message += ` I see you're typically productive from ${productiveHours} and aiming for sleep around ${sleepHours}.`
      }

      if (userPreferences.sleepScheduleWorking === 'Yes') {
        message += " It's great that your sleep schedule is working well for you!"
      } else if (userPreferences.sleepScheduleWorking === 'No') {
        message += ' I noticed your sleep schedule could use some work - we can definitely factor that in.'
      }
    }

    message +=
      "\n\nReady to dive in? Let's start with your classes this semester - I want to go through each one and figure out realistic study hours based on how challenging they are. What classes are you taking?"

    return message
  }, [savedMessages, userPreferences, onboardingCompleted])

  // Determine initial messages: either restored or a single opening message
  const initialMessages = useMemo(() => {
    if (savedMessages.length > 0) return savedMessages

    return [
      {
        id: `fred-opening-${sessionKey}`,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: openingMessage }],
      },
    ]
  }, [savedMessages, openingMessage, sessionKey])

  // Chat options for useChat
  const chatOptions = useMemo(
    () => ({
      id: sessionId,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: '/api/chat',
        body: {
          userPreferences,
          schedule: scheduleItems,
          onboardingCompleted,
        },
      }),
    }),
    [
      sessionId,
      initialMessages,
      userPreferences,
      scheduleItems,
      onboardingCompleted,
    ]
  )

  // Hook that manages AI chat
  const { messages, sendMessage, status, error, stop } = useChat(chatOptions)

  // Persist messages on every change, trimming to last 50
  useEffect(() => {
    if (!messages || messages.length === 0) return
    try {
      // Keep only the last 50 messages
      const trimmed = messages.slice(-50)
      localStorage.setItem(storageKey, JSON.stringify(trimmed))
    } catch (err) {
      console.error('Failed to store chat messages', err)
    }
  }, [messages, storageKey])


  return {
    messages,
    isLoading: status === 'streaming',
    error,
    sendMessage,
    stop,
    sessionId,
  }
}
