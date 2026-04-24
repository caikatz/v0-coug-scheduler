import type {
  AIGeneratedSchedule,
  AIScheduleBlock,
  ScheduleItems,
  ScheduleItem,
  ScheduleChange,
} from './schemas'
import { formatTime24To12, formatDateLocal } from './utils'
import { WSU_SEMESTER } from './constants'

const ABBREVIATION_MAP: Record<string, string> = {
  hist: 'history',
  bio: 'biology',
  chem: 'chemistry',
  phys: 'physics',
  math: 'mathematics',
  eng: 'english',
  sci: 'science',
  comp: 'computer',
  cs: 'computer science',
  psych: 'psychology',
  econ: 'economics',
  phil: 'philosophy',
  geo: 'geography',
  soc: 'sociology',
  anthro: 'anthropology',
  calc: 'calculus',
  stats: 'statistics',
  comm: 'communications',
}

export function normalizeTitle(title: string): string {
  const normalized = title.toLowerCase().trim()
  const words = normalized.split(/\s+/)

  const expandedWords = words.map((word) => {
    const cleanWord = word.replace(/[^a-z0-9]/g, '')
    return ABBREVIATION_MAP[cleanWord] || word
  })

  return expandedWords.join(' ')
}

const DAY_MAP: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

export function transformAIScheduleToItems(
  aiSchedule: AIGeneratedSchedule,
  weekDates: Date[],
  startingTaskId: number,
  semesterEndDate: string = WSU_SEMESTER.current.end
): ScheduleItems {
  const scheduleItems: ScheduleItems = {}

  let currentTaskId = startingTaskId
  const allWeeks = getAllWeeksUntilSemesterEnd(weekDates, semesterEndDate)
  allWeeks.pop()

  for (const daySchedule of aiSchedule.weekly_schedule || []) {
    const dayIndex = DAY_MAP[daySchedule.day]
    if (dayIndex === undefined) continue

    for (const block of daySchedule.blocks) {
      const weeksToPopulate = block.is_recurring ? allWeeks : [weekDates]

      for (const week of weeksToPopulate) {
        const dateForDay = week[dayIndex]
        const dateKey = formatDateLocal(dateForDay)

        const scheduleItem = convertBlockToItem(block, currentTaskId, dateKey)
        if (scheduleItem) {
          if (!scheduleItems[dateKey]) scheduleItems[dateKey] = []
          scheduleItems[dateKey].push(scheduleItem)
          currentTaskId++
        }
      }
    }
  }

  return scheduleItems
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

function convertBlockToItem(
  block: AIScheduleBlock,
  taskId: number,
  dueDate: string
): ScheduleItem | null {
  if (!block.start_time || !block.end_time) {
    return null
  }

  const startTime12 = formatTime24To12(block.start_time)
  const endTime12 = formatTime24To12(block.end_time)
  const priority = getPriorityForBlockType(block.type)
  const title = buildTitle(block)

  return {
    id: taskId,
    title,
    time: `${startTime12} - ${endTime12}`,
    dueDate,
    priority,
    completed: false,
  }
}

function getPriorityForBlockType(
  type: AIScheduleBlock['type']
): 'high' | 'medium' | 'low' {
  switch (type) {
    case 'class':
    case 'work':
      return 'high'
    case 'study':
    case 'athletic':
    case 'extracurricular':
      return 'medium'
    case 'personal':
      return 'low'
    default:
      return 'medium'
  }
}

function buildTitle(block: AIScheduleBlock): string {
  let title = block.title

  if (
    block.location &&
    !title.toLowerCase().includes(block.location.toLowerCase())
  ) {
    title += ` @ ${block.location}`
  }

  return title
}

function createDedupeKey(item: ScheduleItem, dateKey: string): string {
  const normalizedTitle = normalizeTitle(item.title)
  const time = item.time || 'no-time'
  return `${normalizedTitle}|${dateKey}|${time}`
}

export function mergeScheduleForWeek(
  existingSchedule: ScheduleItems,
  newSchedule: ScheduleItems,
  weekDates: Date[]
): ScheduleItems {
  const weekDateStrings = new Set(weekDates.map((date) => formatDateLocal(date)))

  const result: ScheduleItems = {}

  // Copy items from existing schedule that are NOT in this week
  for (const [dateKey, items] of Object.entries(existingSchedule)) {
    if (!weekDateStrings.has(dateKey)) {
      result[dateKey] = [...items]
    }
  }

  // Deduplicate and add new items for this week
  for (const dateKey of weekDateStrings) {
    const newItemKeys = new Set<string>()
    const deduplicatedNewItems: ScheduleItem[] = []

    for (const newItem of newSchedule[dateKey] || []) {
      const key = createDedupeKey(newItem, dateKey)
      if (!newItemKeys.has(key)) {
        newItemKeys.add(key)
        deduplicatedNewItems.push(newItem)
      }
    }

    result[dateKey] = deduplicatedNewItems
  }

  return result
}

export function applyScheduleChanges(
  existingSchedule: ScheduleItems,
  changes: ScheduleChange[],
  weekDates: Date[],
  startingTaskId: number,
  semesterEndDate: string = WSU_SEMESTER.current.end
): ScheduleItems {
  const updatedSchedule: ScheduleItems = {}
  for (const [key, items] of Object.entries(existingSchedule)) {
    updatedSchedule[key] = [...items]
  }

  let currentTaskId = startingTaskId

  for (const change of changes) {
    const dayIndex = DAY_MAP[change.day]
    if (dayIndex === undefined) continue

    switch (change.operation) {
      case 'remove':
        if (change.match_title) {
          for (const key of Object.keys(updatedSchedule)) {
            updatedSchedule[key] = updatedSchedule[key].filter(
              (item) =>
                !item.title
                  .toLowerCase()
                  .includes(change.match_title!.toLowerCase())
            )
          }
        }
        break

      case 'add':
        if (change.item) {
          const allWeeks = change.item.is_recurring
            ? getAllWeeksUntilSemesterEnd(weekDates, semesterEndDate)
            : [weekDates]

          for (const week of allWeeks) {
            const dateForDay = week[dayIndex]
            const dateKey = formatDateLocal(dateForDay)

            const newItem = convertBlockToItem(
              change.item,
              currentTaskId,
              dateKey
            )

            if (newItem) {
              if (!updatedSchedule[dateKey]) updatedSchedule[dateKey] = []
              const alreadyExists = updatedSchedule[dateKey].some((item) => {
                const sameTitle = normalizeTitle(item.title) === normalizeTitle(newItem.title)
                const sameTime = (item.time || '') === (newItem.time || '')
                const sameDate = (item.dueDate || '') === (newItem.dueDate || '')
                return sameTitle && sameTime && sameDate
              })

              if (!alreadyExists) {
                updatedSchedule[dateKey].push(newItem)
              }
              currentTaskId++
            }
          }
        }
        break

      case 'modify':
        if (change.match_title && change.item) {
          for (const key of Object.keys(updatedSchedule)) {
            updatedSchedule[key] = updatedSchedule[key].map((item) => {
              if (
                item.title
                  .toLowerCase()
                  .includes(change.match_title!.toLowerCase())
              ) {
                const startTime12 = formatTime24To12(change.item!.start_time)
                const endTime12 = formatTime24To12(change.item!.end_time)

                return {
                  ...item,
                  title: buildTitle(change.item!),
                  time: `${startTime12} - ${endTime12}`,
                  priority: getPriorityForBlockType(change.item!.type),
                }
              }
              return item
            })
          }
        }
        break
    }
  }

  // Sort each date's items by time
  for (const key of Object.keys(updatedSchedule)) {
    updatedSchedule[key].sort((a, b) => {
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time.localeCompare(b.time)
    })
  }

  return updatedSchedule
}
