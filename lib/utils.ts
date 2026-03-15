import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { validateUserPreferences } from './schemas'
import type { UserPreferences } from './schemas'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime24To12(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
}

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

export function getWeekDates(date: Date) {
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

export function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

export function getCurrentDayIndex(): number {
  const today = new Date()
  return (today.getDay() + 6) % 7
}

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function dateToDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return SHORT_DAY_NAMES[date.getDay()]
}

// Helper to convert slider value to hour string
export function sliderToHourString(value: number, questionId: number): string {
  if (questionId === 1) {
    const hour24 = `${value}:00`
    return formatTime24To12(hour24)
  } else {
    const actualHour = (21 + value) % 24
    const hour24 = `${actualHour}:00`
    return formatTime24To12(hour24)
  }
}

export function processUserPreferences(
  surveyAnswers: string[]
): UserPreferences {
  const parseAnswer = (answer: string): { value: string; notes?: string } => {
    if (answer.includes(' | Notes: ')) {
      const [value, notes] = answer.split(' | Notes: ')
      return { value, notes }
    }
    return { value: answer }
  }

  const sleepSchedule = parseAnswer(surveyAnswers[2])
  const studyHabits = parseAnswer(surveyAnswers[4])

  const preferences = {
    productiveHours: surveyAnswers[0],
    sleepHours: surveyAnswers[1],
    sleepScheduleWorking: sleepSchedule.value,
    sleepScheduleNotes: sleepSchedule.notes,
    plannerView: 'Daily schedule',
    taskBreakdown: surveyAnswers[3],
    studyHabitsWorking: studyHabits.value,
    studyHabitsNotes: studyHabits.notes,
    reminderType: surveyAnswers[5],
  }

  const validation = validateUserPreferences(preferences)
  if (validation.success) {
    return validation.data
  }

  throw new Error(`Invalid user preferences: ${validation.errors.join(', ')}`)
}
