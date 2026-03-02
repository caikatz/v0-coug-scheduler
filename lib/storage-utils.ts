import { z } from 'zod'
import { migrateData } from './schemas'

export const STORAGE_KEYS = {
  USER_ID: 'coug_scheduler_user_id',
  USER_PREFERENCES: 'coug_scheduler_preferences',
  SURVEY_STATE: 'coug_scheduler_survey_state',
  SCHEDULE_STATE: 'coug_scheduler_schedule_state',
  CHAT_STATE: 'coug_scheduler_chat_state',
  NAVIGATION_STATE: 'coug_scheduler_navigation_state',
  CALENDAR_URLS: 'coug_scheduler_calendar_urls',
} as const

// localStorage utility functions with Zod validation
export function saveToStorage<T>(
  key: string,
  data: T,
  schema?: z.ZodSchema<T>
): boolean {
  try {
    // Validate data if schema provided
    if (schema) {
      const validationResult = schema.safeParse(data)
      if (!validationResult.success) {
        console.error(
          `Data validation failed for ${key}:`,
          validationResult.error
        )
        return false
      }
    }

    // Transform dates to ISO strings for JSON serialization
    const serializedData = JSON.stringify(data, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return value
    })

    localStorage.setItem(key, serializedData)
    return true
  } catch (error) {
    console.error(`Failed to save to localStorage (${key}):`, error)
    return false
  }
}

export function loadFromStorage<T>(
  key: string,
  defaultValue: T,
  schema?: z.ZodSchema<T>
): T {
  try {
    const item = localStorage.getItem(key)
    if (item === null) {
      return defaultValue
    }

    const parsed = JSON.parse(item)

    // Validate and migrate data if schema provided
    if (schema) {
      try {
        const currentVersion = parsed?.version || '0.0.0'
        const migratedData = migrateData(parsed, currentVersion, schema)

        // If migration resulted in different data, save it back
        if (JSON.stringify(migratedData) !== JSON.stringify(parsed)) {
          saveToStorage(key, migratedData, schema)
        }

        return migratedData
      } catch (migrationError) {
        console.warn(
          `Data migration failed for ${key}, using default:`,
          migrationError
        )
        return defaultValue
      }
    }

    return parsed as T
  } catch (error) {
    console.error(`Failed to load from localStorage (${key}):`, error)
    return defaultValue
  }
}

export function removeFromStorage(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`Failed to remove from localStorage (${key}):`, error)
    return false
  }
}

export function clearAllStorage(): boolean {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
    return true
  } catch (error) {
    console.error('Failed to clear localStorage', error)
    return false
  }
}

/**
 * Generate or retrieve the unique user ID
 * Creates a new UUID on first access and stores it in localStorage
 */
export function getUserId(): string {
  const existingId = localStorage.getItem(STORAGE_KEYS.USER_ID)
  if (existingId) {
    return existingId
  }

  const newId = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEYS.USER_ID, newId)
  return newId
}
