import { useRef, useEffect } from 'react'
import { icalEventsToScheduleItems, type ICalEvent } from './ical-parser'
import { WSU_SEMESTER } from './constants'
import type { ScheduleItems, ScheduleState } from './schemas'

interface UseBackgroundIcsSyncParams {
  icsUrls: string[]
  scheduleItems: ScheduleItems
  nextTaskId: number
  setScheduleState: (updater: (prev: ScheduleState) => ScheduleState) => void
}

/**
 * Runs a daily background sync of all configured ICS calendar feeds.
 * Fires once on mount and then every 24 hours while the component is mounted.
 * Silently fails — sync errors never surface to the user.
 */
export function useBackgroundIcsSync({
  icsUrls,
  scheduleItems,
  nextTaskId,
  setScheduleState,
}: UseBackgroundIcsSyncParams) {
  const scheduleItemsRef = useRef(scheduleItems)
  const nextTaskIdRef = useRef(nextTaskId)
  const icsUrlsRef = useRef(icsUrls)
  scheduleItemsRef.current = scheduleItems
  nextTaskIdRef.current = nextTaskId
  icsUrlsRef.current = icsUrls

  useEffect(() => {
    if (icsUrls.length === 0) return

    const runBackgroundSync = async () => {
      const urls = icsUrlsRef.current
      if (urls.length === 0) return
      try {
        let currentSchedule = { ...scheduleItemsRef.current }
        let currentNextId = nextTaskIdRef.current
        for (const url of urls) {
          const res = await fetch('/api/fetch-ics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          })
          const data = await res.json()
          if (!data.success) return
          const events = (data.events || []).map(
            (e: {
              uid: string
              title: string
              start: string
              end: string
              isAllDay: boolean
              location?: string
            }) =>
              ({
                ...e,
                start: new Date(e.start),
                end: new Date(e.end),
              }) as ICalEvent
          )
          const { scheduleItems: merged, nextId } = icalEventsToScheduleItems(
            events,
            currentSchedule,
            currentNextId,
            WSU_SEMESTER.current.end,
            url
          )
          currentSchedule = merged
          currentNextId = nextId
        }
        setScheduleState((prev) => ({
          ...prev,
          scheduleItems: currentSchedule,
          nextTaskId: currentNextId,
        }))
      } catch {
        // Silent fail for background sync
      }
    }

    const DAILY_MS = 24 * 60 * 60 * 1000

    runBackgroundSync()

    const intervalId = setInterval(runBackgroundSync, DAILY_MS)
    return () => clearInterval(intervalId)
  }, [icsUrls.length, setScheduleState])
}
