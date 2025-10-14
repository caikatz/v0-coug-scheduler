import {
  getCurrentDayIndex,
  calculateSuccessPercentage,
  processUserPreferences,
  createNewTask,
  updateTaskCompletion,
  validateTaskForm,
  createChatMessage,
  SURVEY_QUESTIONS,
  DAYS,
} from '../lib/core-utils'

describe('Core Utilities', () => {
  describe('getCurrentDayIndex', () => {
    it('should return the correct day index (0-6, Monday as 0)', () => {
      const result = getCurrentDayIndex()
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(6)
    })
  })

  describe('calculateSuccessPercentage', () => {
    it('should return 0 for empty schedule', () => {
      const scheduleItems = {}
      const result = calculateSuccessPercentage(scheduleItems)
      expect(result).toBe(0)
    })

    it('should calculate correct percentage for mixed completion', () => {
      const scheduleItems = {
        Mon: [
          {
            id: 1,
            title: 'Task 1',
            time: '9:00 AM - 10:00 AM',
            priority: 'high' as const,
            completed: true,
          },
          {
            id: 2,
            title: 'Task 2',
            time: '2:00 PM - 3:00 PM',
            priority: 'medium' as const,
            completed: false,
          },
        ],
        Tue: [
          {
            id: 3,
            title: 'Task 3',
            time: '10:00 AM - 11:00 AM',
            priority: 'low' as const,
            completed: true,
          },
        ],
      }
      const result = calculateSuccessPercentage(scheduleItems)
      expect(result).toBe(67) // 2 out of 3 completed = 66.67% rounded to 67%
    })

    it('should return 100 for all completed tasks', () => {
      const scheduleItems = {
        Mon: [
          {
            id: 1,
            title: 'Task 1',
            time: '9:00 AM - 10:00 AM',
            priority: 'high' as const,
            completed: true,
          },
          {
            id: 2,
            title: 'Task 2',
            time: '2:00 PM - 3:00 PM',
            priority: 'medium' as const,
            completed: true,
          },
        ],
      }
      const result = calculateSuccessPercentage(scheduleItems)
      expect(result).toBe(100)
    })
  })

  describe('processUserPreferences', () => {
    it('should process survey answers into preferences object', () => {
      const surveyAnswers = [
        'Morning (6-10 AM)',
        '7-8 hours',
        'Weekly Schedule',
        'Break into 1-hour chunks',
        'Visual notifications',
      ]
      const result = processUserPreferences(surveyAnswers)

      expect(result).toEqual({
        studySchedule: 'Morning (6-10 AM)',
        sleepHours: '7-8 hours',
        scheduleView: 'Weekly Schedule',
        taskBreakdown: 'Break into 1-hour chunks',
        reminderType: 'Visual notifications',
      })
    })
  })

  describe('createNewTask', () => {
    it('should create a new task from form data with times', () => {
      const taskForm = {
        name: 'Study Math',
        startTime: '10:00',
        endTime: '11:00',
        dueDate: '2024-10-15',
        priority: 'high' as const,
      }
      const nextTaskId = 5

      const result = createNewTask(taskForm, nextTaskId)

      expect(result).toEqual({
        id: 5,
        title: 'Study Math',
        time: '10:00 AM - 11:00 AM',
        priority: 'high' as const,
        completed: false,
      })
    })

    it('should create a new task without times when not provided', () => {
      const taskForm = {
        name: 'General Task',
        startTime: '',
        endTime: '',
        dueDate: '2024-10-15',
        priority: 'medium' as const,
      }
      const nextTaskId = 6

      const result = createNewTask(taskForm, nextTaskId)

      expect(result).toEqual({
        id: 6,
        title: 'General Task',
        priority: 'medium' as const,
        completed: false,
      })
      expect(result.time).toBeUndefined()
    })

    it('should create a new task without times when only one time is provided', () => {
      const taskForm = {
        name: 'Partial Task',
        startTime: '10:00',
        endTime: '',
        dueDate: '2024-10-15',
        priority: 'low' as const,
      }
      const nextTaskId = 7

      const result = createNewTask(taskForm, nextTaskId)

      expect(result).toEqual({
        id: 7,
        title: 'Partial Task',
        priority: 'low' as const,
        completed: false,
      })
      expect(result.time).toBeUndefined()
    })
  })

  describe('updateTaskCompletion', () => {
    it('should toggle task completion status', () => {
      const scheduleItems = {
        Mon: [
          {
            id: 1,
            title: 'Task 1',
            time: '9:00 AM - 10:00 AM',
            priority: 'high' as const,
            completed: false,
          },
          {
            id: 2,
            title: 'Task 2',
            time: '2:00 PM - 3:00 PM',
            priority: 'medium' as const,
            completed: false,
          },
        ],
      }

      const result = updateTaskCompletion(scheduleItems, 1, 'Mon')

      expect(result.Mon[0].completed).toBe(true)
      expect(result.Mon[1].completed).toBe(false) // Should remain unchanged
    })

    it('should toggle completed task to incomplete', () => {
      const scheduleItems = {
        Mon: [
          {
            id: 1,
            title: 'Task 1',
            time: '9:00 AM - 10:00 AM',
            priority: 'high' as const,
            completed: true,
          },
        ],
      }

      const result = updateTaskCompletion(scheduleItems, 1, 'Mon')

      expect(result.Mon[0].completed).toBe(false)
    })
  })

  describe('validateTaskForm', () => {
    it('should return no errors for valid task form', () => {
      const taskForm = {
        name: 'Valid Task',
        startTime: '10:00',
        endTime: '11:00',
        dueDate: '2024-10-15',
        priority: 'medium' as const,
      }

      const errors = validateTaskForm(taskForm)
      expect(errors).toHaveLength(0)
    })

    it('should return error for empty task name', () => {
      const taskForm = {
        name: '',
        startTime: '10:00',
        endTime: '11:00',
        dueDate: '2024-10-15',
        priority: 'medium' as const,
      }

      const errors = validateTaskForm(taskForm)
      expect(errors).toContain('name: Task name is required')
    })

    it('should allow missing start time (now optional)', () => {
      const taskForm = {
        name: 'Task',
        startTime: '',
        endTime: '11:00',
        dueDate: '2024-10-15',
        priority: 'medium' as const,
      }

      const errors = validateTaskForm(taskForm)
      expect(errors).toHaveLength(0)
    })

    it('should return error when end time is before start time', () => {
      const taskForm = {
        name: 'Task',
        startTime: '11:00',
        endTime: '10:00',
        dueDate: '2024-10-15',
        priority: 'medium' as const,
      }

      const errors = validateTaskForm(taskForm)
      expect(errors).toContain('endTime: End time must be after start time')
    })

    it('should return error for invalid priority', () => {
      const taskForm = {
        name: 'Task',
        startTime: '10:00',
        endTime: '11:00',
        dueDate: '2024-10-15',
        priority: 'invalid' as 'high' | 'medium' | 'low', // Intentionally invalid for testing validation
      }

      const errors = validateTaskForm(taskForm)
      expect(errors[0]).toContain('priority: Invalid enum value')
    })
  })

  describe('createChatMessage', () => {
    it('should create a user message', () => {
      const result = createChatMessage('Hello Butch!', 'user')

      expect(result.sender).toBe('user')
      expect(result.text).toBe('Hello Butch!')
      expect(result.id).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should create an AI message', () => {
      const result = createChatMessage('Hello there!', 'ai')

      expect(result.sender).toBe('ai')
      expect(result.text).toBe('Hello there!')
    })

    it('should trim whitespace from message text', () => {
      const result = createChatMessage('  Hello  ', 'user')
      expect(result.text).toBe('Hello')
    })
  })

  describe('Constants', () => {
    it('should have correct survey questions', () => {
      expect(SURVEY_QUESTIONS).toHaveLength(5)
      expect(SURVEY_QUESTIONS[0].question).toContain('study schedule')
      expect(SURVEY_QUESTIONS[0].options).toHaveLength(4)
    })

    it('should have correct days array', () => {
      expect(DAYS).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    })
  })
})
