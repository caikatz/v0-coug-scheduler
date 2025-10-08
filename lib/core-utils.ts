// Re-export types and functions from schemas for backward compatibility
export type {
  UserPreferences,
  TaskForm,
  ScheduleItem,
  Message,
  ScheduleItems,
  Priority,
  MessageSender,
  View,
} from './schemas'

export {
  SURVEY_QUESTIONS,
  DAYS,
  getCurrentDayIndex,
  calculateSuccessPercentage,
  processUserPreferences,
  createNewTask,
  updateTaskCompletion,
  createChatMessage,
  validateMessage,
  validateUserPreferences,
} from './schemas'

// Legacy function for backward compatibility with tests
import {
  validateTaskForm as zodValidateTaskForm,
  type TaskForm,
} from './schemas'

export function validateTaskForm(taskForm: TaskForm): string[] {
  const result = zodValidateTaskForm(taskForm)
  return result.success ? [] : result.errors
}
