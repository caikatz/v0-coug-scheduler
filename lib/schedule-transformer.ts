import {
  AIGeneratedSchedule,
  AIScheduleBlock,
  ScheduleItems,
  ScheduleItem,
  WSU_SEMESTER
} from './schemas'
import { formatTime24To12 } from './schemas'

/**
 * Transform AI-generated schedule blocks into ScheduleItems format
 * and assign them to specific dates in the current week
 */
export function transformAIScheduleToItems(
  aiSchedule: AIGeneratedSchedule,
  weekDates: Date[], // Array of 7 Date objects [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  startingTaskId: number,
  semesterEndDate: string = WSU_SEMESTER.current.end
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

  const allWeeks = getAllWeeksUntilSemesterEnd(weekDates, semesterEndDate)
  allWeeks.pop() // Don't include finals week

  // Process each day's schedule
  for (const daySchedule of aiSchedule.weekly_schedule) {
    const dayIndex = dayMap[daySchedule.day]
    if (dayIndex === undefined) continue

    const dayKey = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex]

    for (const block of daySchedule.blocks) {
      // Determine which weeks to populate
      const weeksToPopulate = block.is_recurring ? allWeeks : [weekDates]

      for (const week of weeksToPopulate) {
        const dateForDay = week[dayIndex]
        const dueDateString = dateForDay.toISOString().split('T')[0] // YYYY-MM-DD

        const scheduleItem = convertBlockToItem (
        block,
        currentTaskId,
        dueDateString
      )
      scheduleItems[dayKey].push(scheduleItem)
      currentTaskId++
      }
    }
  }

  return scheduleItems
}

/**
 * Get all weeks from current week until semester end
 * Returns array of week arrays (each week is 7 Date objects)
 */
function getAllWeeksUntilSemesterEnd(
  currentWeekDates: Date[],
  semesterEndDate: string
): Date[][] {
  const weeks: Date[][] = []
  const endDate = new Date(semesterEndDate)

  // Start with current week
  let weekStart = new Date(currentWeekDates[0])
  
  while (weekStart <= endDate) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
    }
    weeks.push(week)

    // Move to next week
    weekStart.setDate(weekStart.getDate() + 7)
  }
  
  return weeks
}

/**
 * Convert a single AI schedule block to a ScheduleItem
 */
function convertBlockToItem(
  block: AIScheduleBlock,
  taskId: number,
  dueDate: string
): ScheduleItem {
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
 * Clear all tasks for the current week dates and merge new schedule
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
    clearedSchedule[day] = (existingSchedule[day] || []).filter((task) => {
      // Keep tasks with no dueDate (legacy tasks)
      if (!task.dueDate) return true
      // Keep tasks from other weeks
      return !weekDateStrings.includes(task.dueDate)
    })

    // Add new schedule items for this day
    clearedSchedule[day].push(...(newSchedule[day] || []))
  }

  return clearedSchedule
}
