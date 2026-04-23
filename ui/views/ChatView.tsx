'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ArrowLeft, Send, AlertCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/ui/components/button'
import { DAYS, SCHEDULING_AI, WSU_SEMESTER } from '@/lib/constants'
import { useAIChat } from '@/lib/ai-chat-hook'
import { getWeekDates, formatDateLocal } from '@/lib/utils'
import { detectOverlaps } from '@/lib/schedule-utils'
import {
  transformAIScheduleToItems,
  mergeScheduleForWeek,
  applyScheduleChanges,
} from '@/lib/schedule-transformer'
import type { ScheduleItems, ScheduleItem, UserPreferences } from '@/lib/schemas'

interface ChatViewProps {
  chatSessionKey: number
  scheduleItems: ScheduleItems
  updateScheduleItems: (updater: (items: ScheduleItems) => ScheduleItems) => void
  nextTaskId: number
  setNextTaskId: (id: number) => void
  currentDate: Date | string
  onboardingCompleted: boolean
  setOnboardingCompleted: (value: boolean) => void
  userPreferences: UserPreferences | null
  onNavigateToMain: () => void
}

export default function ChatView({
  chatSessionKey,
  scheduleItems,
  updateScheduleItems,
  nextTaskId,
  setNextTaskId,
  currentDate,
  onboardingCompleted,
  setOnboardingCompleted,
  userPreferences,
  onNavigateToMain,
}: ChatViewProps) {
  const currentDateObj = currentDate instanceof Date ? currentDate : new Date(currentDate)

  const { messages, isLoading, error, sendMessage } = useAIChat(
    chatSessionKey,
    onboardingCompleted
  )

  const [inputText, setInputText] = useState('')
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false)
  const [expandedCalendar, setExpandedCalendar] = useState(false)
  const [isUpdatingCalendar, setIsUpdatingCalendar] = useState(false)
  const [textareaHasOverflow, setTextareaHasOverflow] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)

    // Check if textarea has overflowed to multiple lines
    // ScrollHeight - Total height of every line in the textbox
    // ClientHeight - Total VISIBLE height of every line in the textbox

    if (textareaRef.current) {
      const hasOverflow = textareaRef.current.scrollHeight > textareaRef.current.clientHeight
      setTextareaHasOverflow(hasOverflow)
    }
  }

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Show return-to-home button when Fred has called complete_onboarding
  const showReturnToHomeButton = (() => {
    if (
      onboardingCompleted ||
      isLoading ||
      isGeneratingSchedule ||
      messages.length < 2
    ) {
      return false
    }
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role !== 'assistant' || !lastMessage.parts?.length) {
      return false
    }
    return lastMessage.parts.some(
      (part: { type?: string; state?: string }) =>
        part.type === 'tool-complete_onboarding' &&
        part.state === 'output-available'
    )
  })()

  // Live update chat calendar as Fred suggests schedule items
  useEffect(() => {
    // Only if there are messages and AI just finished responding
    if (messages.length < 2) {
      return
    }

    // Check if the last message is from the assistant (Fred just finished responding)
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return
    }

    // Only trigger when AI is done responding (not while loading)
    if (isLoading) {
      return
    }

    // Debounce the schedule generation to avoid excessive API calls
    const timeoutId = setTimeout(async () => {
      try {
        console.log('🔄 Live calendar update triggered - Fred just responded')
        setIsUpdatingCalendar(true)

        // Call generate-schedule API to get latest schedule
        const response = await fetch('/api/generate-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            existingSchedule: scheduleItems,
          }),
        })

        const data = await response.json()

        if (data.success && data.schedule) {
          console.log('✅ Schedule data received, updating calendar')

          // Get current week dates
          const weekDates = getWeekDates(currentDateObj)

          let mergedSchedule: ScheduleItems = scheduleItems

          if (data.schedule.update_type === 'none') {
            console.log('✅ No live schedule changes detected')
          } else if (data.schedule.update_type === 'partial') {
            mergedSchedule = applyScheduleChanges(
              scheduleItems,
              data.schedule.changes || [],
              weekDates,
              nextTaskId,
              WSU_SEMESTER.current.end
            )
          } else if (data.schedule.update_type === 'full') {
            const transformedSchedule = transformAIScheduleToItems(
              data.schedule,
              weekDates,
              nextTaskId
            )

            if (onboardingCompleted) {
              // In follow-up chat, avoid wiping existing classes if model returns a sparse "full" update.
              const combined: ScheduleItems = {
                Mon: [...(scheduleItems.Mon || [])],
                Tue: [...(scheduleItems.Tue || [])],
                Wed: [...(scheduleItems.Wed || [])],
                Thu: [...(scheduleItems.Thu || [])],
                Fri: [...(scheduleItems.Fri || [])],
                Sat: [...(scheduleItems.Sat || [])],
                Sun: [...(scheduleItems.Sun || [])],
              }

              const dayKeys: Array<keyof ScheduleItems> = [
                'Mon',
                'Tue',
                'Wed',
                'Thu',
                'Fri',
                'Sat',
                'Sun',
              ]

              dayKeys.forEach((day) => {
                const existingKeys = new Set(
                  (combined[day] || []).map(
                    (item) =>
                      `${item.dueDate || ''}|${item.title.toLowerCase()}|${item.time || ''}`
                  )
                )

                for (const item of transformedSchedule[day] || []) {
                  const key = `${item.dueDate || ''}|${item.title.toLowerCase()}|${item.time || ''}`
                  if (!existingKeys.has(key)) {
                    combined[day].push(item)
                    existingKeys.add(key)
                  }
                }

                combined[day].sort((a, b) => {
                  const aRange = parseScheduleItemTimeRange(a.time)
                  const bRange = parseScheduleItemTimeRange(b.time)
                  if (!aRange && !bRange) return 0
                  if (!aRange) return 1
                  if (!bRange) return -1
                  return aRange.start - bRange.start
                })
              })

              mergedSchedule = combined
            } else {
              // During initial build, a full update can safely replace current-week tasks.
              mergedSchedule = mergeScheduleForWeek(
                scheduleItems,
                transformedSchedule,
                weekDates
              )
            }
          }

          // Check for overlaps before updating
          const { hasOverlap, conflicts } = detectOverlaps(mergedSchedule)

          if (hasOverlap) {
            console.warn('⚠️ CRITICAL OVERLAP DETECTED! Calendar will NOT be updated:')
            conflicts.forEach(conflict => console.warn('  - ' + conflict))
            // Do not update the schedule - reject the changes
            return
          }

          // Update the schedule state (triggers calendar re-render)
          updateScheduleItems(() => mergedSchedule)
          console.log('📅 Chat calendar updated with new schedule items')
        } else {
          console.log('⚠️ No schedule data in response')
        }
      } catch (error) {
        // Silently fail for live updates
        console.debug('Failed to update chat calendar:', error)
      } finally {
        setIsUpdatingCalendar(false)
      }
    }, 300) // Fast debounce - only 300ms delay after Fred responds

    return () => clearTimeout(timeoutId)
  }, [messages, isLoading])

  async function handleBackToMain() {
    // Only generate schedule if there's a meaningful conversation (more than just the opening message)
    if (messages.length > 1) {
      console.time('frontend-schedule-generation')
      console.log(
        '🎯 Frontend: Starting schedule generation with',
        messages.length,
        'messages'
      )

      setIsGeneratingSchedule(true)
      try {
        console.time('fetch-api-call')
        console.log('📡 Frontend: Making API call to /api/generate-schedule')

        // Call the generate-schedule endpoint
        const response = await fetch('/api/generate-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            existingSchedule: scheduleItems,
          }),
        })

        console.timeEnd('fetch-api-call')
        console.log('📡 Frontend: API call completed, status:', response.status)

        console.time('response-parsing')
        const data = await response.json()
        console.timeEnd('response-parsing')

        console.log('📦 Frontend: Response data success:', data.success)

        if (data.success && data.schedule) {
          console.time('schedule-processing')

          // Get current week dates for AI schedule transforms
          const weekDates = getWeekDates(currentDateObj)
          const termDates = getDatesInRange(
            WSU_SEMESTER.current.start,
            WSU_SEMESTER.current.end
          )
          let resultingSchedule: ScheduleItems = scheduleItems

          if (data.schedule.update_type === 'none') {
            // No AI change, still refresh suggestions for the full term
            console.log('✅ No schedule changes detected')
          } else if (data.schedule.update_type === 'partial') {
            resultingSchedule = applyScheduleChanges(
              scheduleItems,
              data.schedule.changes || [],
              weekDates,
              nextTaskId,
              WSU_SEMESTER.current.end
            )
          } else if (data.schedule.update_type === 'full') {
            resultingSchedule = transformAIScheduleToItems(
              {
                update_type: data.schedule.update_type,
                weekly_schedule: data.schedule.weekly_schedule || [],
                schedule_summary: data.schedule.schedule_summary,
                notes: data.schedule.notes,
              },
              weekDates,
              nextTaskId
            )
          }

          const { updated: suggestedSchedule, nextId } = addSuggestedStudyTasks(
            resultingSchedule,
            termDates,
            getNextTaskIdFromSchedule(resultingSchedule)
          )

          updateScheduleItems(() => suggestedSchedule)
          setNextTaskId(nextId)

          console.timeEnd('schedule-processing')
          console.log('✅ Frontend: Schedule processing completed')

          if (!onboardingCompleted) {
            setOnboardingCompleted(true)
          }
        }
      } catch (error) {
        // Fail silently as requested
        console.error('❌ Frontend: Failed to generate schedule:', error)
      } finally {
        setIsGeneratingSchedule(false)
        console.timeEnd('frontend-schedule-generation')
        console.log('🏁 Frontend: Schedule generation process finished')
      }
    }

    onNavigateToMain()
  }

  function handleSendMessage() {
    if (!inputText.trim() || isLoading) return

    const currentMessage = inputText.trim()
    setInputText('')

    // Send message using AI SDK integration
    sendMessage({ text: currentMessage })
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  function parseProductiveHoursWindow(
    productiveHours?: string
  ): { startMinutes: number; endMinutes: number } {
    const fallback = { startMinutes: 9 * 60, endMinutes: 17 * 60 }
    if (!productiveHours) return fallback

    const [startRaw, endRaw] = productiveHours.split('-')
    if (!startRaw || !endRaw) return fallback

    const parse24Hour = (value: string): number | null => {
      const [hoursRaw, minutesRaw] = value.trim().split(':')
      const hours = Number(hoursRaw)
      const minutes = Number(minutesRaw)

      if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return null
      }

      return hours * 60 + minutes
    }

    const startMinutes = parse24Hour(startRaw)
    const endMinutes = parse24Hour(endRaw)

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return fallback
    }

    return { startMinutes, endMinutes }
  }

  function parseScheduleItemTimeRange(
    timeRange?: string
  ): { start: number; end: number } | null {
    if (!timeRange) return null

    const [startText, endText] = timeRange.split(' - ')
    if (!startText || !endText) return null

    const parse12Hour = (value: string): number | null => {
      const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      if (!match) return null

      let hours = Number(match[1])
      const minutes = Number(match[2])
      const period = match[3].toUpperCase()

      if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        return null
      }

      if (period === 'AM' && hours === 12) {
        hours = 0
      } else if (period === 'PM' && hours !== 12) {
        hours += 12
      }

      return hours * 60 + minutes
    }

    const start = parse12Hour(startText)
    const end = parse12Hour(endText)
    if (start === null || end === null || end <= start) {
      return null
    }

    return { start, end }
  }

  function formatMinutesTo12Hour(totalMinutes: number): string {
    const hours24 = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const period = hours24 >= 12 ? 'PM' : 'AM'
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  function getNextTaskIdFromSchedule(items: ScheduleItems): number {
    const maxId = Object.values(items)
      .flat()
      .reduce((currentMax, item) => Math.max(currentMax, item.id), 0)
    return maxId + 1
  }

  function formatDateLocal(d: Date): string {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }

  function parseLocalDateString(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  function getDatesInRange(startDateString: string, endDateString: string): Date[] {
    const dates: Date[] = []
    const startDate = parseLocalDateString(startDateString)
    const endDate = parseLocalDateString(endDateString)

    const current = new Date(startDate)
    while (current <= endDate) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  function addSuggestedStudyTasks(
    items: ScheduleItems,
    targetDates: Date[],
    startingTaskId: number
  ): { updated: ScheduleItems; nextId: number } {
    const { startMinutes, endMinutes } = parseProductiveHoursWindow(
      userPreferences?.productiveHours
    )
    const minimumBlockMinutes = 60
    const targetDateStrings = new Set(targetDates.map((d) => formatDateLocal(d)))

    const cleaned: ScheduleItems = { ...items }
    DAYS.forEach((day) => {
      cleaned[day] = (cleaned[day] || []).filter((item) => {
        const typedItem = item as ScheduleItem & { source?: 'ical' | 'suggested' }
        const isSuggested = typedItem.source === 'suggested'
        const isTargetDate = !!item.dueDate && targetDateStrings.has(item.dueDate)
        return !(isSuggested && isTargetDate)
      })
    })

    let nextId = startingTaskId

    const getWeekStart = (date: Date): Date => {
      const start = new Date(date)
      const mondayOffset = (start.getDay() + 6) % 7
      start.setDate(start.getDate() - mondayOffset)
      start.setHours(0, 0, 0, 0)
      return start
    }

    const getLargestGap = (date: Date): { start: number; end: number; size: number } | null => {
      const dayIndex = (date.getDay() + 6) % 7
      const dayKey = DAYS[dayIndex]
      const dueDate = formatDateLocal(date)
      const dayItems = (cleaned[dayKey] || []).filter((item) => {
        if (!item.dueDate) return true
        return item.dueDate === dueDate
      })

      const occupiedBlocks = dayItems
        .map((item) => parseScheduleItemTimeRange(item.time))
        .filter((block): block is { start: number; end: number } => block !== null)
        .map((block) => ({
          start: Math.max(startMinutes, block.start),
          end: Math.min(endMinutes, block.end),
        }))
        .filter((block) => block.end > block.start)
        .sort((a, b) => a.start - b.start)

      const mergedBlocks: Array<{ start: number; end: number }> = []
      occupiedBlocks.forEach((block) => {
        const lastBlock = mergedBlocks[mergedBlocks.length - 1]
        if (!lastBlock || block.start > lastBlock.end) {
          mergedBlocks.push({ ...block })
        } else {
          lastBlock.end = Math.max(lastBlock.end, block.end)
        }
      })

      let largestGapStart = -1
      let largestGapEnd = -1
      let cursor = startMinutes

      mergedBlocks.forEach((block) => {
        if (block.start - cursor > largestGapEnd - largestGapStart) {
          largestGapStart = cursor
          largestGapEnd = block.start
        }
        cursor = Math.max(cursor, block.end)
      })

      if (endMinutes - cursor > largestGapEnd - largestGapStart) {
        largestGapStart = cursor
        largestGapEnd = endMinutes
      }

      const gapSize = largestGapEnd - largestGapStart
      if (gapSize < minimumBlockMinutes) {
        return null
      }

      return { start: largestGapStart, end: largestGapEnd, size: gapSize }
    }

    const weekMap = new Map<string, Date[]>()
    targetDates.forEach((date) => {
      const key = formatDateLocal(getWeekStart(date))
      const weekDates = weekMap.get(key) || []
      weekDates.push(date)
      weekMap.set(key, weekDates)
    })

    weekMap.forEach((weekDates) => {
      const weekdayCandidates = weekDates
        .filter((date) => {
          const dayIndex = (date.getDay() + 6) % 7
          return dayIndex >= 0 && dayIndex <= 4
        })
        .map((date) => {
          const gap = getLargestGap(date)
          return gap ? { date, gap } : null
        })
        .filter(
          (candidate): candidate is { date: Date; gap: { start: number; end: number; size: number } } =>
            candidate !== null
        )
        .sort((a, b) => b.gap.size - a.gap.size)
        .slice(0, 2)

      weekdayCandidates.forEach(({ date, gap }) => {
        const dayIndex = (date.getDay() + 6) % 7
        const dayKey = DAYS[dayIndex]
        const dueDate = formatDateLocal(date)
        const suggestedLength = Math.min(90, gap.size)
        const suggestionStart = gap.start
        const suggestionEnd = suggestionStart + suggestedLength

        const suggestedTask: ScheduleItem & { source: 'suggested' } = {
          id: nextId,
          title: 'Suggested Study Session',
          priority: 'medium',
          completed: false,
          source: 'suggested',
          dueDate,
          time: `${formatMinutesTo12Hour(suggestionStart)} - ${formatMinutesTo12Hour(suggestionEnd)}`,
        }

        cleaned[dayKey] = [...(cleaned[dayKey] || []), suggestedTask]
        nextId += 1
      })
    })

    return { updated: cleaned, nextId }
  }

  function formatLiveCalendarTitle(title: string): string {
    const trimmed = title.trim()
    if (!trimmed) return title
    if (trimmed !== trimmed.toLowerCase()) return title
    return trimmed.replace(/\b\w/g, (char) => char.toUpperCase())
  }

  return (
    <div className="h-screen bg-background flex flex-col max-w-md mx-auto relative">
      {/* Loading Overlay */}
      {isGeneratingSchedule && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card rounded-2xl p-8 shadow-2xl border border-border flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground mb-1">
                Generating Your Schedule
              </h3>
              <p className="text-sm text-muted-foreground">
                Analyzing your conversation with Fred...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-muted/40 to-muted/20 border-b border-border/50 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToMain}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-700 flex items-center justify-center overflow-hidden">
            <Image
              src="/images/butch-cougar.png"
              alt="Butch the Cougar"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">
              {SCHEDULING_AI.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {SCHEDULING_AI.description}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Calendar - Live schedule preview - Expandable */}
      <div className={`border-b border-border/50 bg-muted/20 flex flex-col ${expandedCalendar ? 'flex-1' : 'flex-shrink-0'}`} style={expandedCalendar ? { height: 'auto' } : { maxHeight: '30vh' }}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Week&apos;s Schedule</h3>
            {isUpdatingCalendar && (
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedCalendar(!expandedCalendar)}
            className="h-6 w-6 p-0"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${expandedCalendar ? 'rotate-90' : ''}`} />
          </Button>
        </div>
        <div className="px-3 pb-3 overflow-y-auto flex-1" style={expandedCalendar ? {} : { maxHeight: 'calc(30vh - 2.5rem)' }}>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {DAYS.map((day, index) => {
              const weekDates = getWeekDates(currentDateObj)
              const dateString = formatDateLocal(weekDates[index])
              const daySchedule = (scheduleItems[day] || [])
                .filter((item) => {
                  // Keep legacy tasks without dueDate visible.
                  if (!item.dueDate) return true
                  return item.dueDate === dateString
                })
                .sort((a, b) => {
                  const aRange = parseScheduleItemTimeRange(a.time)
                  const bRange = parseScheduleItemTimeRange(b.time)

                  // Untimed items appear after timed entries.
                  if (!aRange && !bRange) return 0
                  if (!aRange) return 1
                  if (!bRange) return -1

                  if (aRange.start !== bRange.start) {
                    return aRange.start - bRange.start
                  }
                  return aRange.end - bRange.end
                })
              const todayDate = new Date()
              const currentDayOfWeek = (todayDate.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
              const isToday = index === currentDayOfWeek

              return (
                <div key={day} className={`flex flex-col gap-1 ${isToday ? 'bg-primary/10 rounded-lg p-1' : ''}`}>
                  <div className={`font-semibold text-center pb-1 border-b ${isToday ? 'border-primary text-primary' : 'border-border/30 text-foreground'}`}>
                    {day}
                  </div>
                  <div className="space-y-1 pt-1">
                    {daySchedule.length === 0 ? (
                      <div className="text-muted-foreground/50 text-center py-2">-</div>
                    ) : expandedCalendar ? (
                      // Show all items when expanded
                      daySchedule.map((item) => (
                        <div
                          key={item.id}
                          className="bg-card border border-border/50 rounded p-1.5 hover:bg-gray-300 transition-colors cursor-pointer"
                          title={`${item.title}\n${item.time || 'No time set'}`}
                        >
                          <div className="font-medium text-[10px] leading-tight break-words">
                            {formatLiveCalendarTitle(item.title)}
                          </div>
                          {item.time && (
                            <div className="text-muted-foreground text-[9px] leading-tight mt-0.5">
                              {item.time}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      // Show first 4 items when collapsed
                      daySchedule.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="bg-card border border-border/50 rounded p-1.5 hover:bg-gray-300 transition-colors cursor-pointer"
                          title={`${item.title}\n${item.time || 'No time set'}`}
                        >
                          <div className="font-medium truncate text-[10px] leading-tight">
                            {formatLiveCalendarTitle(item.title)}
                          </div>
                          {item.time && (
                            <div className="text-muted-foreground text-[9px] truncate leading-tight mt-0.5">
                              {item.time.split(' - ')[0]}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {!expandedCalendar && daySchedule.length > 4 && (
                      <div className="text-muted-foreground/70 text-center text-[9px] pt-1">
                        +{daySchedule.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className={`${expandedCalendar ? 'hidden' : 'flex-1'} overflow-y-auto p-4 space-y-4 min-h-0`}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              (message.role as string) === 'user'
                ? 'justify-end'
                : 'justify-start'
            }`}
          >
            <div className="flex items-start gap-3 max-w-[80%]">
              {(message.role as string) === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <Image
                    src="/images/butch-cougar.png"
                    alt="Fred the Cougar"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 ${
                  (message.role as string) === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted text-foreground'
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {(message as { content?: string }).content ||
                    message.parts?.map((part, index) => {
                      if (part.type === 'text') {
                        return <span key={index}>{part.text}</span>
                      }
                      return null
                    })}
                </div>
              </div>
              {(message.role as string) === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium">You</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Big red button to return to home when onboarding is complete */}
        {showReturnToHomeButton && (
          <div className="flex justify-center py-4">
            <Button
              size="lg"
              onClick={handleBackToMain}
              className="w-full max-w-sm bg-red-600 hover:bg-red-700 text-white font-bold text-lg py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              ← View your schedule
            </Button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex justify-center">
            <div className="rounded-2xl px-4 py-3 bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error.message}</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator when AI is thinking */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <Image
                  src="/images/butch-cougar.png"
                  alt="Butch the Cougar"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-muted text-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Fred is thinking...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border/50 bg-background flex-shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputText}
              maxLength={300}
              onChange={handleTextareaInput}
              onKeyPress={handleKeyPress}
              placeholder={
                isLoading
                  ? 'Fred is thinking...'
                  : 'Message Fred the Lion...'
              }
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              rows={1}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
              size="sm"
              className={`absolute ${textareaHasOverflow ? 'right-5' : 'right-2'} bottom-2 h-8 w-8 p-0 rounded-full`}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
