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
    question: "What's your preferred study schedule?",
    options: [
      'Morning (6-10 AM)',
      'Afternoon (12-4 PM)',
      'Evening (6-10 PM)',
      'Late Night (10 PM-2 AM)',
    ],
  },
  {
    id: 2,
    question: 'How many hours of sleep do you typically need?',
    options: ['6-7 hours', '7-8 hours', '8-9 hours', '9+ hours'],
  },
  {
    id: 3,
    question: "What's your preferred schedule view?",
    options: ['Daily Schedule', 'Weekly Schedule', 'Monthly Schedule'],
  },
  {
    id: 4,
    question: 'How do you prefer to break down large tasks?',
    options: [
      'Keep tasks whole',
      'Break into 30-min chunks',
      'Break into 1-hour chunks',
      'Let AI decide',
    ],
  },
  {
    id: 5,
    question: 'What type of reminders work best for you?',
    options: [
      'Visual notifications',
      'Sound alerts',
      'Gentle nudges',
      'No reminders',
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
  studySchedule: z.enum([
    'Morning (6-10 AM)',
    'Afternoon (12-4 PM)',
    'Evening (6-10 PM)',
    'Late Night (10 PM-2 AM)',
  ]),
  sleepHours: z.enum(['6-7 hours', '7-8 hours', '8-9 hours', '9+ hours']),
  scheduleView: z.enum([
    'Daily Schedule',
    'Weekly Schedule',
    'Monthly Schedule',
  ]),
  taskBreakdown: z.enum([
    'Keep tasks whole',
    'Break into 30-min chunks',
    'Break into 1-hour chunks',
    'Let AI decide',
  ]),
  reminderType: z.enum([
    'Visual notifications',
    'Sound alerts',
    'Gentle nudges',
    'No reminders',
  ]),
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
      .min(1, 'Start time is required')
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
    endTime: z
      .string()
      .min(1, 'End time is required')
      .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
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
    ),
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
    id: 1,
    text: "Go Cougs! I'm Butch, your WSU study companion! Ready to optimize your schedule and achieve your goals? Let me know how I can help!",
    sender: 'ai',
    timestamp: new Date(),
  },
]

export const DEFAULT_SCHEDULE_ITEMS: ScheduleItems = {
  Mon: [
    {
      id: 1,
      title: 'Morning workout',
      time: '7:00 AM - 8:00 AM',
      priority: 'high',
      completed: false,
    },
    {
      id: 2,
      title: 'Physics homework',
      time: '2:00 PM - 4:00 PM',
      priority: 'medium',
      completed: false,
    },
  ],
  Tue: [
    {
      id: 4,
      title: 'Lab report',
      time: '10:00 AM - 12:00 PM',
      priority: 'high',
      completed: false,
    },
    {
      id: 5,
      title: 'Study group',
      time: '4:00 PM - 6:00 PM',
      priority: 'medium',
      completed: false,
    },
  ],
  Wed: [
    {
      id: 6,
      title: 'Calculus quiz',
      time: '9:00 AM - 10:00 AM',
      priority: 'high',
      completed: false,
    },
    {
      id: 7,
      title: 'Gym session',
      time: '5:00 PM - 6:30 PM',
      priority: 'medium',
      completed: false,
    },
  ],
  Thu: [
    {
      id: 8,
      title: 'Project meeting',
      time: '11:00 AM - 12:00 PM',
      priority: 'medium',
      completed: false,
    },
    {
      id: 9,
      title: 'Grocery shopping',
      time: '3:00 PM - 4:00 PM',
      priority: 'low',
      completed: false,
    },
  ],
  Fri: [
    {
      id: 10,
      title: 'Engineering exam',
      time: '1:00 PM - 3:00 PM',
      priority: 'high',
      completed: false,
    },
    {
      id: 11,
      title: 'Social event',
      time: '7:00 PM - 9:00 PM',
      priority: 'low',
      completed: false,
    },
  ],
  Sat: [
    {
      id: 12,
      title: 'Laundry',
      time: '10:00 AM - 11:00 AM',
      priority: 'low',
      completed: false,
    },
    {
      id: 13,
      title: 'Call family',
      time: '2:00 PM - 3:00 PM',
      priority: 'medium',
      completed: false,
    },
  ],
  Sun: [
    {
      id: 14,
      title: 'Weekly planning',
      time: '9:00 AM - 10:00 AM',
      priority: 'medium',
      completed: false,
    },
    {
      id: 15,
      title: 'Meal prep',
      time: '4:00 PM - 6:00 PM',
      priority: 'low',
      completed: false,
    },
  ],
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
  const preferences = {
    studySchedule: surveyAnswers[0],
    sleepHours: surveyAnswers[1],
    scheduleView: surveyAnswers[2],
    taskBreakdown: surveyAnswers[3],
    reminderType: surveyAnswers[4],
  }

  const validation = validateUserPreferences(preferences)
  if (validation.success) {
    return validation.data
  }

  throw new Error(`Invalid user preferences: ${validation.errors.join(', ')}`)
}

export function createNewTask(
  taskForm: TaskForm,
  nextTaskId: number
): ScheduleItem {
  return {
    id: nextTaskId,
    title: taskForm.name,
    time: `${taskForm.startTime} - ${taskForm.endTime}`,
    priority: taskForm.priority,
    completed: false,
  }
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
