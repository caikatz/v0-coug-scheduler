'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Grid3X3,
  List,
  RotateCcw,
  Calendar,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Card } from '@/ui/components/card'
import { Button } from '@/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/components/dialog'
import { DAYS, MONTHS, SCHEDULING_AI, WSU_SEMESTER } from '@/lib/constants'
import { getWeekDates, formatDateLocal } from '@/lib/utils'
import { clearAllStorage } from '@/lib/storage-utils'
import {
  icalEventsToScheduleItems,
  type ICalEvent,
} from '@/lib/ical-parser'
import type { ScheduleItem, ScheduleItems } from '@/lib/schemas'

interface MainViewProps {
  scheduleItems: ScheduleItems
  updateScheduleItems: (updater: (items: ScheduleItems) => ScheduleItems) => void
  currentDate: Date | string
  selectedDay: number
  setSelectedDay: (day: number) => void
  setCurrentDate: (date: Date) => void
  icsUrls: string[]
  addCalendarUrl: (url: string) => void
  removeCalendarUrl: (url: string) => void
  nextTaskId: number
  onCalendarSynced: (newScheduleItems: ScheduleItems, newNextTaskId: number) => void
  onFredClick: () => void
  onTaskClick: (task: ScheduleItem) => void
  onAddTask: () => void
}

export default function MainView({
  scheduleItems,
  updateScheduleItems,
  currentDate,
  selectedDay,
  setSelectedDay,
  setCurrentDate,
  icsUrls,
  addCalendarUrl,
  removeCalendarUrl,
  nextTaskId,
  onCalendarSynced,
  onFredClick,
  onTaskClick,
  onAddTask,
}: MainViewProps) {
  const currentDateObj = currentDate instanceof Date ? currentDate : new Date(currentDate)

  const [viewMode, setViewMode] = useState<'cards' | 'todo'>('cards')
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showCalendarDialog, setShowCalendarDialog] = useState(false)
  const [icsInputValue, setIcsInputValue] = useState('')
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false)
  const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null)

  // Filter tasks to only show those that match the current week's dates
  const weekDates = getWeekDates(currentDateObj)
  const currentSelectedDate = weekDates[selectedDay]
  const currentDateString = formatDateLocal(currentSelectedDate)

  const currentScheduleItems = (scheduleItems[currentDateString] || [])
    .slice()
    .sort((a, b) => {
      const parseStart = (t?: string) => {
        if (!t) return Infinity
        const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i)
        if (!match) return Infinity
        let h = parseInt(match[1], 10)
        const m = parseInt(match[2], 10)
        if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12
        if (match[3].toUpperCase() === 'AM' && h === 12) h = 0
        return h * 60 + m
      }
      return parseStart(a.time) - parseStart(b.time)
    })

  function navigateWeek(direction: 'prev' | 'next') {
    const currentDateObj = new Date(currentDate)
    const newDate = new Date(currentDateObj)
    newDate.setDate(currentDateObj.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
  }

  function getPriorityIcon(priority: string) {
    if (priority === 'high') {
      return (
        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-white" />
        </div>
      )
    }
    if (priority === 'medium') {
      return (
        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-white" />
        </div>
      )
    }
    return null
  }

  function handleTaskCompletion(taskId: number, dateKey: string) {
    updateScheduleItems((items) => ({
      ...items,
      [dateKey]:
        items[dateKey]?.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ) || [],
    }))
  }

  function handleReset() {
    // Clear all localStorage data
    clearAllStorage()
    // Reload the page to reinitialize all states
    window.location.reload()
  }

  function handleAddCalendarUrl() {
    const trimmed = icsInputValue.trim()
    if (!trimmed) return
    try {
      new URL(trimmed)
    } catch {
      setCalendarSyncError('Please enter a valid URL')
      return
    }
    setCalendarSyncError(null)
    addCalendarUrl(trimmed)
    setIcsInputValue('')
  }

  function handleRemoveCalendarUrl(url: string) {
    removeCalendarUrl(url)
    updateScheduleItems((items) => {
      const result: ScheduleItems = {}
      for (const [key, dayItems] of Object.entries(items)) {
        result[key] = dayItems.filter(
          (item) =>
            (item as ScheduleItem & { icalUrl?: string }).icalUrl !== url
        )
      }
      return result
    })
  }

  async function handleSyncCalendar() {
    if (icsUrls.length === 0) {
      setCalendarSyncError('Add at least one calendar URL first')
      return
    }
    setCalendarSyncError(null)
    setIsSyncingCalendar(true)
    try {
      let currentSchedule = { ...scheduleItems }
      let currentNextId = nextTaskId
      for (const url of icsUrls) {
        const res = await fetch('/api/fetch-ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json()
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch calendar')
        }
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
      onCalendarSynced(currentSchedule, currentNextId)
      setShowCalendarDialog(false)
    } catch (err) {
      setCalendarSyncError(
        err instanceof Error ? err.message : 'Failed to sync calendar'
      )
    } finally {
      setIsSyncingCalendar(false)
    }
  }

  return (
    <div className="min-h-dvh h-dvh bg-background flex flex-col w-full max-w-full sm:max-w-md mx-auto relative">
      {/* Top section: AI assistant, header, calendar — fixed in place */}
      <div className="flex-shrink-0 p-4 pb-0">
        <div className="bg-gradient-to-r from-muted/40 to-muted/20 rounded-3xl p-6 mb-6 border border-border/50 shadow-lg relative">
          <h3 className="text-sm font-semibold text-foreground mb-4 text-center">
            AI Scheduling Assistant
          </h3>
          <div className="flex justify-center">
            <button
              onClick={onFredClick}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-background/60 transition-all duration-300 group hover:scale-105 active:scale-95"
            >
              <div className="relative fred-avatar-section">
                <div className="w-20 h-20 rounded-full bg-red-700 flex items-center justify-center shadow-xl group-hover:shadow-2xl transition-all duration-300 border-2 border-white/20 overflow-hidden">
                  <Image
                    src="/images/butch-cougar.png"
                    alt="Butch the Cougar"
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                </div>
                <div className="absolute -top-1 -right-1 text-xl">🐾</div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {SCHEDULING_AI.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {SCHEDULING_AI.description}
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground">
            {MONTHS[currentDateObj.getMonth()]} {currentDateObj.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-primary hover:bg-primary/10"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Calendar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Sync Calendar</DialogTitle>
                <DialogDescription className="break-words">
                  Add your iCal/ICS feed URL to pull events into your schedule.
                  Works with Google Calendar, Outlook, Apple Calendar, and more.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 min-w-0 overflow-hidden">
                <div className="flex gap-2 min-w-0">
                  <input
                    type="url"
                    placeholder="https://calendar.google.com/calendar/ical/..."
                    value={icsInputValue}
                    onChange={(e) => setIcsInputValue(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && (e.preventDefault(), handleAddCalendarUrl())
                    }
                    className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddCalendarUrl}
                    disabled={!icsInputValue.trim()}
                  >
                    Add
                  </Button>
                </div>
                {icsUrls.length > 0 && (
                  <div className="space-y-2 min-w-0 overflow-hidden">
                    <p className="text-sm font-medium text-foreground">
                      Calendar feeds ({icsUrls.length})
                    </p>
                    <ul className="space-y-2 max-h-32 overflow-y-auto min-w-0">
                      {icsUrls.map((url) => (
                        <li
                          key={url}
                          className="flex items-center justify-between gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 min-w-0"
                        >
                          <span className="flex-1 min-w-0 break-all">
                            {url}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveCalendarUrl(url)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {calendarSyncError && (
                  <p className="text-sm text-destructive">{calendarSyncError}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCalendarDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSyncCalendar}
                  disabled={isSyncingCalendar || icsUrls.length === 0}
                >
                  {isSyncingCalendar ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    'Sync Calendar'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset All Data</DialogTitle>
                <DialogDescription>
                  This will permanently delete all your schedule data,
                  preferences, and chat history. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowResetDialog(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReset}>
                  Reset All Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar */}
      <Card className="mb-6 p-4">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateWeek('prev')}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-foreground">
              Week of {weekDates[0].getDate()} - {weekDates[6].getDate()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateWeek('next')}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {DAYS.map((day, index) => {
            const date = weekDates[index]
            const isSelected = selectedDay === index
            const isToday = date.toDateString() === new Date().toDateString()
            const dateString = formatDateLocal(date)

            const dayTasks = scheduleItems[dateString] || []
            const hasActiveTasks = dayTasks.length > 0

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(index)}
                className={`flex w-full min-w-0 flex-col items-center justify-center rounded-lg border-2 p-1.5 text-center transition-colors sm:p-2 ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isToday
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-transparent hover:bg-muted'
                }`}
              >
                <div className="text-[10px] font-medium leading-tight sm:text-xs">
                  {day}
                </div>
                <div className="mt-0.5 text-base font-bold tabular-nums leading-none sm:text-lg">
                  {date.getDate()}
                </div>
                <div className="mt-1 flex h-2 w-full items-center justify-center">
                  <span
                    className={`block h-2 w-2 shrink-0 rounded-full transition-colors ${
                      hasActiveTasks
                        ? isSelected
                          ? 'bg-primary-foreground'
                          : 'bg-primary'
                        : 'bg-transparent'
                    }`}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </Card>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            {DAYS[selectedDay]}&apos;s Schedule
          </h2>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'todo' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('todo')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {viewMode === 'cards' ? (
          // Card View (original layout)
          <div className="space-y-3">
            {currentScheduleItems.map((item) => (
              <Card
                key={item.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onTaskClick(item)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
                        item.completed
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground hover:border-primary'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTaskCompletion(item.id, currentDateString)
                      }}
                    />
                    <div className="flex-1">
                      <h3
                        className={`font-medium ${
                          item.completed
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.time || 'No specific time'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(item.priority)}
                  </div>
                </div>
              </Card>
            ))}

            {currentScheduleItems.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">
                  No scheduled items for this day
                </p>
              </Card>
            )}
          </div>
        ) : (
          // TODO List View (compact line-item style)
          <div className="space-y-2">
            {currentScheduleItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
                onClick={() => onTaskClick(item)}
              >
                <button
                  className={`w-4 h-4 rounded border-2 transition-all hover:scale-110 flex items-center justify-center ${
                    item.completed
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground hover:border-primary'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTaskCompletion(item.id, currentDateString)
                  }}
                >
                  {item.completed && (
                    <svg
                      className="w-2.5 h-2.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`font-medium truncate ${
                      item.completed
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {item.title}
                  </span>
                </div>
              </div>
            ))}

            {currentScheduleItems.length === 0 && (
              <div className="p-6 text-center rounded-lg border border-dashed border-border/50">
                <p className="text-muted-foreground">
                  No scheduled items for this day
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Viewport-fixed FAB — px sizing so root font-size does not scale the control */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        <div className="pointer-events-auto flex w-full max-w-full justify-end pr-4 sm:max-w-md sm:pr-5">
          <Button
            size="icon"
            className="!h-[48px] !w-[48px] !min-h-[48px] !min-w-[48px] rounded-full bg-primary p-0 hover:bg-primary/90 active:bg-green-500 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAddTask()
            }}
          >
            <Image
              src="/images/+_sign_icon.png"
              alt="Add task"
              width={28}
              height={28}
              className="h-[28px] w-[28px] object-contain"
            />
          </Button>
        </div>
      </div>
    </div>
  )
}
