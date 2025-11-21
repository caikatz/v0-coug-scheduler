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
    () => `butch-chat-session-${Date.now()}`
  )

  // When sessionKey changes, generate a new session ID
  useEffect(() => {
    setSessionId(`butch-chat-session-${Date.now()}`)
  }, [sessionKey])

  // Create the opening message based on user preferences and onboarding status
  const openingMessage = useMemo(() => {
    if (onboardingCompleted) {
      // Post-onboarding: casual check-in message
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
      "Hey! Thanks for taking the time to fill out that survey. I'm Butch, and I'm here to help you build a schedule that actually works for your life."

    if (userPreferences) {
      // Personalize based on survey responses
      const sleepHours = userPreferences.sleepHours
      const productiveHours = userPreferences.productiveHours

      if (sleepHours && productiveHours) {
        message += ` I see you're typically productive from ${productiveHours} and aiming for sleep around ${sleepHours}.`
      }

      if (userPreferences.sleepScheduleWorking === 'Yes') {
        message +=
          " It's great that your sleep schedule is working well for you!"
      } else if (userPreferences.sleepScheduleWorking === 'No') {
        message +=
          ' I noticed your sleep schedule could use some work - we can definitely factor that in.'
      }
    }

    message +=
      "\n\nReady to dive in? Let's start with your classes this semester - I want to go through each one and figure out realistic study hours based on how challenging they are. What classes are you taking?"

    return message
  }, [userPreferences, onboardingCompleted])

  // Initial messages with Butch's greeting
  const initialMessages = useMemo(
    () => [
      {
        id: `butch-opening-${sessionKey}`,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: openingMessage }],
      },
    ],
    [openingMessage, sessionKey]
  )

  const chatOptions = useMemo(
    () => ({
      id: sessionId,
      messages: initialMessages, // Use messages parameter to set initial messages
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

  const { messages, sendMessage, status, error, stop } = useChat(chatOptions)

  return {
    messages,
    isLoading: status === 'streaming',
    error,
    sendMessage,
    stop,
    sessionId,
  }
}
