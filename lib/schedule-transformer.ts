import type {
  AIGeneratedSchedule,
  AIScheduleBlock,
  ScheduleItems,
  ScheduleItem,
} from './schemas'
import { formatTime24To12 } from './schemas'

/**
 * Common abbreviation mappings for title normalization
 */
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

/**
 * Normalize a title for deduplication matching:
 * - Converts to lowercase
 * - Expands common abbreviations (e.g., "hist" -> "history")
 * - Preserves course numbers (e.g., "101", "202")
 * This allows "HIST 101" to match "history 101" but not "HIST 111"
 */
export function normalizeTitle(title: string): string {
  // Convert to lowercase
  let normalized = title.toLowerCase().trim()
  
  // Split into words to handle abbreviations
  const words = normalized.split(/\s+/)
  const expandedWords = words.map(word => {
    // Remove common punctuation but preserve alphanumeric content
    const cleanWord = word.replace(/[^a-z0-9]/g, '')
    
    // Check if it's an abbreviation we recognize
    if (ABBREVIATION_MAP[cleanWord]) {
      return ABBREVIATION_MAP[cleanWord]
    }
    
    return word
  })
  
  return expandedWords.join(' ')
}

/**
 * Transform AI-generated schedule blocks into ScheduleItems format
 * and assign them to specific dates in the current week
 */
export function transformAIScheduleToItems(
  aiSchedule: AIGeneratedSchedule,
  weekDates: Date[], // Array of 7 Date objects [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  startingTaskId: number
): ScheduleItems {
  const scheduleItems: ScheduleItems = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  }

  const dayMap: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  }

  let currentTaskId = startingTaskId

  // Process each day's schedule
  for (const daySchedule of aiSchedule.weekly_schedule) {
    const dayIndex = dayMap[daySchedule.day]
    if (dayIndex === undefined) continue

    const dayKey = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex]
    const dateForDay = weekDates[dayIndex]
    const dueDateString = dateForDay.toISOString().split('T')[0] // YYYY-MM-DD

    // Convert each block to a ScheduleItem
    for (const block of daySchedule.blocks) {
      const scheduleItem = convertBlockToItem(
        block,
        currentTaskId,
        dueDateString
      )
      // Only add items that have valid times
      if (scheduleItem) {
        scheduleItems[dayKey].push(scheduleItem)
        currentTaskId++
      }
    }
  }

  return scheduleItems
}

/**
 * Convert a single AI schedule block to a ScheduleItem
 * Returns null if the block doesn't have valid start/end times
 */
function convertBlockToItem(
  block: AIScheduleBlock,
  taskId: number,
  dueDate: string
): ScheduleItem | null {
  // Validate that we have both start and end times
  if (!block.start_time || !block.end_time) {
    return null
  }
  
  // Convert 24-hour times to 12-hour format
  const startTime12 = formatTime24To12(block.start_time)
  const endTime12 = formatTime24To12(block.end_time)

  // Determine priority based on block type
  const priority = getPriorityForBlockType(block.type)

  // Build title with type context if needed
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

/**
 * Determine priority level based on block type
 */
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

/**
 * Build a descriptive title for the schedule item
 */
function buildTitle(block: AIScheduleBlock): string {
  let title = block.title

  // Add location if provided and not already in title
  if (
    block.location &&
    !title.toLowerCase().includes(block.location.toLowerCase())
  ) {
    title += ` @ ${block.location}`
  }

  return title
}

/**
 * Create a deduplication key from a schedule item
 * Key format: "normalized-title|day|time"
 */
function createDedupeKey(item: ScheduleItem, day: string): string {
  const normalizedTitle = normalizeTitle(item.title)
  const time = item.time || 'no-time'
  return `${normalizedTitle}|${day}|${time}`
}

/**
 * Clear all tasks for the current week dates and merge new schedule
 * with deduplication based on normalized title, day, and time
 */
export function mergeScheduleForWeek(
  existingSchedule: ScheduleItems,
  newSchedule: ScheduleItems,
  weekDates: Date[]
): ScheduleItems {
  const weekDateStrings = weekDates.map(
    (date) => date.toISOString().split('T')[0]
  )

  const clearedSchedule: ScheduleItems = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  }

  // For each day, keep only tasks that are NOT in the current week
  const days: Array<keyof ScheduleItems> = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ]

  for (const day of days) {
    // Get existing tasks from other weeks
    const otherWeekTasks = (existingSchedule[day] || []).filter((task) => {
      // Keep tasks with no dueDate (legacy tasks)
      if (!task.dueDate) return true
      // Keep tasks from other weeks
      return !weekDateStrings.includes(task.dueDate)
    })

    // Build a set of deduplication keys from new items
    const newItemKeys = new Set<string>()
    const deduplicatedNewItems: ScheduleItem[] = []
    
    for (const newItem of newSchedule[day] || []) {
      const key = createDedupeKey(newItem, day)
      
      // Only add if we haven't seen this exact item before
      if (!newItemKeys.has(key)) {
        newItemKeys.add(key)
        deduplicatedNewItems.push(newItem)
      }
    }

    // Combine other week tasks with deduplicated new items
    clearedSchedule[day] = [...otherWeekTasks, ...deduplicatedNewItems]
  }

  return clearedSchedule
}
