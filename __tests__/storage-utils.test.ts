import {
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  clearAllStorage,
  getUserId,
  STORAGE_KEYS,
} from '../lib/storage-utils'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Storage Utils', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
  })

  describe('saveToStorage', () => {
    it('should save data to localStorage', () => {
      const testData = { name: 'John', age: 30 }
      saveToStorage('test-key', testData)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData)
      )
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage error')
      })

      const result = saveToStorage('test-key', { data: 'test' })

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save to localStorage (test-key):',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('loadFromStorage', () => {
    it('should load data from localStorage', () => {
      const testData = { name: 'Jane', age: 25 }
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(testData))

      const result = loadFromStorage('test-key', {})

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key')
      expect(result).toEqual(testData)
    })

    it('should return default value when key does not exist', () => {
      const defaultValue = { default: true }
      localStorageMock.getItem.mockReturnValueOnce(null)

      const result = loadFromStorage('non-existent-key', defaultValue)

      expect(result).toEqual(defaultValue)
    })

    it('should return default value when JSON parsing fails', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const defaultValue = { default: true }
      localStorageMock.getItem.mockReturnValueOnce('invalid json')

      const result = loadFromStorage('test-key', defaultValue)

      expect(result).toEqual(defaultValue)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load from localStorage (test-key):',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('removeFromStorage', () => {
    it('should remove item from localStorage', () => {
      removeFromStorage('test-key')

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key')
    })

    it('should handle removal errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Remove error')
      })

      const result = removeFromStorage('test-key')

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to remove from localStorage (test-key):',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('clearAllStorage', () => {
    it('should clear all app-specific storage keys', () => {
      clearAllStorage()

      Object.values(STORAGE_KEYS).forEach((key) => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(key)
      })
    })

    it('should handle clear errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Clear error')
      })

      const result = clearAllStorage()

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear localStorage',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('getUserId', () => {
    it('should generate a new user ID on first call', () => {
      const mockUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      const cryptoMock = {
        randomUUID: jest.fn().mockReturnValue(mockUUID),
      }

      // Mock crypto object
      Object.defineProperty(global, 'crypto', {
        value: cryptoMock,
        writable: true,
      })

      const userId = getUserId()

      expect(userId).toBe(mockUUID)
      expect(cryptoMock.randomUUID).toHaveBeenCalled()
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_ID,
        mockUUID
      )
    })

    it('should return existing user ID on subsequent calls', () => {
      const existingId = 'existing-user-id-123'
      localStorageMock.getItem.mockReturnValueOnce(existingId)

      const userId = getUserId()

      expect(userId).toBe(existingId)
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_ID
      )
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('should throw when crypto.randomUUID is not available', () => {
      // Remove crypto from global
      Object.defineProperty(global, 'crypto', {
        value: undefined,
        writable: true,
      })

      expect(() => getUserId()).toThrow()
    })

    it('should throw when localStorage fails', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage error')
      })

      const cryptoMock = {
        randomUUID: jest.fn().mockReturnValue('test-uuid'),
      }

      Object.defineProperty(global, 'crypto', {
        value: cryptoMock,
        writable: true,
      })

      expect(() => getUserId()).toThrow('localStorage error')
    })
  })

  describe('STORAGE_KEYS', () => {
    it('should have all required storage keys', () => {
      expect(STORAGE_KEYS.USER_ID).toBe('coug_scheduler_user_id')
      expect(STORAGE_KEYS.USER_PREFERENCES).toBe('coug_scheduler_preferences')
      expect(STORAGE_KEYS.SURVEY_STATE).toBe('coug_scheduler_survey_state')
      expect(STORAGE_KEYS.SCHEDULE_STATE).toBe('coug_scheduler_schedule_state')
      expect(STORAGE_KEYS.CHAT_STATE).toBe('coug_scheduler_chat_state')
      expect(STORAGE_KEYS.NAVIGATION_STATE).toBe(
        'coug_scheduler_navigation_state'
      )
    })
  })
})
