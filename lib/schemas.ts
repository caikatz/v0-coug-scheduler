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

// Repeat type for recurring tasks
export const RepeatTypeSchema = z.enum([
  'never',
  'daily',
  'weekly',
  'monthly',
  'custom',
])
export type RepeatType = z.infer<typeof RepeatTypeSchema>

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
    repeatType: RepeatTypeSchema.default('never'),
    repeatDays: z.array(z.number().min(0).max(6)).optional(), // 0=Sun, 1=Mon, ..., 6=Sat
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
  .refine(
    (data) => {
      if (data.repeatType === 'custom') {
        return (
          data.repeatDays &&
          data.repeatDays.length > 0
        )
      }
      return true
    },
    {
      message: 'Select at least one day for custom repeat',
      path: ['repeatDays'],
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
  dueDate: z.string().optional(),
  priority: PrioritySchema,
  completed: z.boolean(),
  source: z.enum(['ical']).optional(), // 'ical' when imported from ICS feed
  icalUid: z.string().optional(), // UID from ICS for deduplication
  icalUrl: z.string().optional(), // ICS feed URL for per-feed removal
  repeatType: RepeatTypeSchema.optional(),
  repeatDays: z.array(z.number().min(0).max(6)).optional(),
  repeatGroupId: z.number().optional(), // links occurrences of same recurring task
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
  onboardingCompleted: z.boolean().default(false),
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

// AI-generated schedule schemas
export const AIScheduleBlockSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/), // "09:00"
  end_time: z.string().regex(/^\d{2}:\d{2}$/), // "10:20"
  type: z.enum([
    'class',
    'study',
    'work',
    'athletic',
    'extracurricular',
    'personal',
  ]),
  title: z.string(),
  location: z.string().optional(),
  credits: z.number().optional(),
  is_recurring: z.boolean()
})

export const AIDayScheduleSchema = z.object({
  day: z.string(),
  blocks: z.array(AIScheduleBlockSchema),
})

export const AIScheduleSummarySchema = z.object({
  total_credits: z.number(),
  study_hours: z.number(),
  class_hours: z.number(),
  work_hours: z.number(),
  other_hours: z.number(),
  total_committed: z.number(),
  available_hours: z.number(),
  buffer_hours: z.number(),
})

export const ScheduleUpdateTypeSchema = z.enum(['none', 'partial', 'full'])

export const ScheduleChangeSchema = z.object({
  operation: z.enum(['add', 'remove', 'modify']),
  day: z.string(),
  item: AIScheduleBlockSchema.optional(), // For add/modify
  match_title: z.string().optional(), // For remove/modify - indentifies which item
})

export const AIGeneratedScheduleSchema = z.object({
  update_type: ScheduleUpdateTypeSchema,
  // For 'full' update - complete new schedule
  weekly_schedule: z.array(AIDayScheduleSchema).optional(),
  // For 'partial' update - list of changes
  changes: z.array(ScheduleChangeSchema).optional(),
  schedule_summary: AIScheduleSummarySchema,
  notes: z.array(z.string()),
})

// Type exports for AI schedule
export type AIScheduleBlock = z.infer<typeof AIScheduleBlockSchema>
export type AIDaySchedule = z.infer<typeof AIDayScheduleSchema>
export type AIScheduleSummary = z.infer<typeof AIScheduleSummarySchema>
export type AIGeneratedSchedule = z.infer<typeof AIGeneratedScheduleSchema>
export type ScheduleChange = z.infer<typeof ScheduleChangeSchema>