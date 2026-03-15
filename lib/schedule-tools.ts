import { z } from 'zod'
import type { ScheduleItems, ScheduleItem } from './schemas'
import { formatTime24To12, getWeekDates, formatDateLocal } from './utils'
import { WSU_SEMESTER } from './constants'

const DAY_ENUM = z.enum([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
])

const ITEM_TYPE_ENUM = z.enum([
  'class',
  'study',
  'work',
  'athletic',
  'extracurricular',
  'personal',
])

const DAY_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

// --- Input Schemas ---

export const GetScheduleInputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional()
    .describe('Specific date in YYYY-MM-DD format. If provided, return schedule for only this date.'),
  day: DAY_ENUM.optional().describe(
    'Day of the week. If provided (and no date), return schedule for this day in the current week.'
  ),
})

export const ScheduleItemInputSchema = z.object({
  title: z.string().min(1).describe('Title of the event (e.g. "CPTS 321 Lecture")'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional()
    .describe('Specific date in YYYY-MM-DD format, e.g. "2026-03-15". Use this for one-off events on a specific date. Either date or day must be provided.'),
  day: DAY_ENUM
    .optional()
    .describe('Day of the week, e.g. "Monday". Use for recurring items or when no specific date is known. Either date or day must be provided.'),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM in 24-hour format')
    .describe('Start time in 24h format, e.g. "09:00"'),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM in 24-hour format')
    .optional()
    .describe('End time in 24h format, e.g. "10:20". Defaults to 1 hour after start_time if omitted.'),
  type: ITEM_TYPE_ENUM
    .optional()
    .describe('Category of the schedule item. Defaults to "personal" if omitted.'),
  is_recurring: z
    .boolean()
    .optional()
    .describe('Whether this item repeats every week until semester end. Defaults to false. Requires day (not date) when true.'),
  location: z.string().optional().describe('Optional location'),
})

export const CreateScheduleItemsInputSchema = z.object({
  items: z
    .array(ScheduleItemInputSchema)
    .min(1)
    .describe('One or more schedule items to add'),
})

export const RemoveScheduleItemsInputSchema = z.object({
  match_titles: z
    .array(z.string().min(1))
    .min(1)
    .describe('Titles (or partial matches) of items to remove'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional()
    .describe('Specific date in YYYY-MM-DD format. If provided, only remove items on this date.'),
  day: DAY_ENUM.optional().describe(
    'Day of the week. If provided (and no date), only remove items on this day in the current week.'
  ),
})

// --- Result Types ---

export interface GetScheduleResult {
  success: boolean
  schedule: Record<string, { id: number; title: string; time?: string }[]>
  nextTaskId: number
}

export interface CreateScheduleItemsResult {
  success: boolean
  created: { event_id: string; title: string; date: string; time: string }[]
  conflicts: string[]
}

export interface RemoveScheduleItemsResult {
  success: boolean
  removed_count: number
  match_titles: string[]
}

// --- Helpers ---

function parseTimeToMinutes(time24: string): number {
  const [h, m] = time24.split(':').map(Number)
  return h * 60 + m
}

function addHourTo24(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const newH = Math.min(h + 1, 23)
  return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function checkOverlaps(
  schedule: ScheduleItems,
  dateKey: string,
  startMin: number,
  endMin: number,
): string[] {
  const conflicts: string[] = []
  for (const item of schedule[dateKey] || []) {
    if (!item.time) continue

    const match = item.time.match(
      /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/
    )
    if (!match) continue

    let h1 = parseInt(match[1])
    const m1 = parseInt(match[2])
    if (match[3] === 'PM' && h1 !== 12) h1 += 12
    if (match[3] === 'AM' && h1 === 12) h1 = 0
    const existStart = h1 * 60 + m1

    let h2 = parseInt(match[4])
    const m2 = parseInt(match[5])
    if (match[6] === 'PM' && h2 !== 12) h2 += 12
    if (match[6] === 'AM' && h2 === 12) h2 = 0
    const existEnd = h2 * 60 + m2

    if (startMin < existEnd && endMin > existStart) {
      conflicts.push(
        `"${item.title}" (${item.time}) on ${dateKey}`
      )
    }
  }
  return conflicts
}

function getPriority(type: string): 'high' | 'medium' | 'low' {
  switch (type) {
    case 'class':
    case 'work':
      return 'high'
    case 'study':
    case 'athletic':
    case 'extracurricular':
      return 'medium'
    default:
      return 'low'
  }
}

function getAllWeeksUntilSemesterEnd(
  currentWeekDates: Date[],
  semesterEndDate: string
): Date[][] {
  const weeks: Date[][] = []
  const endDate = new Date(semesterEndDate)
  const weekStart = new Date(currentWeekDates[0])

  while (weekStart <= endDate) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      week.push(day)
    }
    weeks.push(week)
    weekStart.setDate(weekStart.getDate() + 7)
  }

  return weeks
}

// --- Execute Functions ---

export function executeGetSchedule(
  schedule: ScheduleItems,
  nextTaskId: number,
  input: z.infer<typeof GetScheduleInputSchema>,
  currentDate: Date
): GetScheduleResult {
  const result: GetScheduleResult = {
    success: true,
    schedule: {},
    nextTaskId,
  }

  if (input.date) {
    const dateKey = input.date
    result.schedule[dateKey] = (schedule[dateKey] || []).map((item) => ({
      id: item.id,
      title: item.title,
      time: item.time,
    }))
  } else if (input.day) {
    const dayIdx = DAY_INDEX[input.day]
    const weekDates = getWeekDates(currentDate)
    const dateKey = formatDateLocal(weekDates[dayIdx])
    result.schedule[dateKey] = (schedule[dateKey] || []).map((item) => ({
      id: item.id,
      title: item.title,
      time: item.time,
    }))
  } else {
    const weekDates = getWeekDates(currentDate)
    for (const date of weekDates) {
      const dateKey = formatDateLocal(date)
      const items = schedule[dateKey] || []
      if (items.length > 0) {
        result.schedule[dateKey] = items.map((item) => ({
          id: item.id,
          title: item.title,
          time: item.time,
        }))
      }
    }
  }

  return result
}

export function executeCreateScheduleItems(
  schedule: ScheduleItems,
  nextTaskId: number,
  input: z.infer<typeof CreateScheduleItemsInputSchema>,
  currentDate: Date
): { result: CreateScheduleItemsResult; updatedSchedule: ScheduleItems; newNextTaskId: number } {
  const updatedSchedule: ScheduleItems = {}
  for (const key of Object.keys(schedule)) {
    updatedSchedule[key] = [...schedule[key]]
  }

  const created: CreateScheduleItemsResult['created'] = []
  const allConflicts: string[] = []
  let currentId = nextTaskId
  const weekDates = getWeekDates(currentDate)

  for (const item of input.items) {
    if (!item.date && !item.day) continue

    const endTime = item.end_time ?? addHourTo24(item.start_time)
    const type = item.type ?? 'personal'
    const isRecurring = item.is_recurring ?? false

    const startMin = parseTimeToMinutes(item.start_time)
    const endMin = parseTimeToMinutes(endTime)

    const startTime12 = formatTime24To12(item.start_time)
    const endTime12 = formatTime24To12(endTime)
    const timeStr = `${startTime12} - ${endTime12}`
    let title = item.title
    if (item.location && !title.toLowerCase().includes(item.location.toLowerCase())) {
      title += ` @ ${item.location}`
    }

    let skippedDueToConflict = false
    let resultDateKey = item.date ?? item.day ?? ''

    if (item.date && !isRecurring) {
      const dateKey = item.date

      const conflicts = checkOverlaps(updatedSchedule, dateKey, startMin, endMin)
      if (conflicts.length > 0) {
        allConflicts.push(
          ...conflicts.map((c) => `${title} conflicts with ${c}`)
        )
        skippedDueToConflict = true
      } else {
        const newItem: ScheduleItem = {
          id: currentId,
          title,
          time: timeStr,
          dueDate: dateKey,
          priority: getPriority(type),
          completed: false,
        }
        if (!updatedSchedule[dateKey]) updatedSchedule[dateKey] = []
        updatedSchedule[dateKey].push(newItem)
        currentId++
      }

      resultDateKey = dateKey
    } else {
      const dayIdx = item.day ? DAY_INDEX[item.day] : undefined
      if (dayIdx === undefined) continue

      const weeksToPopulate = isRecurring
        ? getAllWeeksUntilSemesterEnd(weekDates, WSU_SEMESTER.current.end)
        : [weekDates]

      for (const week of weeksToPopulate) {
        const dateForDay = week[dayIdx]
        if (!dateForDay) continue
        const dateKey = formatDateLocal(dateForDay)

        const conflicts = checkOverlaps(updatedSchedule, dateKey, startMin, endMin)
        if (conflicts.length > 0) {
          if (!skippedDueToConflict) {
            allConflicts.push(
              ...conflicts.map((c) => `${title} conflicts with ${c}`)
            )
            skippedDueToConflict = true
          }
          continue
        }

        const newItem: ScheduleItem = {
          id: currentId,
          title,
          time: timeStr,
          dueDate: dateKey,
          priority: getPriority(type),
          completed: false,
        }

        if (!updatedSchedule[dateKey]) updatedSchedule[dateKey] = []
        updatedSchedule[dateKey].push(newItem)

        created.push({
          event_id: `task-${currentId}`,
          title,
          date: dateKey,
          time: timeStr,
        })

        currentId++
      }
    }

    if (item.date && !isRecurring && !skippedDueToConflict) {
      created.push({
        event_id: `task-${currentId - 1}`,
        title,
        date: item.date,
        time: timeStr,
      })
    }
  }

  for (const key of Object.keys(updatedSchedule)) {
    updatedSchedule[key].sort((a, b) => {
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time.localeCompare(b.time)
    })
  }

  return {
    result: { success: true, created, conflicts: allConflicts },
    updatedSchedule,
    newNextTaskId: currentId,
  }
}

export function executeRemoveScheduleItems(
  schedule: ScheduleItems,
  input: z.infer<typeof RemoveScheduleItemsInputSchema>,
  currentDate: Date
): { result: RemoveScheduleItemsResult; updatedSchedule: ScheduleItems } {
  const updatedSchedule: ScheduleItems = {}
  let removedCount = 0

  const allKeys = Object.keys(schedule)
  const totalItems = allKeys.reduce((sum, k) => sum + schedule[k].length, 0)
  console.log('[RemoveTool] Schedule has', allKeys.length, 'date keys,', totalItems, 'total items')
  console.log('[RemoveTool] Match titles:', JSON.stringify(input.match_titles))

  let dateKeysToCheck: string[] | null = null
  if (input.date) {
    dateKeysToCheck = [input.date]
    console.log('[RemoveTool] Scoped to date:', input.date)
  } else if (input.day) {
    const dayIdx = DAY_INDEX[input.day]
    const weekDates = getWeekDates(currentDate)
    dateKeysToCheck = [formatDateLocal(weekDates[dayIdx])]
    console.log('[RemoveTool] Scoped to day:', input.day, '-> date key:', dateKeysToCheck[0])
  } else {
    console.log('[RemoveTool] No date/day filter — checking all keys')
  }

  if (allKeys.length === 0) {
    console.log('[RemoveTool] EMPTY SCHEDULE — nothing to remove. Client may not be sending schedule data.')
  }

  if (dateKeysToCheck && allKeys.length > 0 && !allKeys.some((k) => dateKeysToCheck!.includes(k))) {
    console.log('[RemoveTool] Date key', dateKeysToCheck[0], 'NOT FOUND in schedule. Available keys:', allKeys.join(', '))
  }

  for (const key of allKeys) {
    const items = schedule[key]
    if (dateKeysToCheck && !dateKeysToCheck.includes(key)) {
      updatedSchedule[key] = [...items]
      continue
    }

    console.log('[RemoveTool] Checking', key, '—', items.length, 'items:', items.map((i) => i.title).join(', '))

    const filtered = items.filter((item) => {
      const shouldRemove = input.match_titles.some((title) =>
        item.title.toLowerCase().includes(title.toLowerCase())
      )
      if (shouldRemove) {
        removedCount++
        console.log('[RemoveTool] MATCH — removing:', item.title, '(id:', item.id, ')')
      }
      return !shouldRemove
    })
    updatedSchedule[key] = filtered
  }

  if (removedCount === 0) {
    console.log('[RemoveTool] No items removed. Possible reasons:')
    if (allKeys.length === 0) {
      console.log('  - Schedule is empty (client sent no schedule data)')
    } else if (dateKeysToCheck) {
      console.log('  - Date filter', dateKeysToCheck[0], 'may not match any existing key')
      console.log('  - Or no item titles matched:', JSON.stringify(input.match_titles))
    } else {
      console.log('  - No item titles matched:', JSON.stringify(input.match_titles))
    }
  }

  return {
    result: { success: true, removed_count: removedCount, match_titles: input.match_titles },
    updatedSchedule,
  }
}
