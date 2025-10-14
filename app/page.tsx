'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Send,
  Settings,
  Share,
  BarChart3,
  AlertCircle,
  Plus,
  Grid3X3,
  List,
} from 'lucide-react'

// Import Zod types and persistence hooks
import type { TaskForm, ScheduleItem, Message } from '@/lib/schemas'
import {
  useSurveyState,
  useScheduleState,
  useChatState,
  useNavigationState,
} from '@/lib/persistence-hooks'
import {
  processUserPreferences,
  formatTime24To12,
  convertTo24Hour,
} from '@/lib/schemas'
import { sendChatToWebhook } from '@/lib/webhook-service'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const SURVEY_QUESTIONS = [
  {
    id: 1,
    question: "What's your preferred study schedule?",
    options: [
      'Morning (6-10 AM)',
      'Afternoon (12-4 PM)',
      'Evening (6-10 PM)',
      'Late Night (10 PM-2 AM)',
    ],
  },
  {
    id: 2,
    question: 'How many hours of sleep do you typically need?',
    options: ['6-7 hours', '7-8 hours', '8-9 hours', '9+ hours'],
  },
  {
    id: 3,
    question: "What's your preferred schedule view?",
    options: ['Daily Schedule', 'Weekly Schedule', 'Monthly Schedule'],
  },
  {
    id: 4,
    question: 'How do you prefer to break down large tasks?',
    options: [
      'Keep tasks whole',
      'Break into 30-min chunks',
      'Break into 1-hour chunks',
    ],
  },
  {
    id: 5,
    question: 'What type of reminders work best for you?',
    options: [
      'Visual notifications',
      'Sound alerts',
      'Gentle nudges',
      'No reminders',
    ],
  },
]

const WSU_COUGAR_AI = {
  id: 1,
  name: 'Butch the Cougar',
  color: 'bg-red-700',
  description: 'Your WSU study companion',
  emoji: '🐾',
}

export default function ScheduleApp() {
  // Use persistence hooks for all state management
  const {
    showSurvey,
    currentQuestionIndex,
    surveyAnswers,
    userPreferences,
    setSurveyState,
    updateSurveyAnswer,
    completeSurvey,
  } = useSurveyState()

  const { scheduleItems, nextTaskId, updateScheduleItems, incrementTaskId } =
    useScheduleState()

  const { messages, addMessages, setMessages } = useChatState()

  const {
    currentDate,
    selectedDay,
    currentView,
    setCurrentDate,
    setSelectedDay,
    setCurrentView,
  } = useNavigationState()

  // Ensure currentDate is always a Date object
  const currentDateObj =
    currentDate instanceof Date ? currentDate : new Date(currentDate)

  // Local UI state (not persisted)
  const [inputText, setInputText] = useState('')
  const [editingTask, setEditingTask] = useState<ScheduleItem | null>(null)
  const [showTaskEditor, setShowTaskEditor] = useState(false)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'todo'>('cards')
  const [taskForm, setTaskForm] = useState<TaskForm>({
    name: '',
    startTime: '',
    endTime: '',
    dueDate: '',
    priority: 'medium',
  })

  function calculateSuccessPercentage() {
    const allTasks = Object.values(scheduleItems).flat()
    const completedTasks = allTasks.filter((task) => task.completed)
    const totalTasks = allTasks

    if (totalTasks.length === 0) return 0
    return Math.round((completedTasks.length / totalTasks.length) * 100)
  }

  const successPercentage = calculateSuccessPercentage()

  function handleSurveyAnswer(answer: string) {
    if (currentQuestionIndex < SURVEY_QUESTIONS.length - 1) {
      updateSurveyAnswer(answer)
    } else {
      // Survey complete, process preferences
      const newAnswers = [...surveyAnswers, answer]
      try {
        const preferences = processUserPreferences(newAnswers)
        completeSurvey(preferences)
      } catch (error) {
        console.error('Invalid survey answers:', error)
        // Handle validation error gracefully
      }
    }
  }

  function getWeekDates(date: Date) {
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

  function navigateWeek(direction: 'prev' | 'next') {
    const currentDateObj = new Date(currentDate)
    const newDate = new Date(currentDateObj)
    newDate.setDate(currentDateObj.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentDate(newDate)
  }

  function handleCougarClick() {
    setCurrentView('chat')
  }

  function handleBackToMain() {
    setCurrentView('main')
  }

  async function handleSendMessage() {
    if (!inputText.trim() || isAiThinking) return

    const currentMessage = inputText.trim()
    const userMessage: Message = {
      id: Date.now(),
      text: currentMessage,
      sender: 'user',
      timestamp: new Date(),
    }

    // Add user message immediately and clear input
    addMessages([userMessage])
    setInputText('')
    setIsAiThinking(true)

    try {
      // Send to webhook with all context
      const allMessages = [...messages, userMessage].map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp
            : new Date(msg.timestamp),
      }))

      const updatedMessages = await sendChatToWebhook(
        allMessages,
        userPreferences,
        scheduleItems,
        currentMessage
      )

      // Replace the entire messages array with the response from the webhook
      setMessages(updatedMessages)
    } catch (error) {
      console.error('Failed to get AI response:', error)

      // Fallback message if webhook completely fails
      const fallbackMessage: Message = {
        id: Date.now() + 1,
        text: "Go Cougs! I'm having some technical difficulties, but I'm still here to help you succeed!",
        sender: 'ai',
        timestamp: new Date(),
      }

      addMessages([fallbackMessage])
    } finally {
      setIsAiThinking(false)
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  function getSuccessColor(percentage: number) {
    if (percentage >= 80) return 'text-green-500'
    if (percentage >= 60) return 'text-yellow-500'
    return 'text-red-500'
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

  function handleTaskCompletion(taskId: number, dayKey: string) {
    updateScheduleItems((items) => ({
      ...items,
      [dayKey]:
        items[dayKey]?.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ) || [],
    }))

    // Task completion toggled
  }

  function handleTaskClick(task: ScheduleItem) {
    setEditingTask(task)

    // Parse time if it exists
    let startTime = ''
    let endTime = ''
    if (task.time) {
      const timeParts = task.time.split(' - ')
      if (timeParts.length === 2) {
        // Convert from 12-hour format to 24-hour format for the time input
        startTime = convertTo24Hour(timeParts[0])
        endTime = convertTo24Hour(timeParts[1])
      }
    }

    setTaskForm({
      name: task.title,
      startTime,
      endTime,
      dueDate: '',
      priority: task.priority,
    })
    setShowTaskEditor(true)
  }

  function handleSaveTask() {
    const dayKey = DAYS[selectedDay]
    const hasTimeRange = taskForm.startTime && taskForm.endTime

    if (editingTask) {
      // Update existing task
      updateScheduleItems((items) => ({
        ...items,
        [dayKey]:
          items[dayKey]?.map((task) => {
            if (task.id === editingTask.id) {
              const updatedTask: ScheduleItem = {
                ...task,
                title: taskForm.name,
                priority: taskForm.priority as 'high' | 'medium' | 'low',
              }

              if (hasTimeRange) {
                const startTime12 = formatTime24To12(taskForm.startTime!)
                const endTime12 = formatTime24To12(taskForm.endTime!)
                updatedTask.time = `${startTime12} - ${endTime12}`
              } else {
                // Remove time field if no times provided
                delete updatedTask.time
              }

              return updatedTask
            }
            return task
          }) || [],
      }))
    } else {
      // Add new task
      const newTask: ScheduleItem = {
        id: nextTaskId,
        title: taskForm.name,
        priority: taskForm.priority as 'high' | 'medium' | 'low',
        completed: false,
      }

      if (hasTimeRange) {
        const startTime12 = formatTime24To12(taskForm.startTime!)
        const endTime12 = formatTime24To12(taskForm.endTime!)
        newTask.time = `${startTime12} - ${endTime12}`
      }

      updateScheduleItems((items) => ({
        ...items,
        [dayKey]: [...(items[dayKey] || []), newTask],
      }))

      incrementTaskId()
    }

    setShowTaskEditor(false)
    setEditingTask(null)
    setTaskForm({
      name: '',
      startTime: '',
      endTime: '',
      dueDate: '',
      priority: 'medium',
    })
  }

  const currentScheduleItems = scheduleItems[DAYS[selectedDay]] || []

  const weekDates = getWeekDates(currentDateObj)

  if (showSurvey) {
    const currentQuestion = SURVEY_QUESTIONS[currentQuestionIndex]

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-700 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
              <Image
                src="/images/butch-cougar.png"
                alt="Butch the Cougar"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Welcome, Coug!
            </h1>
            <p className="text-sm text-muted-foreground">
              Let&apos;s personalize your AI companion
            </p>
          </div>

          <div className="mb-8">
            <div className="flex justify-center mb-4">
              {SURVEY_QUESTIONS.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full mx-1 ${
                    index <= currentQuestionIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            <h2 className="text-lg font-semibold text-foreground mb-6 text-balance">
              {currentQuestion.question}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full text-left justify-start h-auto p-4 hover:bg-primary/10 hover:border-primary transition-all bg-transparent"
                  onClick={() => handleSurveyAnswer(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (currentView === 'chat') {
    return (
      <div className="h-screen bg-background flex flex-col max-w-md mx-auto">
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
                {WSU_COUGAR_AI.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {WSU_COUGAR_AI.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className="flex items-start gap-3 max-w-[80%]">
                {message.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <Image
                      src="/images/butch-cougar.png"
                      alt="Butch the Cougar"
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {(message.timestamp instanceof Date
                      ? message.timestamp
                      : new Date(message.timestamp)
                    ).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {message.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium">You</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator when AI is thinking */}
          {isAiThinking && (
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
                      Butch is thinking...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/50 bg-background flex-shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  isAiThinking
                    ? 'Butch is thinking...'
                    : 'Message Butch the Cougar...'
                }
                disabled={isAiThinking}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isAiThinking}
                size="sm"
                className="absolute right-2 bottom-2 h-8 w-8 p-0 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showTaskEditor) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTaskEditor(false)}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {editingTask ? 'Edit Task' : 'Add New Task'}
          </h1>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Task Name
            </label>
            <input
              type="text"
              value={taskForm.name}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter task name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Priority
            </label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map((priority) => (
                <Button
                  key={priority}
                  variant={
                    taskForm.priority === priority ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setTaskForm((prev) => ({ ...prev, priority }))}
                  className="flex-1"
                >
                  {priority === 'high' && (
                    <AlertCircle className="w-4 h-4 mr-1 text-red-500" />
                  )}
                  {priority === 'medium' && (
                    <AlertCircle className="w-4 h-4 mr-1 text-orange-500" />
                  )}
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Start Time (Optional)
              </label>
              <input
                type="time"
                value={taskForm.startTime || ''}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                End Time (Optional)
              </label>
              <input
                type="time"
                value={taskForm.endTime || ''}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, endTime: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={taskForm.dueDate}
              onChange={(e) =>
                setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => setShowTaskEditor(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveTask}>
              {editingTask ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-muted/40 to-muted/20 rounded-3xl p-6 mb-6 border border-border/50 shadow-lg relative">
        {/* Corner Icons */}
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Share className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute bottom-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              setSurveyState((prev) => ({ ...prev, showSurvey: true }))
            }
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute bottom-4 right-4">
          <div
            className={`flex items-center gap-1 ${getSuccessColor(
              successPercentage
            )}`}
          >
            <span className="text-sm font-semibold">{successPercentage}%</span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-4 text-center">
          WSU AI Companion
        </h3>
        <div className="flex justify-center">
          <button
            onClick={handleCougarClick}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-background/60 transition-all duration-300 group hover:scale-105 active:scale-95"
          >
            <div className="relative">
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
                {WSU_COUGAR_AI.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {WSU_COUGAR_AI.description}
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

        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, index) => {
            const date = weekDates[index]
            const isSelected = selectedDay === index
            const isToday = date.toDateString() === new Date().toDateString()
            const dayTasks = scheduleItems[day] || []
            const hasActiveTasks = dayTasks.length > 0

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(index)}
                className={`p-3 rounded-lg text-center transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isToday
                    ? 'bg-primary/10 text-primary border-2 border-primary/20'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="text-xs font-medium">{day}</div>
                <div className="text-lg font-bold mt-1">{date.getDate()}</div>
                <div className="flex justify-center mt-1">
                  <div
                    className={`w-2 h-2 rounded-full transition-colors ${
                      hasActiveTasks ? 'bg-primary' : 'bg-transparent'
                    }`}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="mb-20">
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
                onClick={() => handleTaskClick(item)}
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
                        handleTaskCompletion(item.id, DAYS[selectedDay])
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
                onClick={() => handleTaskClick(item)}
              >
                <button
                  className={`w-4 h-4 rounded border-2 transition-all hover:scale-110 flex items-center justify-center ${
                    item.completed
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground hover:border-primary'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTaskCompletion(item.id, DAYS[selectedDay])
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

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 p-4 z-10">
        <div className="max-w-md mx-auto">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-3 font-semibold shadow-lg"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setEditingTask(null)
              setTaskForm({
                name: '',
                startTime: '',
                endTime: '',
                dueDate: '',
                priority: 'medium',
              })
              setShowTaskEditor(true)
            }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Task to Schedule
          </Button>
        </div>
      </div>
    </div>
  )
}
