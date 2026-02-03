import { useState, useCallback } from 'react'
import { z } from 'zod'
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from './storage-utils'
import {
  SurveyStateSchema,
  ScheduleStateSchema,
  ChatStateSchema,
  NavigationStateSchema,
  DEFAULT_MESSAGES,
  DEFAULT_SCHEDULE_ITEMS,
  type SurveyState,
  type ScheduleState,
  type ChatState,
  type NavigationState,
  type UserPreferences,
  type Message,
  type ScheduleItems,
} from './schemas'

// Default states moved outside hooks to prevent re-creation on each render
const DEFAULT_SURVEY_STATE: SurveyState = {
  version: '1.0.0',
  showSurvey: true,
  currentQuestionIndex: 0,
  surveyAnswers: [],
  userPreferences: null,
}

const DEFAULT_SCHEDULE_STATE: ScheduleState = {
  version: '1.0.0',
  scheduleItems: DEFAULT_SCHEDULE_ITEMS,
  nextTaskId: 1,
}

const DEFAULT_CHAT_STATE: ChatState = {
  version: '1.0.0',
  messages: DEFAULT_MESSAGES,
  onboardingCompleted: false,
}

/**
 * Generic hook for localStorage-backed state with Zod validation
 */
function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  schema?: z.ZodSchema<T>
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    return loadFromStorage(key, defaultValue, schema)
  })

  const setStateAndSave = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue =
          typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
        saveToStorage(key, newValue, schema)
        return newValue
      })
    },
    [key, schema]
  )

  return [state, setStateAndSave]
}

/**
 * Hook for survey state persistence
 */
export function useSurveyState() {
  const [surveyState, setSurveyState] = useLocalStorageState(
    STORAGE_KEYS.SURVEY_STATE,
    DEFAULT_SURVEY_STATE,
    SurveyStateSchema
  )

  const updateSurveyAnswer = useCallback(
    (answer: string) => {
      setSurveyState((prev) => ({
        ...prev,
        surveyAnswers: [...prev.surveyAnswers, answer],
        currentQuestionIndex: prev.currentQuestionIndex + 1,
      }))
    },
    [setSurveyState]
  )

  const goBackInSurvey = useCallback(() => {
    setSurveyState((prev) => {
      if (prev.currentQuestionIndex > 0) {
        // Remove the last answer and go back one question
        const newAnswers = [...prev.surveyAnswers]
        newAnswers.pop()
        return {
          ...prev,
          surveyAnswers: newAnswers,
          currentQuestionIndex: prev.currentQuestionIndex - 1,
        }
      }
      return prev
    })
  }, [setSurveyState])

  const completeSurvey = useCallback(
    (preferences: UserPreferences) => {
      setSurveyState((prev) => ({
        ...prev,
        showSurvey: false,
        userPreferences: preferences,
      }))
    },
    [setSurveyState]
  )

  const resetSurvey = useCallback(() => {
    setSurveyState(DEFAULT_SURVEY_STATE)
  }, [setSurveyState])

  return {
    ...surveyState,
    setSurveyState,
    updateSurveyAnswer,
    goBackInSurvey,
    completeSurvey,
    resetSurvey,
  }
}

/**
 * Hook for schedule state persistence
 */
export function useScheduleState() {
  const [scheduleState, setScheduleState] = useLocalStorageState(
    STORAGE_KEYS.SCHEDULE_STATE,
    DEFAULT_SCHEDULE_STATE,
    ScheduleStateSchema
  )

  const updateScheduleItems = useCallback(
    (updater: (items: ScheduleItems) => ScheduleItems) => {
      setScheduleState((prev) => ({
        ...prev,
        scheduleItems: updater(prev.scheduleItems),
      }))
    },
    [setScheduleState]
  )

  const incrementTaskId = useCallback(() => {
    setScheduleState((prev) => ({
      ...prev,
      nextTaskId: prev.nextTaskId + 1,
    }))
    return scheduleState.nextTaskId
  }, [setScheduleState, scheduleState.nextTaskId])

  return {
    ...scheduleState,
    setScheduleState,
    updateScheduleItems,
    incrementTaskId,
  }
}

/**
 * Hook for chat state persistence
 */
export function useChatState() {
  const [chatState, setChatState] = useLocalStorageState(
    STORAGE_KEYS.CHAT_STATE,
    DEFAULT_CHAT_STATE,
    ChatStateSchema
  )

  const addMessage = useCallback(
    (message: Message) => {
      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
      }))
    },
    [setChatState]
  )

  const addMessages = useCallback(
    (messages: Message[]) => {
      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...messages],
      }))
    },
    [setChatState]
  )

  const clearMessages = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      messages: DEFAULT_MESSAGES,
    }))
  }, [setChatState])

  const setMessages = useCallback(
    (messages: Message[]) => {
      setChatState((prev) => ({
        ...prev,
        messages,
      }))
    },
    [setChatState]
  )

  const setOnboardingCompleted = useCallback(
    (completed: boolean) => {
      setChatState((prev) => ({
        ...prev,
        onboardingCompleted: completed,
      }))
    },
    [setChatState]
  )

  return {
    ...chatState,
    setChatState,
    addMessage,
    addMessages,
    clearMessages,
    setMessages,
    setOnboardingCompleted,
  }
}

/**
 * Hook for navigation state persistence
 */
export function useNavigationState() {
  const getCurrentDayIndex = () => {
    const today = new Date()
    return (today.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
  }

  const defaultState: NavigationState = {
    version: '1.0.0',
    currentDate: new Date(),
    selectedDay: getCurrentDayIndex(),
    currentView: 'main',
  }

  const [navigationState, setNavigationState] = useLocalStorageState(
    STORAGE_KEYS.NAVIGATION_STATE,
    defaultState,
    NavigationStateSchema
  )

  const setCurrentDate = useCallback(
    (date: Date) => {
      setNavigationState((prev) => ({
        ...prev,
        currentDate: date,
      }))
    },
    [setNavigationState]
  )

  const setSelectedDay = useCallback(
    (day: number) => {
      setNavigationState((prev) => ({
        ...prev,
        selectedDay: day,
      }))
    },
    [setNavigationState]
  )

  const setCurrentView = useCallback(
    (view: 'main' | 'chat' | 'task-editor') => {
      setNavigationState((prev) => ({
        ...prev,
        currentView: view,
      }))
    },
    [setNavigationState]
  )

  return {
    ...navigationState,
    setNavigationState,
    setCurrentDate,
    setSelectedDay,
    setCurrentView,
  }
}
