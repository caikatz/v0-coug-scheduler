'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  useSurveyState,
  useScheduleState,
  useNavigationState,
  useChatState,
  useCalendarUrls,
} from '@/lib/persistence-hooks'
import {
  icalEventsToScheduleItems,
  type ICalEvent,
} from '@/lib/ical-parser'
import { WSU_SEMESTER } from '@/lib/constants'
import type { ScheduleItem, ScheduleItems } from '@/lib/schemas'
import SurveyView from '@/ui/views/SurveyView'
import ChatView from '@/ui/views/ChatView'
import TaskEditorView from '@/ui/views/TaskEditorView'
import MainView from '@/ui/views/MainView'

export default function ScheduleApp() {
  const {
    showSurvey,
    currentQuestionIndex,
    surveyAnswers,
    updateSurveyAnswer,
    goBackInSurvey,
    completeSurvey,
  } = useSurveyState()

  const {
    scheduleItems,
    nextTaskId,
    updateScheduleItems,
    incrementTaskId,
    setNextTaskId,
    setScheduleState,
  } = useScheduleState()

  const { icsUrls, addCalendarUrl, removeCalendarUrl } = useCalendarUrls()

  const { onboardingCompleted, setOnboardingCompleted } = useChatState()

  const {
    currentDate,
    selectedDay,
    currentView,
    setCurrentDate,
    setSelectedDay,
    setCurrentView,
  } = useNavigationState()

  // Track chat session - changes each time chat opens to start fresh
  const [chatSessionKey, setChatSessionKey] = useState<number>(0)

  // Task editor state
  const [editingTask, setEditingTask] = useState<ScheduleItem | null>(null)
  const [showTaskEditor, setShowTaskEditor] = useState(false)

  // Ensure currentDate is always a Date object
  const currentDateObj =
    currentDate instanceof Date ? currentDate : new Date(currentDate)

  // Daily ICS calendar refresh - syncs every 24 hours when ICS URLs are configured
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

  if (showSurvey) {
    return (
      <SurveyView
        currentQuestionIndex={currentQuestionIndex}
        surveyAnswers={surveyAnswers}
        updateSurveyAnswer={updateSurveyAnswer}
        goBackInSurvey={goBackInSurvey}
        completeSurvey={completeSurvey}
        onComplete={() => {
          setChatSessionKey((prev) => prev + 1)
          setCurrentView('chat')
        }}
      />
    )
  }

  if (currentView === 'chat') {
    return (
      <ChatView
        chatSessionKey={chatSessionKey}
        scheduleItems={scheduleItems}
        updateScheduleItems={updateScheduleItems}
        nextTaskId={nextTaskId}
        incrementTaskId={incrementTaskId}
        currentDate={currentDateObj}
        onboardingCompleted={onboardingCompleted}
        setOnboardingCompleted={setOnboardingCompleted}
        onNavigateToMain={() => setCurrentView('main')}
      />
    )
  }

  if (showTaskEditor) {
    return (
      <TaskEditorView
        editingTask={editingTask}
        scheduleItems={scheduleItems}
        updateScheduleItems={updateScheduleItems}
        nextTaskId={nextTaskId}
        setNextTaskId={setNextTaskId}
        selectedDay={selectedDay}
        currentDate={currentDateObj}
        onClose={() => {
          setShowTaskEditor(false)
          setEditingTask(null)
        }}
      />
    )
  }

  return (
    <MainView
      scheduleItems={scheduleItems}
      updateScheduleItems={updateScheduleItems}
      currentDate={currentDateObj}
      selectedDay={selectedDay}
      setSelectedDay={setSelectedDay}
      setCurrentDate={setCurrentDate}
      icsUrls={icsUrls}
      addCalendarUrl={addCalendarUrl}
      removeCalendarUrl={removeCalendarUrl}
      nextTaskId={nextTaskId}
      onCalendarSynced={(newItems: ScheduleItems, newNextId: number) => {
        setScheduleState((prev) => ({
          ...prev,
          scheduleItems: newItems,
          nextTaskId: newNextId,
        }))
      }}
      onFredClick={() => {
        setChatSessionKey((prev) => prev + 1)
        setCurrentView('chat')
      }}
      onTaskClick={(task: ScheduleItem) => {
        setEditingTask(task)
        setShowTaskEditor(true)
      }}
      onAddTask={() => {
        setEditingTask(null)
        setShowTaskEditor(true)
      }}
    />
  )
}
