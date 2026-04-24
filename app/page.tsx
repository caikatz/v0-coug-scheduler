'use client'

import React, { useState } from 'react'
import {
  useSurveyState,
  useScheduleState,
  useNavigationState,
  useChatState,
  useCalendarUrls,
} from '@/lib/persistence-hooks'
import { useBackgroundIcsSync } from '@/lib/use-background-ics-sync'
import type { ScheduleItem, ScheduleItems, UserPreferences } from '@/lib/schemas'
import SurveyView from '@/ui/views/SurveyView'
import ChatView from '@/ui/views/ChatView'
import TaskEditorView from '@/ui/views/TaskEditorView'
import MainView from '@/ui/views/MainView'

export default function ScheduleApp() {
  const {
    showSurvey,
    currentQuestionIndex,
    surveyAnswers,
    userPreferences,
    updateSurveyAnswer,
    goBackInSurvey,
    completeSurvey,
  } = useSurveyState()

  const {
    scheduleItems,
    nextTaskId,
    updateScheduleItems,
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

  // Stable chat session key - single persistent conversation
  const chatSessionKey = 0

  // Task editor state
  const [editingTask, setEditingTask] = useState<ScheduleItem | null>(null)
  const [showTaskEditor, setShowTaskEditor] = useState(false)

  // Ensure currentDate is always a Date object
  const currentDateObj =
    currentDate instanceof Date ? currentDate : new Date(currentDate)

  // Daily ICS calendar refresh - syncs every 24 hours when ICS URLs are configured
  useBackgroundIcsSync({ icsUrls, scheduleItems, nextTaskId, setScheduleState })

  if (showSurvey) {
    return (
      <SurveyView
        currentQuestionIndex={currentQuestionIndex}
        surveyAnswers={surveyAnswers}
        updateSurveyAnswer={updateSurveyAnswer}
        goBackInSurvey={goBackInSurvey}
        completeSurvey={completeSurvey}
        onComplete={() => {
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
        setNextTaskId={setNextTaskId}
        currentDate={currentDateObj}
        onboardingCompleted={onboardingCompleted ?? false}
        setOnboardingCompleted={setOnboardingCompleted}
        userPreferences={userPreferences as UserPreferences | null}
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
