'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ArrowLeft, Send, AlertCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/ui/components/button'
import { DAYS, SCHEDULING_AI } from '@/lib/constants'
import { useAIChat } from '@/lib/ai-chat-hook'
import { getWeekDates, formatDateLocal } from '@/lib/utils'
import type { ScheduleItems } from '@/lib/schemas'

interface ChatViewProps {
  chatSessionKey: number
  scheduleItems: ScheduleItems
  updateScheduleItems: (updater: (items: ScheduleItems) => ScheduleItems) => void
  nextTaskId: number
  incrementTaskId: () => void
  currentDate: Date | string
  onboardingCompleted: boolean
  setOnboardingCompleted: (value: boolean) => void
  onNavigateToMain: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ToolUIPart {
  type: string
  toolCallId?: string
  toolName?: string
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'error'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output?: any
  errorText?: string
}

function getToolNameFromPart(part: ToolUIPart): string | null {
  if (part.toolName) return part.toolName
  if (part.type?.startsWith('tool-')) return part.type.slice(5)
  return null
}

const TOOL_LABELS: Record<string, { pending: string; done: string }> = {
  get_schedule: { pending: 'Fetching your schedule...', done: 'Schedule loaded' },
  create_schedule_items: { pending: 'Adding items to calendar...', done: 'Items added to calendar' },
  remove_schedule_items: { pending: 'Removing items from calendar...', done: 'Items removed from calendar' },
  search_courses: { pending: 'Searching course catalog...', done: 'Courses found' },
  complete_onboarding: { pending: 'Generating your schedule...', done: 'Schedule generated' },
}

export default function ChatView({
  chatSessionKey,
  scheduleItems,
  updateScheduleItems,
  nextTaskId,
  incrementTaskId,
  currentDate,
  onboardingCompleted,
  setOnboardingCompleted,
  onNavigateToMain,
}: ChatViewProps) {
  const currentDateObj = currentDate instanceof Date ? currentDate : new Date(currentDate)

  const { messages, isLoading, status, error, sendMessage, setMessages } = useAIChat(
    chatSessionKey,
    onboardingCompleted,
    nextTaskId,
    scheduleItems
  )

  const [inputText, setInputText] = useState('')
  const [expandedCalendar, setExpandedCalendar] = useState(false)
  const [textareaHasOverflow, setTextareaHasOverflow] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emptyRetryCount = useRef(0)
  const prevStatus = useRef(status)
  const MAX_EMPTY_RETRIES = 2

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)

    if (textareaRef.current) {
      const hasOverflow = textareaRef.current.scrollHeight > textareaRef.current.clientHeight
      setTextareaHasOverflow(hasOverflow)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Auto-retry on empty Gemini responses
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = status

    const wasLoading = prev === 'streaming' || prev === 'submitted'
    const isNowReady = status === 'ready'

    console.log(`[EmptyRetry] Status: ${prev} → ${status}, msgs: ${messages.length}`)

    if (!wasLoading || !isNowReady || messages.length < 1) return

    const lastMsg = messages[messages.length - 1]
    console.log(`[EmptyRetry] Last msg role: ${lastMsg?.role}, parts:`, lastMsg?.parts?.map((p: { type: string; text?: string }) => ({ type: p.type, hasText: !!(p.text?.trim()) })))

    // Check if the last assistant message has meaningful content
    let responseIsEmpty = false

    if (lastMsg?.role === 'assistant') {
      const hasText = lastMsg.parts?.some(
        (p: { type: string; text?: string }) => p.type === 'text' && p.text && p.text.trim().length > 0
      )
      const hasToolCall = lastMsg.parts?.some(
        (p: { type: string }) => p.type?.startsWith?.('tool-')
      )
      responseIsEmpty = !hasText && !hasToolCall
    } else if (lastMsg?.role === 'user') {
      // Gemini returned nothing — no assistant message was even added
      responseIsEmpty = true
    }

    if (!responseIsEmpty) {
      emptyRetryCount.current = 0
      return
    }

    if (emptyRetryCount.current >= MAX_EMPTY_RETRIES) {
      console.warn(`[EmptyRetry] Max retries (${MAX_EMPTY_RETRIES}) reached. Giving up.`)
      emptyRetryCount.current = 0
      return
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return

    const userText = lastUserMsg.parts?.find(
      (p: { type: string; text?: string }) => p.type === 'text'
    )?.text

    if (!userText) return

    emptyRetryCount.current++
    console.warn(`[EmptyRetry] Empty response detected. Auto-retrying (${emptyRetryCount.current}/${MAX_EMPTY_RETRIES})...`)

    // Strip trailing user messages that got no response to avoid
    // consecutive user turns (which Gemini can't handle).
    const cleaned = [...messages]
    while (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
      cleaned.pop()
    }
    console.log(`[EmptyRetry] Cleaned messages: ${messages.length} → ${cleaned.length} (stripped ${messages.length - cleaned.length} trailing user msgs)`)
    setMessages(cleaned)

    setTimeout(() => {
      sendMessage({ text: userText })
    }, 500)
  }, [status, messages, sendMessage, setMessages])

  // Show return-to-home button when Fred has called complete_onboarding
  const showReturnToHomeButton = (() => {
    if (
      onboardingCompleted ||
      isLoading ||
      messages.length < 2
    ) {
      return false
    }
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role !== 'assistant' || !lastMessage.parts?.length) {
      return false
    }
    return lastMessage.parts.some(
      (part: ToolUIPart) =>
        getToolNameFromPart(part) === 'complete_onboarding' &&
        part.state === 'output-available'
    )
  })()

  // Sync schedule from tool call results in chat messages
  useEffect(() => {
    if (!messages || messages.length === 0 || isLoading) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role !== 'assistant') return

    for (const part of lastMessage.parts || []) {
      const toolPart = part as ToolUIPart
      const toolName = getToolNameFromPart(toolPart)

      if (!toolName) continue

      console.log('[ToolSync] Part:', { type: toolPart.type, toolName, state: toolPart.state })
      console.log('[ToolSync] Output:', toolPart.output)

      if (toolName === 'create_schedule_items' && toolPart.state === 'output-available') {
        const output = toolPart.output
        console.log('[ToolSync] create_schedule_items output:', JSON.stringify(output, null, 2))

        if (output?.success && output?.created) {
          const created = output.created as { event_id: string; title: string; date: string; time: string }[]
          console.log('[ToolSync] Created items:', created)

          if (created.length > 0) {
            updateScheduleItems((current) => {
              const updated = { ...current }
              for (const item of created) {
                const dateKey = item.date
                console.log('[ToolSync] Adding item to dateKey:', dateKey, item.title)
                const dateItems = updated[dateKey] || []
                const alreadyExists = dateItems.some(
                  (existing) => existing.title === item.title && existing.time === item.time
                )
                if (!alreadyExists) {
                  const newId = Math.max(0, ...Object.values(updated).flat().map((i) => i.id)) + 1
                  if (!updated[dateKey]) updated[dateKey] = []
                  updated[dateKey] = [
                    ...updated[dateKey],
                    {
                      id: newId,
                      title: item.title,
                      time: item.time,
                      dueDate: dateKey,
                      priority: 'medium' as const,
                      completed: false,
                    },
                  ]
                } else {
                  console.log('[ToolSync] Item already exists, skipping:', item.title)
                }
              }
              console.log('[ToolSync] Updated schedule keys:', Object.keys(updated))
              return updated
            })
            for (let i = 0; i < created.length; i++) {
              incrementTaskId()
            }
          }
        }
      }

      if (toolName === 'remove_schedule_items' && toolPart.state === 'output-available') {
        const output = toolPart.output as { success?: boolean; removed_count?: number; match_titles?: string[] } | undefined
        console.log('[ToolSync] remove_schedule_items output:', JSON.stringify(output, null, 2))

        if (output?.success && output.removed_count && output.removed_count > 0 && output.match_titles) {
          const matchTitles = output.match_titles
          updateScheduleItems((current) => {
            const updated: ScheduleItems = {}
            for (const [dateKey, items] of Object.entries(current)) {
              const filtered = items.filter((item) => {
                const shouldRemove = matchTitles.some((title: string) =>
                  item.title.toLowerCase().includes(title.toLowerCase())
                )
                if (shouldRemove) {
                  console.log('[ToolSync] Removing from client:', dateKey, item.title)
                }
                return !shouldRemove
              })
              if (filtered.length > 0) {
                updated[dateKey] = filtered
              }
            }
            console.log('[ToolSync] Client schedule after removal:', Object.keys(updated).length, 'date keys')
            return updated
          })
        }
      }

      if (toolName === 'complete_onboarding' && toolPart.state === 'output-available') {
        const output = toolPart.output
        console.log('[ToolSync] complete_onboarding output:', output)
        if (output?.success) {
          if (output.schedule) {
            const serverSchedule = output.schedule as ScheduleItems
            updateScheduleItems(() => serverSchedule)
          }
          if (!onboardingCompleted) {
            setOnboardingCompleted(true)
          }
        }
      }
    }
  }, [messages, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleBackToMain() {
    if (!onboardingCompleted && messages.length > 1) {
      setOnboardingCompleted(true)
    }
    onNavigateToMain()
  }

  function handleSendMessage() {
    if (!inputText.trim() || isLoading) return

    const currentMessage = inputText.trim()
    setInputText('')

    sendMessage({ text: currentMessage })
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  function renderToolStatus(part: ToolUIPart, index: number) {
    const toolName = getToolNameFromPart(part)
    const label = TOOL_LABELS[toolName || '']
    if (!label) return null

    const isDone = part.state === 'output-available'
    const output = part.output as { conflicts?: string[] } | undefined
    return (
      <div key={index} className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
        {isDone ? (
          <span className="text-green-600 dark:text-green-400">&#10003;</span>
        ) : (
          <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
        <span>{isDone ? label.done : label.pending}</span>
        {output?.conflicts && output.conflicts.length > 0 && (
          <span className="text-amber-600 dark:text-amber-400 ml-1">
            ({output.conflicts.length} conflict{output.conflicts.length > 1 ? 's' : ''})
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col max-w-md mx-auto relative">
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
              const dateKey = formatDateLocal(weekDates[index])
              const daySchedule = scheduleItems[dateKey] || []
              const todayDate = new Date()
              const currentDayOfWeek = (todayDate.getDay() + 6) % 7
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
                      daySchedule.map((item) => (
                        <div
                          key={item.id}
                          className="bg-card border border-border/50 rounded p-1.5 hover:bg-gray-300 transition-colors cursor-pointer"
                          title={`${item.title}\n${item.time || 'No time set'}`}
                        >
                          <div className="font-medium text-[10px] leading-tight break-words">
                            {item.title}
                          </div>
                          {item.time && (
                            <div className="text-muted-foreground text-[9px] leading-tight mt-0.5">
                              {item.time}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      daySchedule.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="bg-card border border-border/50 rounded p-1.5 hover:bg-gray-300 transition-colors cursor-pointer"
                          title={`${item.title}\n${item.time || 'No time set'}`}
                        >
                          <div className="font-medium truncate text-[10px] leading-tight">
                            {item.title}
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
                      const toolPart = part as ToolUIPart
                      const toolName = getToolNameFromPart(toolPart)
                      if (toolName && TOOL_LABELS[toolName]) {
                        return renderToolStatus(toolPart, index)
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
              &larr; View your schedule
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
