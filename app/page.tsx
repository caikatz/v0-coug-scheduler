'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Send,
  AlertCircle,
  Plus,
  Grid3X3,
  List,
  RotateCcw,
  Calendar,
  Trash2,
  Loader2,
} from 'lucide-react'

// Import Zod types and persistence hooks
import type { TaskForm, ScheduleItem } from '@/lib/schemas'
import {
  useSurveyState,
  useScheduleState,
  useNavigationState,
  useChatState,
  useCalendarUrls,
} from '@/lib/persistence-hooks'
import {
  icalEventsToScheduleItems,
  type ICalEvent,
} from '@/lib/ical-parser'
import {
  processUserPreferences,
  formatTime24To12,
  convertTo24Hour,
  validateTaskForm,
  WSU_SEMESTER,
  expandRecurringTasks,
  type RepeatType,
} from '@/lib/schemas'
import { useAIChat } from '@/lib/ai-chat-hook'
import {
  transformAIScheduleToItems,
  mergeScheduleForWeek,
  applyScheduleChanges,
} from '@/lib/schedule-transformer'
import { clearAllStorage } from '@/lib/storage-utils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const SURVEY_QUESTIONS = [
  {
    id: 1,
    question: 'What are your most productive study hours?',
    type: 'slider' as const,
    min: 6, // 6am
    max: 24, // 12am (midnight)
    step: 1,
    defaultValue: [9, 17], // 9am to 5pm
    labels: ['6am', '9am', '12pm', '3pm', '6pm', '9pm', '12am'],
  },
  {
    id: 2,
    question: 'When do you prefer to be asleep?',
    type: 'slider' as const,
    min: 0, // 9pm (represented as 0 for slider)
    max: 12, // 9am (represented as 12 for slider, actual hours: 9pm-9am)
    step: 1,
    defaultValue: [2, 10], // 11pm to 7am (2 hours after 9pm, 10 hours after 9pm)
    labels: ['9pm', '12am', '3am', '6am', '9am'],
    validation: 'min-7-hours' as const,
  },
  {
    id: 3,
    question: 'Is your current sleep schedule working for you?',
    type: 'multiple-choice' as const,
    options: [
      'I need to develop a new sleep routine',
      'I need to adjust it for college',
      'It can be improved',
      'No improvements needed',
    ],
    requiresFollowUp: [0, 1, 2], // Indices that require follow-up
  },

  {
    id: 4,
    question: 'How do you prefer to break down large tasks?',
    type: 'multiple-choice' as const,
    options: [
      'Keep tasks whole',
      'Break into study chunks >1hr',
      'Break into study chunks <1hr',
      'Let AI decide',
    ],
  },
  {
    id: 5,
    question: 'Are your current study habits working for you?',
    type: 'multiple-choice' as const,
    options: [
      'No, I need to develop a new routine',
      'Somewhat, but I need to adjust them for college',
      'Yes, but they can be improved',
      'Yes, they need no improvements',
    ],
    requiresFollowUp: [0, 1, 2], // Indices that require follow-up
  },
  {
    id: 6,
    question: 'What type of reminders work best for you?',
    type: 'multiple-choice' as const,
    options: [
      'Visual notifications',
      'Sound alerts',
      'Email summaries',
      'No notifications',
    ],
  },
]

const SCHEDULING_AI = {
  id: 1,
  name: 'Fred the lion',
  color: 'bg-orange-600',
  description: 'Your friendly scheduling buddy',
  emoji: '🦁',
}

export default function ScheduleApp() {
  // Use persistence hooks for all state management
  const {
    showSurvey,
    currentQuestionIndex,
    surveyAnswers,
    userPreferences,
    updateSurveyAnswer,
    goBackInSurvey,
    completeSurvey,
  } = useSurveyState()

  const {
    scheduleItems,
    nextTaskId,
    updateScheduleItems,
    incrementTaskId,
    setNextTaskId,
    setScheduleState,
  } = useScheduleState()

  const { icsUrls, addCalendarUrl, removeCalendarUrl } = useCalendarUrls()

  const {
    messages: chatMessages,
    onboardingCompleted,
    setOnboardingCompleted,
  } = useChatState()

  const {
    currentDate,
    selectedDay,
    currentView,
    setCurrentDate,
    setSelectedDay,
    setCurrentView,
  } = useNavigationState()

  // Track chat session - changes each time chat opens to start fresh
  const [chatSessionKey, setChatSessionKey] = useState<number>(0)

  const { messages, isLoading, error, sendMessage } = useAIChat(
    chatSessionKey,
    onboardingCompleted
  )

  // Ensure currentDate is always a Date object
  const currentDateObj =
    currentDate instanceof Date ? currentDate : new Date(currentDate)

  // Local UI state (not persisted)
  const [inputText, setInputText] = useState('')
  const [editingTask, setEditingTask] = useState<ScheduleItem | null>(null)
  const [showTaskEditor, setShowTaskEditor] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'todo'>('cards')
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>({
    name: '',
    startTime: '',
    endTime: '',
    dueDate: '',
    priority: 'medium',
    repeatType: 'never',
    repeatDays: [],
  })
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [taskFormErrors, setTaskFormErrors] = useState<string[]>([])

  // Survey-specific UI state
  const [sliderValue1, setSliderValue1] = useState<number[]>([9, 17])
  const [sliderValue2, setSliderValue2] = useState<number[]>([2, 10])
  const [followUpText, setFollowUpText] = useState('')
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [pendingAnswer, setPendingAnswer] = useState<string>('')
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showCalendarDialog, setShowCalendarDialog] = useState(false)
  const [icsInputValue, setIcsInputValue] = useState('')
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false)
  const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null)

  // Chat auto-scroll functionality
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [textareaHasOverflow, setTextareaHasOverflow] = useState(false) // UseState that toggles true/false when the send button moves a little when theres mutliple lines

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)

    // Check if textarea has overflowed to multiple lines
    // ScrollHeight - Total height of every line in the textbox
    // ClientHeight - Total VISIBLE height of every line in the textbox

    if (textareaRef.current) {
      const hasOverflow = textareaRef.current.scrollHeight > textareaRef.current.clientHeight
      setTextareaHasOverflow(hasOverflow)
    }
  }

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Daily ICS calendar refresh - syncs every 24 hours when ICS URLs are configured
  const scheduleItemsRef = useRef(scheduleItems)
  const nextTaskIdRef = useRef(nextTaskId)
  const icsUrlsRef = useRef(icsUrls)
  scheduleItemsRef.current = scheduleItems
  nextTaskIdRef.current = nextTaskId
  icsUrlsRef.current = icsUrls

  useEffect(() => {
    if (icsUrls.length === 0) return

    const runBackgroundSync = async () => {
      const urls = icsUrlsRef.current
      if (urls.length === 0) return
      try {
        let currentSchedule = { ...scheduleItemsRef.current }
        let currentNextId = nextTaskIdRef.current
        for (const url of urls) {
          const res = await fetch('/api/fetch-ics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          })
          const data = await res.json()
          if (!data.success) return
          const events = (data.events || []).map(
            (e: {
              uid: string
              title: string
              start: string
              end: string
              isAllDay: boolean
              location?: string
            }) =>
              ({
                ...e,
                start: new Date(e.start),
                end: new Date(e.end),
              }) as ICalEvent
          )
          const { scheduleItems: merged, nextId } = icalEventsToScheduleItems(
            events,
            currentSchedule,
            currentNextId,
            WSU_SEMESTER.current.end,
            url
          )
          currentSchedule = merged
          currentNextId = nextId
        }
        setScheduleState((prev) => ({
          ...prev,
          scheduleItems: currentSchedule,
          nextTaskId: currentNextId,
        }))
      } catch {
        // Silent fail for background sync
      }
    }

    const DAILY_MS = 24 * 60 * 60 * 1000

    runBackgroundSync()

    const intervalId = setInterval(runBackgroundSync, DAILY_MS)
    return () => clearInterval(intervalId)
  }, [icsUrls.length, setScheduleState])

  // Helper to convert slider value to hour string
  function sliderToHourString(value: number, questionId: number): string {
    if (questionId === 1) {
      // Q1: 6am-12am
      const hour24 = `${value}:00`
      return formatTime24To12(hour24)
    } else {
      // Q2: 9pm-9am (0-12 maps to 21-33)
      const actualHour = (21 + value) % 24
      const hour24 = `${actualHour}:00`
      return formatTime24To12(hour24)
    }
  }

  // Detect when Fred response "Let's get started on your schedule"
  useEffect(() => {
    // Only during onboarding, when AI finishes responding, and not already generating
    if (
      onboardingCompleted || // Already completed onboarding
      isLoading || // Still loading
      isGeneratingSchedule || // Already generating schedule
      messages.length < 2 // need at least opening message + one response
    ) {
      return
    }

    const lastMessage = messages[messages.length - 1]

    // Check if Fred just finished responding with the completion phrase
    if (lastMessage?.role === 'assistant') {
      // Extract message text - handle both 'content' format and 'parts' array format
      let messageText = ''
      
      // Check for content property first
      if ((lastMessage as { content?: string }).content) {
        messageText = (lastMessage as { content?: string }).content || ''
      } 
      // Otherwise, concatenate all text parts
      else if (lastMessage.parts && lastMessage.parts.length > 0) {
        messageText = lastMessage.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('')
      }

      if (messageText) {
        const text = messageText.toLowerCase()
        
        // Debug: log last part of message to see if phrase is there
        const last100Chars = text.slice(-100)
        console.log('🔍 Last 100 chars of message:', last100Chars)
        console.log('🔍 Looking for end phrase')
        
        // Detect the completion phrase (case-insensitive, with/without period)
        if (
          text.includes("let's get started on your schedule") ||
          text.includes("lets get started on your schedule")
        ) {
          console.log('✅ PHRASE DETECTED! Exiting...')
          
          // Small delay to ensure message is fully rendered
          setTimeout(() => {
            handleBackToMain()
          }, 2500)
        }
      } else {
        console.log('⚠️ No end phrase found')
      }
    }
  }, [messages, isLoading, onboardingCompleted, isGeneratingSchedule])

  function handleSurveyAnswer(answer: string | number[]) {
    const currentQuestion = SURVEY_QUESTIONS[currentQuestionIndex]

    // Check if this question requires follow-up (only if not already showing follow-up)
    if (
      !showFollowUp &&
      currentQuestion.type === 'multiple-choice' &&
      currentQuestion.requiresFollowUp
    ) {
      const selectedIndex =
        currentQuestion.options?.indexOf(answer as string) ?? -1
      if (currentQuestion.requiresFollowUp.includes(selectedIndex)) {
        setPendingAnswer(answer as string)
        setShowFollowUp(true)
        return // Wait for follow-up input
      }
    }

    // Format answer based on type
    let formattedAnswer: string
    if (Array.isArray(answer)) {
      // Slider answer
      if (currentQuestionIndex === 0) {
        formattedAnswer = `${answer[0]}:00-${answer[1]}:00`
      } else {
        formattedAnswer = `${sliderToHourString(
          answer[0],
          2
        )}-${sliderToHourString(answer[1], 2)}`
      }
    } else {
      formattedAnswer = answer
      if (showFollowUp && followUpText.trim()) {
        formattedAnswer += ` | Notes: ${followUpText.trim()}`
      }
    }

    // Move to next question or complete survey
    if (currentQuestionIndex < SURVEY_QUESTIONS.length - 1) {
      updateSurveyAnswer(formattedAnswer)
      setShowFollowUp(false)
      setFollowUpText('')
      setPendingAnswer('')
    } else {
      // Survey complete, process preferences
      const newAnswers = [...surveyAnswers, formattedAnswer]
      try {
        const preferences = processUserPreferences(newAnswers)
        completeSurvey(preferences)
        // Start a new chat session when survey completes
        setChatSessionKey((prev) => prev + 1)
        // Immediately show chat window after survey completion
        setCurrentView('chat')
      } catch (error) {
        console.error('Invalid survey answers:', error)
        // Handle validation error gracefully
      }
    }
  }

  function handleFollowUpSubmit() {
    handleSurveyAnswer(pendingAnswer)
  }

  function getWeekDates(date: Date) {
    const week = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)

    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek)
      weekDate.setDate(startOfWeek.getDate() + i)
      week.push(weekDate)
    }
    return week
  }

  function formatDateLocal(d: Date): string {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }

  function navigateWeek(direction: 'prev' | 'next') {
    const currentDateObj = new Date(currentDate)
    const newDate = new Date(currentDateObj)
    newDate.setDate(currentDateObj.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
  }

  function handleFredClick() {
    // Start a new chat session each time Fred is clicked
    setChatSessionKey((prev) => prev + 1)
    setCurrentView('chat')
  }

  async function handleBackToMain() {
    // Only generate schedule if there's a meaningful conversation (more than just the opening message)
    if (messages.length > 1) {
      console.time('frontend-schedule-generation')
      console.log(
        '🎯 Frontend: Starting schedule generation with',
        messages.length,
        'messages'
      )

      setIsGeneratingSchedule(true)
      try {
        console.time('fetch-api-call')
        console.log('📡 Frontend: Making API call to /api/generate-schedule')

        // Call the generate-schedule endpoint
        const response = await fetch('/api/generate-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages,
            existingSchedule: scheduleItems
           }),
        })

        console.timeEnd('fetch-api-call')
        console.log('📡 Frontend: API call completed, status:', response.status)

        console.time('response-parsing')
        const data = await response.json()
        console.timeEnd('response-parsing')

        console.log('📦 Frontend: Response data success:', data.success)

        if (data.success && data.schedule) {
          console.time('schedule-processing')
          
          // Get current week dates
          const weekDates = getWeekDates(currentDateObj)

        if (data.schedule.update_type === 'none') {
          // No update - just exit
          console.log('✅ No schedule changes detected')
        } else if (data.schedule.update_type === 'partial') {
          const updated = applyScheduleChanges(
            scheduleItems,
            data.schedule.changes || [],
            weekDates,
            nextTaskId,
            WSU_SEMESTER.current.end
          )
          
          // Count new tasks added
          const oldTaskCount = Object.values(scheduleItems).flat().length
          const newTaskCount = Object.values(updated).flat().length
          const addedTasks = newTaskCount - oldTaskCount
          
          updateScheduleItems(() => updated)
      
      // Increment task ID for new items
      for (let i = 0; i < addedTasks; i++) {
        incrementTaskId()
      }
        } else if (data.schedule.update_type === 'full') {
          const transformedSchedule = transformAIScheduleToItems(
            {
              update_type: data.schedule.update_type,
              weekly_schedule: data.schedule.weekly_schedule || [],
              schedule_summary: data.schedule.schedule_summary,
              notes: data.schedule.notes,
            },
            weekDates,
            nextTaskId
          )

          // Full overhaul: replace previous schedule entirely
          updateScheduleItems(() => transformedSchedule)

          const totalNewTasks = Object.values(transformedSchedule).flat().length
      for (let i = 0; i < totalNewTasks; i++) {
        incrementTaskId()
      }
    }

    console.timeEnd('schedule-processing')
    console.log('✅ Frontend: Schedule processing completed')
    
    if (!onboardingCompleted) {
      setOnboardingCompleted(true)
    }
        
      }
      } catch (error) {
        // Fail silently as requested
        console.error('❌ Frontend: Failed to generate schedule:', error)
      } finally {
        setIsGeneratingSchedule(false)
        console.timeEnd('frontend-schedule-generation')
        console.log('🏁 Frontend: Schedule generation process finished')
      }
    }

    setCurrentView('main')
  }

  function handleSendMessage() {
    if (!inputText.trim() || isLoading) return

    const currentMessage = inputText.trim()
    setInputText('')

    // Send message using AI SDK integration
    sendMessage({ text: currentMessage })
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  function getPriorityIcon(priority: string) {
    if (priority === 'high') {
      return (
        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-white" />
        </div>
      )
    }
    if (priority === 'medium') {
      return (
        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-white" />
        </div>
      )
    }
    return null
  }

  function handleTaskCompletion(taskId: number, dayKey: string) {
    updateScheduleItems((items) => ({
      ...items,
      [dayKey]:
        items[dayKey]?.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ) || [],
    }))

    // Task completion toggled
  }

  function handleTaskClick(task: ScheduleItem) {
    setEditingTask(task)
    setTaskFormErrors([]) // Clear any previous errors

    // Parse time if it exists
    let startTime = ''
    let endTime = ''
    if (task.time) {
      const timeParts = task.time.split(' - ')
      if (timeParts.length === 2) {
        // Convert from 12-hour format to 24-hour format for the time input
        startTime = convertTo24Hour(timeParts[0])
        endTime = convertTo24Hour(timeParts[1])
      }
    }

    const taskWithRepeat = task as ScheduleItem & {
      repeatType?: RepeatType
      repeatDays?: number[]
      repeatGroupId?: number
    }
    setTaskForm({
      name: task.title,
      startTime,
      endTime,
      dueDate: task.dueDate || '',
      priority: task.priority,
      repeatType: taskWithRepeat.repeatType ?? 'never',
      repeatDays: taskWithRepeat.repeatDays ?? [],
    })
    setShowTaskEditor(true)
  }

  function handleSaveTask() {
    // Validate the task form first
    const validation = validateTaskForm(taskForm)
    if (!validation.success) {
      setTaskFormErrors(validation.errors)
      return
    }

    setTaskFormErrors([])

    const editingTaskWithRepeat = editingTask as ScheduleItem & {
      repeatGroupId?: number
    }

    if (editingTask) {
      const repeatGroupId = editingTaskWithRepeat.repeatGroupId
      const idsToRemove = repeatGroupId
        ? (() => {
            const ids: number[] = []
            DAYS.forEach((day) => {
              (scheduleItems[day] || []).forEach((item) => {
                const ir = item as ScheduleItem & { repeatGroupId?: number }
                if (ir.repeatGroupId === repeatGroupId) ids.push(ir.id)
              })
            })
            return ids
          })()
        : [editingTask.id]

      updateScheduleItems((items) => {
        let result = { ...items }
        DAYS.forEach((day) => {
          result[day] = (result[day] || []).filter(
            (item) => !idsToRemove.includes(item.id)
          )
        })
        const { itemsByDay, nextId } = expandRecurringTasks(
          { ...taskForm, dueDate: taskForm.dueDate || formatDateLocal(getWeekDates(currentDateObj)[selectedDay]) },
          nextTaskId,
          WSU_SEMESTER.current.end
        )
        DAYS.forEach((day) => {
          result[day] = [...(result[day] || []), ...itemsByDay[day]]
        })
        setNextTaskId(nextId)
        return result
      })
    } else {
      const dueDate = taskForm.dueDate || formatDateLocal(getWeekDates(currentDateObj)[selectedDay])
      const { itemsByDay, nextId } = expandRecurringTasks(
        { ...taskForm, dueDate },
        nextTaskId,
        WSU_SEMESTER.current.end
      )
      updateScheduleItems((items) => {
        const result = { ...items }
        DAYS.forEach((day) => {
          result[day] = [...(result[day] || []), ...itemsByDay[day]]
        })
        return result
      })
      setNextTaskId(nextId)
    }

    setShowTaskEditor(false)
    setEditingTask(null)
    setTaskFormErrors([])
    setTaskForm({
      name: '',
      startTime: '',
      endTime: '',
      dueDate: '',
      priority: 'medium',
      repeatType: 'never',
      repeatDays: [],
    })
  }

  function handleReset() {
    // Clear all localStorage data
    clearAllStorage()
    // Reload the page to reinitialize all states
    window.location.reload()
  }

  function handleAddCalendarUrl() {
    const trimmed = icsInputValue.trim()
    if (!trimmed) return
    try {
      new URL(trimmed)
    } catch {
      setCalendarSyncError('Please enter a valid URL')
      return
    }
    setCalendarSyncError(null)
    addCalendarUrl(trimmed)
    setIcsInputValue('')
  }

  function handleRemoveCalendarUrl(url: string) {
    removeCalendarUrl(url)
    updateScheduleItems((items) => {
      const result = { ...items }
      DAYS.forEach((day) => {
        result[day] = (result[day] || []).filter(
          (item) =>
            (item as ScheduleItem & { icalUrl?: string }).icalUrl !== url
        )
      })
      return result
    })
  }

  async function handleSyncCalendar() {
    if (icsUrls.length === 0) {
      setCalendarSyncError('Add at least one calendar URL first')
      return
    }
    setCalendarSyncError(null)
    setIsSyncingCalendar(true)
    try {
      let currentSchedule = { ...scheduleItems }
      let currentNextId = nextTaskId
      for (const url of icsUrls) {
        const res = await fetch('/api/fetch-ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json()
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch calendar')
        }
        const events = (data.events || []).map(
          (e: {
            uid: string
            title: string
            start: string
            end: string
            isAllDay: boolean
            location?: string
          }) =>
            ({
              ...e,
              start: new Date(e.start),
              end: new Date(e.end),
            }) as ICalEvent
        )
        const { scheduleItems: merged, nextId } = icalEventsToScheduleItems(
          events,
          currentSchedule,
          currentNextId,
          WSU_SEMESTER.current.end,
          url
        )
        currentSchedule = merged
        currentNextId = nextId
      }
      setScheduleState((prev) => ({
        ...prev,
        scheduleItems: currentSchedule,
        nextTaskId: currentNextId,
      }))
      setShowCalendarDialog(false)
    } catch (err) {
      setCalendarSyncError(
        err instanceof Error ? err.message : 'Failed to sync calendar'
      )
    } finally {
      setIsSyncingCalendar(false)
    }
  }

  // Filter tasks to only show those that match the current week's dates
  const weekDates = getWeekDates(currentDateObj)
  const currentSelectedDate = weekDates[selectedDay]
  const currentDateString = formatDateLocal(currentSelectedDate)

  const currentScheduleItems = (scheduleItems[DAYS[selectedDay]] || []).filter(
    (item) => {
      // If task has no due date, show it (legacy behavior)
      if (!item.dueDate) {
        return true
      }
      // Only show tasks whose due date matches the currently selected date
      return item.dueDate === currentDateString
    }
  )

  if (showSurvey) {
    const currentQuestion = SURVEY_QUESTIONS[currentQuestionIndex]

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center relative">
          {/* Back arrow - only show if not on first question */}
          {currentQuestionIndex > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBackInSurvey}
              className="absolute top-4 left-4 h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="mb-6">
            <div className="w-16 h-16 bg-red-700 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
              <Image
                src="/images/butch-cougar.png"
                alt="Butch the Cougar"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Welcome, Coug!
            </h1>
            <p className="text-sm text-muted-foreground">
              Let&apos;s personalize your AI companion
            </p>
          </div>

          <div className="mb-8">
            <div className="flex justify-center mb-4">
              {SURVEY_QUESTIONS.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full mx-1 ${
                    index <= currentQuestionIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            <h2 className="text-lg font-semibold text-foreground mb-6 text-balance">
              {currentQuestion.question}
            </h2>

            {/* Render based on question type */}
            {currentQuestion.type === 'slider' ? (
              <div className="space-y-4 px-2">
                <Slider
                  value={
                    currentQuestionIndex === 0 ? sliderValue1 : sliderValue2
                  }
                  onValueChange={(value) => {
                    if (currentQuestionIndex === 0) {
                      setSliderValue1(value)
                    } else {
                      setSliderValue2(value)
                    }
                  }}
                  min={currentQuestion.min}
                  max={currentQuestion.max}
                  step={currentQuestion.step || 1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  {currentQuestion.labels?.map((label, idx) => (
                    <span key={idx}>{label}</span>
                  ))}
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>
                    Start:{' '}
                    {currentQuestionIndex === 0
                      ? sliderToHourString(sliderValue1[0], 1)
                      : sliderToHourString(sliderValue2[0], 2)}
                  </span>
                  <span>
                    End:{' '}
                    {currentQuestionIndex === 0
                      ? sliderToHourString(sliderValue1[1], 1)
                      : sliderToHourString(sliderValue2[1], 2)}
                  </span>
                </div>

                {/* Validation message for Q2 */}
                {currentQuestionIndex === 1 &&
                  currentQuestion.validation === 'min-7-hours' &&
                  sliderValue2[1] - sliderValue2[0] < 7 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Consider getting at least 7 hours of sleep
                    </p>
                  )}

                <Button
                  onClick={() =>
                    handleSurveyAnswer(
                      currentQuestionIndex === 0 ? sliderValue1 : sliderValue2
                    )
                  }
                  className="w-full mt-4"
                >
                  Continue
                </Button>
              </div>
            ) : showFollowUp ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Please tell us more about your situation:
                </p>
                <textarea
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-foreground resize-none"
                  placeholder="Share any additional details..."
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Skip - submit the answer without notes
                      handleSurveyAnswer(pendingAnswer)
                    }}
                    className="flex-1"
                  >
                    Skip
                  </Button>
                  <Button onClick={handleFollowUpSubmit} className="flex-1">
                    Continue
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentQuestion.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full text-left justify-start h-auto p-4 hover:bg-primary/10 hover:border-primary transition-all bg-transparent"
                    onClick={() => handleSurveyAnswer(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  if (currentView === 'chat') {
    return (
      <div className="h-screen bg-background flex flex-col max-w-md mx-auto relative">
        {/* Loading Overlay */}
        {isGeneratingSchedule && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card rounded-2xl p-8 shadow-2xl border border-border flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="font-semibold text-lg text-foreground mb-1">
                  Generating Your Schedule
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analyzing your conversation with Fred...
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-muted/40 to-muted/20 border-b border-border/50 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToMain}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-700 flex items-center justify-center overflow-hidden">
              <Image
                src="/images/butch-cougar.png"
                alt="Butch the Cougar"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">
                {SCHEDULING_AI.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {SCHEDULING_AI.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                (message.role as string) === 'user'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <div className="flex items-start gap-3 max-w-[80%]">
                {(message.role as string) === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <Image
                      src="/images/butch-cougar.png"
                      alt="Fred the Cougar"
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    (message.role as string) === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {(message as { content?: string }).content ||
                      message.parts?.map((part, index) => {
                        if (part.type === 'text') {
                          return <span key={index}>{part.text}</span>
                        }
                        return null
                      })}
                  </div>
                </div>
                {(message.role as string) === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium">You</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Error display */}
          {error && (
            <div className="flex justify-center">
              <div className="rounded-2xl px-4 py-3 bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error.message}</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator when AI is thinking */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Image
                    src="/images/butch-cougar.png"
                    alt="Butch the Cougar"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-muted text-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Fred is thinking...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-border/50 bg-background flex-shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                maxLength={300}
                onChange={handleTextareaInput}
                onKeyPress={handleKeyPress}
                placeholder={
                  isLoading
                    ? 'Fred is thinking...'
                    : 'Message Fred the Cougar...'
                }
                disabled={isLoading}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isLoading}
                size="sm"
                className={`absolute ${textareaHasOverflow ? 'right-5' : 'right-2'} bottom-2 h-8 w-8 p-0 rounded-full`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showTaskEditor) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTaskEditor(false)}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {editingTask ? 'Edit Task' : 'Add New Task'}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Display validation errors */}
          {taskFormErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">
                    Please fix the following errors:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {taskFormErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Task Name
            </label>
            <input
              type="text"
              value={taskForm.name}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter task name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Priority
            </label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map((priority) => (
                <Button
                  key={priority}
                  variant={
                    taskForm.priority === priority ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setTaskForm((prev) => ({ ...prev, priority }))}
                  className="flex-1"
                >
                  {priority === 'high' && (
                    <AlertCircle className="w-4 h-4 mr-1 text-red-500" />
                  )}
                  {priority === 'medium' && (
                    <AlertCircle className="w-4 h-4 mr-1 text-orange-500" />
                  )}
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Start Time (Optional)
              </label>
              <input
                type="time"
                value={taskForm.startTime || ''}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                End Time (Optional)
              </label>
              <input
                type="time"
                value={taskForm.endTime || ''}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, endTime: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={taskForm.dueDate}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Repeat
            </label>
            <div className="flex flex-wrap gap-2">
              {(['never', 'daily', 'weekly', 'monthly', 'custom'] as const).map(
                (type) => (
                  <Button
                    key={type}
                    variant={
                      (taskForm.repeatType ?? 'never') === type
                        ? 'default'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() =>
                      setTaskForm((prev) => ({
                        ...prev,
                        repeatType: type,
                        repeatDays: type === 'custom' ? prev.repeatDays ?? [] : undefined,
                      }))
                    }
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                )
              )}
            </div>
            {(taskForm.repeatType ?? 'never') === 'custom' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    [0, 'Sun'],
                    [1, 'Mon'],
                    [2, 'Tue'],
                    [3, 'Wed'],
                    [4, 'Thu'],
                    [5, 'Fri'],
                    [6, 'Sat'],
                  ] as const
                ).map(([dayNum, label]) => (
                  <Button
                    key={dayNum}
                    variant={
                      (taskForm.repeatDays ?? []).includes(dayNum)
                        ? 'default'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() => {
                      const current = taskForm.repeatDays ?? []
                      const next = current.includes(dayNum)
                        ? current.filter((d) => d !== dayNum)
                        : [...current, dayNum].sort((a, b) => a - b)
                      setTaskForm((prev) => ({ ...prev, repeatDays: next }))
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => setShowTaskEditor(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveTask}>
              {editingTask ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-muted/40 to-muted/20 rounded-3xl p-6 mb-6 border border-border/50 shadow-lg relative">
        <h3 className="text-sm font-semibold text-foreground mb-4 text-center">
          AI Scheduling Assistant
        </h3>
        <div className="flex justify-center">
          <button
            onClick={handleFredClick}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-background/60 transition-all duration-300 group hover:scale-105 active:scale-95"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-red-700 flex items-center justify-center shadow-xl group-hover:shadow-2xl transition-all duration-300 border-2 border-white/20 overflow-hidden">
                <Image
                  src="/images/butch-cougar.png"
                  alt="Butch the Cougar"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
              <div className="absolute -top-1 -right-1 text-xl">🐾</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                {SCHEDULING_AI.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {SCHEDULING_AI.description}
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground">
            {MONTHS[currentDateObj.getMonth()]} {currentDateObj.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-primary hover:bg-primary/10"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Calendar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Sync Calendar</DialogTitle>
                <DialogDescription className="break-words">
                  Add your iCal/ICS feed URL to pull events into your schedule.
                  Works with Google Calendar, Outlook, Apple Calendar, and more.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 min-w-0 overflow-hidden">
                <div className="flex gap-2 min-w-0">
                  <input
                    type="url"
                    placeholder="https://calendar.google.com/calendar/ical/..."
                    value={icsInputValue}
                    onChange={(e) => setIcsInputValue(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && (e.preventDefault(), handleAddCalendarUrl())
                    }
                    className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddCalendarUrl}
                    disabled={!icsInputValue.trim()}
                  >
                    Add
                  </Button>
                </div>
                {icsUrls.length > 0 && (
                  <div className="space-y-2 min-w-0 overflow-hidden">
                    <p className="text-sm font-medium text-foreground">
                      Calendar feeds ({icsUrls.length})
                    </p>
                    <ul className="space-y-2 max-h-32 overflow-y-auto min-w-0">
                      {icsUrls.map((url) => (
                        <li
                          key={url}
                          className="flex items-center justify-between gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 min-w-0"
                        >
                          <span className="flex-1 min-w-0 break-all">
                            {url}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveCalendarUrl(url)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {calendarSyncError && (
                  <p className="text-sm text-destructive">{calendarSyncError}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCalendarDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSyncCalendar}
                  disabled={isSyncingCalendar || icsUrls.length === 0}
                >
                  {isSyncingCalendar ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    'Sync Calendar'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset All Data</DialogTitle>
              <DialogDescription>
                This will permanently delete all your schedule data,
                preferences, and chat history. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReset}>
                Reset All Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Calendar */}
      <Card className="mb-6 p-4">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateWeek('prev')}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-foreground">
              Week of {weekDates[0].getDate()} - {weekDates[6].getDate()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateWeek('next')}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, index) => {
            const date = weekDates[index]
            const isSelected = selectedDay === index
            const isToday = date.toDateString() === new Date().toDateString()
            const dateString = formatDateLocal(date)

            // Filter tasks for this specific date, same logic as task display
            const dayTasks = (scheduleItems[day] || []).filter((item) => {
              // If task has no due date, show it (legacy behavior)
              if (!item.dueDate) {
                return true
              }
              // Only count tasks whose due date matches this specific date
              return item.dueDate === dateString
            })
            const hasActiveTasks = dayTasks.length > 0

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(index)}
                className={`p-3 rounded-lg text-center transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isToday
                    ? 'bg-primary/10 text-primary border-2 border-primary/20'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="text-xs font-medium">{day}</div>
                <div className="text-lg font-bold mt-1">{date.getDate()}</div>
                <div className="flex justify-center mt-1">
                  <div
                    className={`w-2 h-2 rounded-full transition-colors ${
                      hasActiveTasks ? 'bg-primary' : 'bg-transparent'
                    }`}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="mb-20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            {DAYS[selectedDay]}&apos;s Schedule
          </h2>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'todo' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('todo')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {viewMode === 'cards' ? (
          // Card View (original layout)
          <div className="space-y-3">
            {currentScheduleItems.map((item) => (
              <Card
                key={item.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleTaskClick(item)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
                        item.completed
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground hover:border-primary'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTaskCompletion(item.id, DAYS[selectedDay])
                      }}
                    />
                    <div className="flex-1">
                      <h3
                        className={`font-medium ${
                          item.completed
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.time || 'No specific time'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(item.priority)}
                  </div>
                </div>
              </Card>
            ))}

            {currentScheduleItems.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">
                  No scheduled items for this day
                </p>
              </Card>
            )}
          </div>
        ) : (
          // TODO List View (compact line-item style)
          <div className="space-y-2">
            {currentScheduleItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
                onClick={() => handleTaskClick(item)}
              >
                <button
                  className={`w-4 h-4 rounded border-2 transition-all hover:scale-110 flex items-center justify-center ${
                    item.completed
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground hover:border-primary'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTaskCompletion(item.id, DAYS[selectedDay])
                  }}
                >
                  {item.completed && (
                    <svg
                      className="w-2.5 h-2.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`font-medium truncate ${
                      item.completed
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {item.title}
                  </span>
                </div>
              </div>
            ))}

            {currentScheduleItems.length === 0 && (
              <div className="p-6 text-center rounded-lg border border-dashed border-border/50">
                <p className="text-muted-foreground">
                  No scheduled items for this day
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 p-4 z-10">
        <div className="max-w-md mx-auto">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-3 font-semibold shadow-lg"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setEditingTask(null)
              setTaskFormErrors([])
              setTaskForm({
                name: '',
                startTime: '',
                endTime: '',
                dueDate: '',
                priority: 'medium',
                repeatType: 'never',
                repeatDays: [],
              })
              setShowTaskEditor(true)
            }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Task to Schedule
          </Button>
        </div>
      </div>
    </div>
  )
}
