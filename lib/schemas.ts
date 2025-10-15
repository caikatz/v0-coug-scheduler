import { z } from 'zod'

// Schema version for data migration
export const SCHEMA_VERSION = '1.0.0'

// Data migration functions
export function migrateData<T>(
  data: unknown,
  currentVersion: string,
  targetSchema: z.ZodSchema<T>
): T {
  // If versions match, validate and return
  if (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    data.version === SCHEMA_VERSION
  ) {
    const result = targetSchema.safeParse(data)
    if (result.success) {
      return result.data
    }
  }

  // Handle version migrations here
  let migratedData = data

  // Example: Migration from version 0.9.0 to 1.0.0
  if (
    !data ||
    typeof data !== 'object' ||
    !('version' in data) ||
    (data as { version?: string }).version !== SCHEMA_VERSION
  ) {
    migratedData = migrateToV1_0_0(data)
  }

  // Validate the final migrated data
  const result = targetSchema.safeParse(migratedData)
  if (result.success) {
    return result.data
  }

  // If all migrations fail, throw error with details
  throw new Error(
    `Data migration failed: ${result.error.errors
      .map((e) => e.message)
      .join(', ')}`
  )
}

function migrateToV1_0_0(data: unknown): Record<string, unknown> {
  // Handle migration from pre-versioned data to v1.0.0
  if (!data || typeof data !== 'object') return { version: '1.0.0' }

  return {
    ...(data as Record<string, unknown>),
    version: '1.0.0',
    // Add any specific field migrations here
  }
}

// Survey questions for onboarding
export const SURVEY_QUESTIONS = [
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
      'No, I need to develop a new sleep routine',
      'Somewhat, but I need to adjust it for college',
      'Yes, but it can be improved',
      'Yes, it needs no improvements',
    ],
    requiresFollowUp: [0, 1, 2], // Indices that require follow-up
  },
  {
    id: 4,
    question: 'What is your preferred planner view?',
    type: 'multiple-choice' as const,
    options: [
      'Daily to-do list',
      'Weekly to-do list',
      'Bulleted monthly overview',
      'Daily schedule',
      'Weekly schedule',
      'Monthly calendar',
    ],
    showPreview: true,
  },
  {
    id: 5,
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
    id: 6,
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
    id: 7,
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

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

// Basic enums and constants
export const PrioritySchema = z.enum(['high', 'medium', 'low'])
export const MessageSenderSchema = z.enum(['user', 'ai'])
export const ViewSchema = z.enum(['main', 'chat', 'task-editor'])

// User preferences from survey with validation
export const UserPreferencesSchema = z.object({
  productiveHours: z.string(), // Format: "9:00-17:00"
  sleepHours: z.string(), // Format: "23:00-7:00"
  sleepScheduleWorking: z.string(),
  sleepScheduleNotes: z.string().optional(),
  plannerView: z.string(),
  taskBreakdown: z.string(),
  studyHabitsWorking: z.string(),
  studyHabitsNotes: z.string().optional(),
  reminderType: z.string(),
})

// Task form for creating/editing tasks with validation
export const TaskFormSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Task name is required')
      .max(100, 'Task name too long'),
    startTime: z
      .string()
      .optional()
      .refine(
        (time) => !time || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time),
        'Invalid time format'
      ),
    endTime: z
      .string()
      .optional()
      .refine(
        (time) => !time || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time),
        'Invalid time format'
      ),
    dueDate: z.string().optional(),
    priority: PrioritySchema,
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime < data.endTime
      }
      return true
    },
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )

// Schedule item (individual task/event) with validation
export const ScheduleItemSchema = z.object({
  id: z.number().positive(),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  time: z
    .string()
    .regex(
      /^([01]?[0-9]|2[0-3]):[0-5][0-9] (AM|PM) - ([01]?[0-9]|2[0-3]):[0-5][0-9] (AM|PM)$/,
      'Invalid time format'
    )
    .optional(),
  priority: PrioritySchema,
  completed: z.boolean(),
})

// Chat message with validation
export const MessageSchema = z.object({
  id: z.number().positive(),
  text: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message too long'),
  sender: MessageSenderSchema,
  timestamp: z.union([z.string().transform((str) => new Date(str)), z.date()]), // Handle both stored ISO strings and Date objects
})

// Schedule items grouped by day
export const ScheduleItemsSchema = z.record(
  z.string(), // day key (Mon, Tue, etc.)
  z.array(ScheduleItemSchema)
)

// Application state that should be persisted
export const AppStateSchema = z.object({
  version: z.string(),

  // Survey and preferences
  showSurvey: z.boolean(),
  currentQuestionIndex: z.number(),
  surveyAnswers: z.array(z.string()),
  userPreferences: UserPreferencesSchema.nullable(),

  // Calendar and navigation
  currentDate: z.union([
    z.string().transform((str) => new Date(str)),
    z.date(),
  ]), // Handle both stored ISO strings and Date objects
  selectedDay: z.number(),

  // Task management
  scheduleItems: ScheduleItemsSchema,
  nextTaskId: z.number(),

  // Chat
  messages: z.array(MessageSchema),

  // UI state (optional to persist)
  currentView: ViewSchema,
})

// Individual storage schemas for granular updates
export const SurveyStateSchema = z.object({
  version: z.string(),
  showSurvey: z.boolean(),
  currentQuestionIndex: z.number(),
  surveyAnswers: z.array(z.string()),
  userPreferences: UserPreferencesSchema.nullable(),
})

export const ScheduleStateSchema = z.object({
  version: z.string(),
  scheduleItems: ScheduleItemsSchema,
  nextTaskId: z.number(),
})

export const ChatStateSchema = z.object({
  version: z.string(),
  messages: z.array(MessageSchema),
})

export const NavigationStateSchema = z.object({
  version: z.string(),
  currentDate: z.union([
    z.string().transform((str) => new Date(str)),
    z.date(),
  ]), // Handle both stored ISO strings and Date objects
  selectedDay: z.number(),
  currentView: ViewSchema,
})

// Type exports (inferred from schemas)
export type UserPreferences = z.infer<typeof UserPreferencesSchema>
export type TaskForm = z.infer<typeof TaskFormSchema>
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>
export type Message = z.infer<typeof MessageSchema>
export type ScheduleItems = z.infer<typeof ScheduleItemsSchema>
export type AppState = z.infer<typeof AppStateSchema>
export type SurveyState = z.infer<typeof SurveyStateSchema>
export type ScheduleState = z.infer<typeof ScheduleStateSchema>
export type ChatState = z.infer<typeof ChatStateSchema>
export type NavigationState = z.infer<typeof NavigationStateSchema>
export type Priority = z.infer<typeof PrioritySchema>
export type MessageSender = z.infer<typeof MessageSenderSchema>
export type View = z.infer<typeof ViewSchema>

// Default values
export const DEFAULT_MESSAGES: Message[] = [
  {
    id: new Date().getMilliseconds(),
    text: "Go Cougs! I'm Butch, your WSU study companion! Ready to optimize your schedule and achieve your goals? Let me know how I can help!",
    sender: 'ai',
    timestamp: new Date(),
  },
]

export const DEFAULT_SCHEDULE_ITEMS: ScheduleItems = {
  Mon: [],
  Tue: [],
  Wed: [],
  Thu: [],
  Fri: [],
  Sat: [],
  Sun: [],
}

// Utility functions with Zod validation
export function validateTaskForm(
  taskForm: unknown
): { success: true; data: TaskForm } | { success: false; errors: string[] } {
  const result = TaskFormSchema.safeParse(taskForm)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    ),
  }
}

export function validateMessage(
  message: unknown
): { success: true; data: Message } | { success: false; errors: string[] } {
  const result = MessageSchema.safeParse(message)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    ),
  }
}

export function validateUserPreferences(
  prefs: unknown
):
  | { success: true; data: UserPreferences }
  | { success: false; errors: string[] } {
  const result = UserPreferencesSchema.safeParse(prefs)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    ),
  }
}

// Utility functions
export function getCurrentDayIndex(): number {
  const today = new Date()
  return (today.getDay() + 6) % 7
}

export function calculateSuccessPercentage(
  scheduleItems: ScheduleItems
): number {
  const allTasks = Object.values(scheduleItems).flat()
  const completedTasks = allTasks.filter((task) => task.completed)
  const totalTasks = allTasks

  if (totalTasks.length === 0) return 0
  return Math.round((completedTasks.length / totalTasks.length) * 100)
}

export function processUserPreferences(
  surveyAnswers: string[]
): UserPreferences {
  // Parse answers with potential notes (format: "answer | Notes: text")
  const parseAnswer = (answer: string): { value: string; notes?: string } => {
    if (answer.includes(' | Notes: ')) {
      const [value, notes] = answer.split(' | Notes: ')
      return { value, notes }
    }
    return { value: answer }
  }

  const sleepSchedule = parseAnswer(surveyAnswers[2])
  const studyHabits = parseAnswer(surveyAnswers[5])

  const preferences = {
    productiveHours: surveyAnswers[0], // "9:00-17:00"
    sleepHours: surveyAnswers[1], // "23:00-7:00"
    sleepScheduleWorking: sleepSchedule.value,
    sleepScheduleNotes: sleepSchedule.notes,
    plannerView: surveyAnswers[3],
    taskBreakdown: surveyAnswers[4],
    studyHabitsWorking: studyHabits.value,
    studyHabitsNotes: studyHabits.notes,
    reminderType: surveyAnswers[6],
  }

  const validation = validateUserPreferences(preferences)
  if (validation.success) {
    return validation.data
  }

  throw new Error(`Invalid user preferences: ${validation.errors.join(', ')}`)
}

// Utility function to convert 24-hour format to 12-hour format with AM/PM
export function formatTime24To12(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Utility function to convert 12-hour format with AM/PM to 24-hour format
export function convertTo24Hour(time12: string): string {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return ''

  const [, hours, minutes, period] = match
  let hour24 = parseInt(hours, 10)

  if (period.toUpperCase() === 'AM' && hour24 === 12) {
    hour24 = 0
  } else if (period.toUpperCase() === 'PM' && hour24 !== 12) {
    hour24 += 12
  }

  return `${hour24.toString().padStart(2, '0')}:${minutes}`
}

export function createNewTask(
  taskForm: TaskForm,
  nextTaskId: number
): ScheduleItem {
  const hasTimeRange = taskForm.startTime && taskForm.endTime

  const scheduleItem: ScheduleItem = {
    id: nextTaskId,
    title: taskForm.name,
    priority: taskForm.priority,
    completed: false,
  }

  if (hasTimeRange) {
    const startTime12 = formatTime24To12(taskForm.startTime!)
    const endTime12 = formatTime24To12(taskForm.endTime!)
    scheduleItem.time = `${startTime12} - ${endTime12}`
  }

  return scheduleItem
}

export function updateTaskCompletion(
  scheduleItems: ScheduleItems,
  taskId: number,
  dayKey: string
): ScheduleItems {
  return {
    ...scheduleItems,
    [dayKey]: (scheduleItems[dayKey] || []).map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ),
  }
}

export function createChatMessage(
  text: string,
  sender: MessageSender
): Message {
  const message = {
    id: Date.now(),
    text: text.trim(),
    sender,
    timestamp: new Date(),
  }

  const validation = validateMessage(message)
  if (validation.success) {
    return validation.data
  }

  throw new Error(`Invalid message: ${validation.errors.join(', ')}`)
}
