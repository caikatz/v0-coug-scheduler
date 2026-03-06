import { useState, useCallback, useEffect } from 'react'
import { z } from 'zod'
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from './storage-utils'

const CALENDAR_URLS_SCHEMA = z.object({
  icsUrls: z.array(z.string().min(1)),
})
type CalendarUrlsState = z.infer<typeof CALENDAR_URLS_SCHEMA>
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

// Stable default for navigation (avoids hydration mismatch from new Date())
const DEFAULT_NAVIGATION_STATE: NavigationState = {
  version: '1.0.0',
  currentDate: new Date(2000, 0, 1),
  selectedDay: 0,
  currentView: 'main',
}

/**
 * Generic hook for localStorage-backed state with Zod validation.
 * Uses defaultValue on first render (server + client) to avoid hydration mismatch,
 * then syncs from localStorage in useEffect after mount.
 */
function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  schema?: z.ZodSchema<T>
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(defaultValue)

  useEffect(() => {
    setState(loadFromStorage(key, defaultValue, schema))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- only load once on mount

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

  const setNextTaskId = useCallback(
    (id: number) => {
      setScheduleState((prev) => ({ ...prev, nextTaskId: id }))
    },
    [setScheduleState]
  )

  return {
    ...scheduleState,
    setScheduleState,
    updateScheduleItems,
    incrementTaskId,
    setNextTaskId,
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
  const [navigationState, setNavigationState] = useLocalStorageState(
    STORAGE_KEYS.NAVIGATION_STATE,
    DEFAULT_NAVIGATION_STATE,
    NavigationStateSchema
  )

  // When loading from empty storage, use "today" instead of placeholder date
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.NAVIGATION_STATE)
    if (!stored) {
      const today = new Date()
      const selectedDay = (today.getDay() + 6) % 7
      setNavigationState((prev) => ({
        ...prev,
        currentDate: today,
        selectedDay,
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only run once on mount when storage is empty

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

const DEFAULT_CALENDAR_URLS: CalendarUrlsState = {
  icsUrls: [],
}

/**
 * Hook for calendar ICS URLs persistence
 */
export function useCalendarUrls() {
  const [state, setState] = useLocalStorageState<CalendarUrlsState>(
    STORAGE_KEYS.CALENDAR_URLS,
    DEFAULT_CALENDAR_URLS,
    CALENDAR_URLS_SCHEMA
  )

  const addCalendarUrl = useCallback(
    (url: string) => {
      const trimmed = url.trim()
      if (!trimmed || state.icsUrls.includes(trimmed)) return
      setState((prev) => ({
        ...prev,
        icsUrls: [...prev.icsUrls, trimmed],
      }))
    },
    [state.icsUrls, setState]
  )

  const removeCalendarUrl = useCallback(
    (url: string) => {
      setState((prev) => ({
        ...prev,
        icsUrls: prev.icsUrls.filter((u) => u !== url),
      }))
    },
    [setState]
  )

  const setCalendarUrls = useCallback(
    (urls: string[]) => {
      setState((prev) => ({ ...prev, icsUrls: urls }))
    },
    [setState]
  )

  return {
    icsUrls: state.icsUrls,
    addCalendarUrl,
    removeCalendarUrl,
    setCalendarUrls,
  }
}
