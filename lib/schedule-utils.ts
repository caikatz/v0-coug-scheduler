import { validateMessage } from './schemas'
import { formatTime24To12, formatDateLocal } from './utils'
import type {
  TaskForm,
  ScheduleItem,
  ScheduleItems,
  Message,
  MessageSender,
} from './schemas'

export const DEFAULT_MESSAGES: Message[] = [
  {
    id: new Date().getMilliseconds(),
    text: "Hey there! I'm Fred, your friendly scheduling buddy! Ready to optimize your schedule and achieve your goals? Let me know how I can help!",
    sender: 'ai',
    timestamp: new Date(),
  },
]

export const DEFAULT_SCHEDULE_ITEMS: ScheduleItems = {}

/** Map getDay() (0=Sun, 1=Mon, ...) to our day keys */
const GET_DAY_KEY: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
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

/**
 * Expand a recurring task into multiple ScheduleItems keyed by date string.
 */
export function expandRecurringTasks(
  taskForm: TaskForm,
  nextTaskId: number,
  semesterEndDate: string
): { itemsByDate: ScheduleItems; nextId: number } {
  const baseItem = createNewTask(taskForm, nextTaskId)
  const startDateStr = taskForm.dueDate
  const repeatType = taskForm.repeatType ?? 'never'
  const repeatDays = taskForm.repeatDays ?? []

  const itemsByDate: ScheduleItems = {}

  if (!startDateStr || repeatType === 'never') {
    let dueDateStr: string
    if (startDateStr) {
      dueDateStr = startDateStr
    } else {
      const now = new Date()
      dueDateStr = formatDateLocal(now)
    }
    const item: ScheduleItem = {
      ...baseItem,
      dueDate: dueDateStr,
    }
    if (!itemsByDate[dueDateStr]) itemsByDate[dueDateStr] = []
    itemsByDate[dueDateStr].push(item)
    return { itemsByDate, nextId: nextTaskId + 1 }
  }

  const [sy, sm, sd] = startDateStr.split('-').map(Number)
  const startDate = new Date(sy, sm - 1, sd)
  const [ey, em, ed] = semesterEndDate.split('-').map(Number)
  const endDate = new Date(ey, em - 1, ed)
  if (startDate > endDate) return { itemsByDate, nextId: nextTaskId }

  const repeatGroupId = nextTaskId
  let currentId = nextTaskId

  const addItemForDate = (date: Date) => {
    const dueDateStr = formatDateLocal(date)
    const item: ScheduleItem & { repeatType?: string; repeatDays?: number[]; repeatGroupId?: number } = {
      ...baseItem,
      id: currentId,
      dueDate: dueDateStr,
      repeatType,
      repeatDays: repeatDays.length > 0 ? repeatDays : undefined,
      repeatGroupId,
    }
    if (!itemsByDate[dueDateStr]) itemsByDate[dueDateStr] = []
    itemsByDate[dueDateStr].push(item)
    currentId++
  }

  if (repeatType === 'daily') {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      addItemForDate(new Date(d))
    }
  } else if (repeatType === 'weekly') {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
      addItemForDate(new Date(d))
    }
  } else if (repeatType === 'monthly') {
    const dayOfMonth = startDate.getDate()
    let d = new Date(startDate)
    while (d <= endDate) {
      addItemForDate(new Date(d))
      const nextMonth = d.getMonth() + 1
      const lastDayOfNext = new Date(d.getFullYear(), nextMonth + 1, 0).getDate()
      d = new Date(d.getFullYear(), nextMonth, Math.min(dayOfMonth, lastDayOfNext))
    }
  } else if (repeatType === 'custom' && repeatDays.length > 0) {
    const selectedDaysSet = new Set(repeatDays)
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (selectedDaysSet.has(d.getDay())) {
        addItemForDate(new Date(d))
      }
    }
  }

  return { itemsByDate, nextId: currentId }
}

export function updateTaskCompletion(
  scheduleItems: ScheduleItems,
  taskId: number,
  dateKey: string
): ScheduleItems {
  return {
    ...scheduleItems,
    [dateKey]: (scheduleItems[dateKey] || []).map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ),
  }
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

export function detectOverlaps(schedule: ScheduleItems): { hasOverlap: boolean; conflicts: string[] } {
  const conflicts: string[] = []

  for (const [dateKey, dayItems] of Object.entries(schedule)) {
    const dayName = GET_DAY_KEY[new Date(dateKey + 'T00:00:00').getDay()] ?? dateKey

    for (let i = 0; i < dayItems.length; i++) {
      for (let j = i + 1; j < dayItems.length; j++) {
        const item1 = dayItems[i]
        const item2 = dayItems[j]

        // Only compare overlaps for items on the same explicit date.
        if (item1.dueDate && item2.dueDate && item1.dueDate !== item2.dueDate) {
          continue
        }

        if (!item1.time || !item2.time) continue

        const parseTime = (timeStr: string) => {
          const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
          if (!match) return null
          let hours = parseInt(match[1])
          const minutes = parseInt(match[2])
          const period = match[3]

          if (period === 'PM' && hours !== 12) hours += 12
          if (period === 'AM' && hours === 12) hours = 0

          return hours * 60 + minutes
        }

        const item1Times = item1.time.split(' - ')
        const item2Times = item2.time.split(' - ')

        const item1Start = parseTime(item1Times[0])
        const item1End = parseTime(item1Times[1])
        const item2Start = parseTime(item2Times[0])
        const item2End = parseTime(item2Times[1])

        if (
          item1Start === null ||
          item1End === null ||
          item2Start === null ||
          item2End === null
        ) {
          continue
        }

        const hasOverlap = (
          (item1Start < item2End && item1End > item2Start) ||
          (item2Start < item1End && item2End > item1Start)
        )

        if (hasOverlap) {
          conflicts.push(
            `${dayName}: "${item1.title}" (${item1.time}) overlaps with "${item2.title}" (${item2.time})`
          )
        }
      }
    }
  }

  return { hasOverlap: conflicts.length > 0, conflicts }
}
