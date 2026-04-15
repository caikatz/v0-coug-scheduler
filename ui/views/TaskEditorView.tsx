'use client'

import React, { useState } from 'react'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog'
import { WSU_SEMESTER } from '@/lib/constants'
import { convertTo24Hour, getWeekDates, formatDateLocal } from '@/lib/utils'
import { expandRecurringTasks } from '@/lib/schedule-utils'
import { validateTaskForm, type RepeatType } from '@/lib/schemas'
import { STORAGE_KEYS } from '@/lib/storage-utils'
import type { ScheduleItem, ScheduleItems, TaskForm } from '@/lib/schemas'

interface TaskEditorViewProps {
  editingTask: ScheduleItem | null
  scheduleItems: ScheduleItems
  updateScheduleItems: (updater: (items: ScheduleItems) => ScheduleItems) => void
  nextTaskId: number
  setNextTaskId: (id: number) => void
  selectedDay: number
  currentDate: Date | string
  onClose: () => void
}

export default function TaskEditorView({
  editingTask,
  scheduleItems,
  updateScheduleItems,
  nextTaskId,
  setNextTaskId,
  selectedDay,
  currentDate,
  onClose,
}: TaskEditorViewProps) {
  const currentDateObj = currentDate instanceof Date ? currentDate : new Date(currentDate)

  const [taskForm, setTaskForm] = useState<TaskForm>(() => {
    if (!editingTask) {
      return {
        name: '',
        startTime: '',
        endTime: '',
        dueDate: '',
        priority: 'medium',
        repeatType: 'never',
        repeatDays: [],
      }
    }

    // Parse time if it exists
    let startTime = ''
    let endTime = ''
    if (editingTask.time) {
      const timeParts = editingTask.time.split(' - ')
      if (timeParts.length === 2) {
        // Convert from 12-hour format to 24-hour format for the time input
        startTime = convertTo24Hour(timeParts[0])
        endTime = convertTo24Hour(timeParts[1])
      }
    }

    const taskWithRepeat = editingTask as ScheduleItem & {
      repeatType?: RepeatType
      repeatDays?: number[]
      repeatGroupId?: number
    }

    return {
      name: editingTask.title,
      startTime,
      endTime,
      dueDate: editingTask.dueDate || '',
      priority: editingTask.priority,
      repeatType: taskWithRepeat.repeatType ?? 'never',
      repeatDays: taskWithRepeat.repeatDays ?? [],
    }
  })

  const [taskFormErrors, setTaskFormErrors] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteDontAskAgain, setDeleteDontAskAgain] = useState(false)

  function handleSaveTask() {
    // Validate the task form first
    const validation = validateTaskForm(taskForm)
    if (!validation.success) {
      setTaskFormErrors(validation.errors)
      return
    }

    setTaskFormErrors([])

    const editingTaskWithRepeat = editingTask as ScheduleItem & {
      repeatGroupId?: number
    }

    if (editingTask) {
      const repeatGroupId = editingTaskWithRepeat.repeatGroupId
      const idsToRemove = repeatGroupId
        ? (() => {
            const ids: number[] = []
            Object.values(scheduleItems).forEach((items) => {
              items.forEach((item) => {
                const ir = item as ScheduleItem & { repeatGroupId?: number }
                if (ir.repeatGroupId === repeatGroupId) ids.push(ir.id)
              })
            })
            return ids
          })()
        : [editingTask.id]

      updateScheduleItems((items) => {
        const result: ScheduleItems = {}
        for (const [key, dayItems] of Object.entries(items)) {
          result[key] = dayItems.filter(
            (item) => !idsToRemove.includes(item.id)
          )
        }
        const { itemsByDate, nextId } = expandRecurringTasks(
          { ...taskForm, dueDate: taskForm.dueDate || formatDateLocal(getWeekDates(currentDateObj)[selectedDay]) },
          nextTaskId,
          WSU_SEMESTER.current.end
        )
        for (const [dateKey, dateItems] of Object.entries(itemsByDate)) {
          result[dateKey] = [...(result[dateKey] || []), ...dateItems]
        }
        setNextTaskId(nextId)
        return result
      })
    } else {
      const dueDate = taskForm.dueDate || formatDateLocal(getWeekDates(currentDateObj)[selectedDay])
      const { itemsByDate, nextId } = expandRecurringTasks(
        { ...taskForm, dueDate },
        nextTaskId,
        WSU_SEMESTER.current.end
      )
      updateScheduleItems((items) => {
        const result = { ...items }
        for (const [dateKey, dateItems] of Object.entries(itemsByDate)) {
          result[dateKey] = [...(result[dateKey] || []), ...dateItems]
        }
        return result
      })
      setNextTaskId(nextId)
    }

    onClose()
  }

  function performDeleteTask() {
    if (!editingTask) return
    const editingTaskWithRepeat = editingTask as ScheduleItem & {
      repeatGroupId?: number
    }
    const repeatGroupId = editingTaskWithRepeat.repeatGroupId
    const idsToRemove = repeatGroupId
      ? (() => {
          const ids: number[] = []
          Object.values(scheduleItems).forEach((items) => {
            items.forEach((item) => {
              const ir = item as ScheduleItem & { repeatGroupId?: number }
              if (ir.repeatGroupId === repeatGroupId) ids.push(ir.id)
            })
          })
          return ids
        })()
      : [editingTask.id]

    updateScheduleItems((items) => {
      const result: ScheduleItems = {}
      for (const [key, dayItems] of Object.entries(items)) {
        result[key] = dayItems.filter(
          (item) => !idsToRemove.includes(item.id)
        )
      }
      return result
    })

    onClose()
  }

  function handleDeleteTask() {
    if (!editingTask) return
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.DELETE_TASK_DONT_ASK) === 'true') {
      performDeleteTask()
      return
    }
    setDeleteDontAskAgain(false)
    setShowDeleteConfirm(true)
  }

  function handleConfirmDelete() {
    if (deleteDontAskAgain && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DELETE_TASK_DONT_ASK, 'true')
    }
    performDeleteTask()
  }

  return (
    <div className="min-h-dvh h-dvh bg-background p-4 w-full max-w-full sm:max-w-md mx-auto flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          {editingTask ? 'Edit Task' : 'Add New Task'}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Display validation errors */}
        {taskFormErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-medium mb-1">
                  Please fix the following errors:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {taskFormErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

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

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Repeat
          </label>
          <div className="flex flex-wrap gap-2">
            {(['never', 'daily', 'weekly', 'monthly', 'custom'] as const).map(
              (type) => (
                <Button
                  key={type}
                  variant={
                    (taskForm.repeatType ?? 'never') === type
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  onClick={() =>
                    setTaskForm((prev) => ({
                      ...prev,
                      repeatType: type,
                      repeatDays: type === 'custom' ? prev.repeatDays ?? [] : undefined,
                    }))
                  }
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              )
            )}
          </div>
          {(taskForm.repeatType ?? 'never') === 'custom' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  [0, 'Sun'],
                  [1, 'Mon'],
                  [2, 'Tue'],
                  [3, 'Wed'],
                  [4, 'Thu'],
                  [5, 'Fri'],
                  [6, 'Sat'],
                ] as const
              ).map(([dayNum, label]) => (
                <Button
                  key={dayNum}
                  variant={
                    (taskForm.repeatDays ?? []).includes(dayNum)
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  onClick={() => {
                    const current = taskForm.repeatDays ?? []
                    const next = current.includes(dayNum)
                      ? current.filter((d) => d !== dayNum)
                      : [...current, dayNum].sort((a, b) => a - b)
                    setTaskForm((prev) => ({ ...prev, repeatDays: next }))
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveTask}>
              {editingTask ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
          {editingTask && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDeleteTask}
            >
              Delete Task
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this task?
            </DialogDescription>
            {editingTask && ((editingTask as ScheduleItem & { repeatGroupId?: number }).repeatGroupId ?? (taskForm.repeatType && taskForm.repeatType !== 'never')) && (
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-2">
                All instances of this repeating task will be deleted as well.
              </p>
            )}
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="delete-dont-ask"
              checked={deleteDontAskAgain}
              onChange={(e) => setDeleteDontAskAgain(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label
              htmlFor="delete-dont-ask"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Don&apos;t ask me again
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
