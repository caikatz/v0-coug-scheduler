/**
 * ICS (iCalendar) parser - converts ICS text to schedule-friendly events.
 * Uses ical.js when available; falls back to simple regex parsing for basic support.
 */

import type { ScheduleItem } from './schemas'
import { formatTime24To12 } from './schemas'

export interface ICalEvent {
  uid: string
  title: string
  start: Date
  end: Date
  isAllDay: boolean
  location?: string
}

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const GET_DAY_KEY: Record<number, (typeof DAY_KEYS)[number]> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

/**
 * Parse ICS content and extract events.
 * Supports both ical.js (when installed) and a lightweight fallback parser.
 */
export function parseICSEvents(icsContent: string): ICalEvent[] {
  try {
    // Try ical.js first (primary parser)
    const ICAL = require('ical.js')
    return parseWithIcalJs(ICAL, icsContent)
  } catch {
    // Fallback to simple regex-based parser for basic ICS support
    console.log('Falling back to regex-based parser (ical.js not found)')
    return parseWithRegex(icsContent)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseWithIcalJs(ICAL: any, icsContent: string): ICalEvent[] {
  const jCalData = ICAL.parse(icsContent)
  if (!jCalData || !Array.isArray(jCalData)) return []

  const events: ICalEvent[] = []
  const comp = new ICAL.Component(jCalData)

  const vevents = comp.getAllSubcomponents('vevent') as Array<{ getFirstPropertyValue: (n: string) => unknown; getFirstProperty: (n: string) => unknown; getFirstSubcomponent: (n: string) => unknown }>
  const rangeStart = new Date()
  rangeStart.setMonth(rangeStart.getMonth() - 1)
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 4) // ~5 months range

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)
    const uid = event.uid || `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`

    if (event.isRecurring()) {
      const iter = event.iterator()
      let occurrence = iter.next()
      let count = 0
      const maxOccurrences = 500
      while (occurrence && count < maxOccurrences) {
        const occurrenceTime = occurrence.toString()
        const occDate = new Date(occurrenceTime)
        if (occDate > rangeEnd) break

        const occurrenceEvent = event.getOccurrenceDetails(occurrence)
        if (occurrenceEvent && occDate >= rangeStart) {
          const start = occurrenceEvent.startDate?.toJSDate?.() ?? new Date(occurrenceTime)
          const end = occurrenceEvent.endDate?.toJSDate?.() ?? new Date(start.getTime() + 3600000)
          events.push({
            uid: `${uid}-${occurrenceTime}`,
            title: (occurrenceEvent.item?.summary ?? event.summary ?? 'Untitled Event').trim(),
            start,
            end,
            isAllDay: occurrenceEvent.startDate?.isDate ?? false,
            location: occurrenceEvent.item?.location ?? event.location,
          })
        }
        occurrence = iter.next()
        count++
      }
    } else {
      const start = event.startDate?.toJSDate?.() ?? new Date()
      const end = event.endDate?.toJSDate?.() ?? new Date(start.getTime() + 3600000)
      if (start >= rangeStart && start <= rangeEnd) {
        events.push({
          uid,
          title: (event.summary ?? 'Untitled Event').trim(),
          start,
          end,
          isAllDay: event.startDate?.isDate ?? false,
          location: event.location,
        })
      }
    }
  }

  return events
}

/**
 * Simple regex-based ICS parser fallback when ical.js is not available.
 * Handles basic VEVENT with SUMMARY, DTSTART, DTEND. Does not support RRULE.
 */
function parseWithRegex(icsContent: string): ICalEvent[] {
  const events: ICalEvent[] = []
  const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g
  const matches = icsContent.match(veventRegex) || []

  const rangeStart = new Date()
  rangeStart.setMonth(rangeStart.getMonth() - 1)
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 4)

  for (const block of matches) {
    const summary = extractProperty(block, 'SUMMARY')?.replace(/\\n/g, '\n').trim() ?? 'Untitled Event'
    const uid = extractProperty(block, 'UID') ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const dtstart = extractProperty(block, 'DTSTART')
    const dtend = extractProperty(block, 'DTEND')
    if (!dtstart) continue

    const start = parseICSTimestamp(dtstart)
    const end = dtend ? parseICSTimestamp(dtend) : new Date(start.getTime() + 3600000)
    const isAllDay = dtstart.length === 8 // DATE format YYYYMMDD

    if (start >= rangeStart && start <= rangeEnd) {
      events.push({ uid, title: summary, start, end, isAllDay })
    }
  }

  return events
}

function extractProperty(block: string, name: string): string | null {
  const regex = new RegExp(`${name}(?:;.[^:]*)?:([^\\r\\n]+)`, 'i')
  const match = block.match(regex)
  return match ? match[1].trim() : null
}

function parseICSTimestamp(value: string): Date {
  const cleaned = value.replace(/Z$/i, '').replace(/-/g, '').replace(/:/g, '')
  if (cleaned.length === 8) {
    const year = parseInt(cleaned.slice(0, 4), 10)
    const month = parseInt(cleaned.slice(4, 6), 10) - 1
    const day = parseInt(cleaned.slice(6, 8), 10)
    return new Date(year, month, day)
  }
  if (cleaned.length >= 14) {
    const year = parseInt(cleaned.slice(0, 4), 10)
    const month = parseInt(cleaned.slice(4, 6), 10) - 1
    const day = parseInt(cleaned.slice(6, 8), 10)
    const hour = parseInt(cleaned.slice(8, 10), 10)
    const min = parseInt(cleaned.slice(10, 12), 10)
    const sec = parseInt(cleaned.slice(12, 14), 10) || 0
    return new Date(year, month, day, hour, min, sec)
  }
  return new Date(value)
}

/**
 * Convert parsed ICS events to ScheduleItems and merge with existing schedule.
 * Events are keyed by day (Mon-Sun) and dueDate for date-specific display.
 * ICS-sourced items get source: 'ical', icalUid, and icalUrl (for per-feed removal).
 */
export function icalEventsToScheduleItems(
  events: ICalEvent[],
  existingSchedule: Record<string, ScheduleItem[]>,
  nextTaskId: number,
  semesterEndDate: string,
  sourceUrl?: string
): { scheduleItems: Record<string, ScheduleItem[]>; nextId: number } {
  const endDate = new Date(semesterEndDate)
  const scheduleItems: Record<string, ScheduleItem[]> = {
    Mon: [...(existingSchedule.Mon || [])],
    Tue: [...(existingSchedule.Tue || [])],
    Wed: [...(existingSchedule.Wed || [])],
    Thu: [...(existingSchedule.Thu || [])],
    Fri: [...(existingSchedule.Fri || [])],
    Sat: [...(existingSchedule.Sat || [])],
    Sun: [...(existingSchedule.Sun || [])],
  }

  // Remove existing ICS-sourced items from this feed (or all ical if no sourceUrl for backward compat)
  const icalSource = 'ical' as const
  for (const day of DAY_KEYS) {
    scheduleItems[day] = scheduleItems[day].filter((item) => {
      const extended = item as ScheduleItem & { source?: string; icalUrl?: string }
      if (extended.source !== icalSource) return true
      if (sourceUrl) return extended.icalUrl !== sourceUrl
      return false // remove all ical when no sourceUrl (legacy)
    })
  }

  let currentId = nextTaskId

  for (const evt of events) {
    if (evt.start > endDate) continue

    const dayOfWeek = evt.start.getDay()
    const dayKey = GET_DAY_KEY[dayOfWeek] ?? 'Mon'
    const dueDate = evt.start.toISOString().split('T')[0]

    const toTime24 = (d: Date) =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    const timeStr = evt.isAllDay
      ? undefined
      : `${formatTime24To12(toTime24(evt.start))} - ${formatTime24To12(toTime24(evt.end))}`

    let title = evt.title
    if (evt.location && !title.toLowerCase().includes(evt.location.toLowerCase())) {
      title += ` @ ${evt.location}`
    }
    if (title.length > 100) title = title.slice(0, 97) + '...'

    const item: ScheduleItem & { source?: string; icalUid?: string; icalUrl?: string } = {
      id: currentId,
      title,
      time: timeStr,
      dueDate,
      priority: 'medium',
      completed: false,
      source: 'ical',
      icalUid: evt.uid,
      ...(sourceUrl && { icalUrl: sourceUrl }),
    }

    scheduleItems[dayKey].push(item)
    currentId++
  }

  return { scheduleItems, nextId: currentId }
}
