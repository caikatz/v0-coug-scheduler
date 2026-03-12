export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const MONTHS = [
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

export const SURVEY_QUESTIONS = [
  {
    id: 1,
    question: 'What are your most productive study hours?',
    type: 'slider' as const,
    min: 6, // 6am
    max: 24, // 12am (midnight)
    step: 1,
    defaultValue: [9, 17], // 9am to 5pm
    labels: ['6am', '9am', '12pm', '3pm', '6pm', '9pm', '12am'],
  },
  {
    id: 2,
    question: 'When do you prefer to be asleep?',
    type: 'slider' as const,
    min: 0, // 9pm (represented as 0 for slider)
    max: 12, // 9am (represented as 12 for slider, actual hours: 9pm-9am)
    step: 1,
    defaultValue: [2, 10], // 11pm to 7am (2 hours after 9pm, 10 hours after 9pm)
    labels: ['9pm', '12am', '3am', '6am', '9am'],
    validation: 'min-7-hours' as const,
  },
  {
    id: 3,
    question: 'Is your current sleep schedule working for you?',
    type: 'multiple-choice' as const,
    options: [
      'I need to develop a new sleep routine',
      'I need to adjust it for college',
      'It can be improved',
      'No improvements needed',
    ],
    requiresFollowUp: [0, 1, 2], // Indices that require follow-up
  },

  {
    id: 4,
    question: 'How do you prefer to break down large tasks?',
    type: 'multiple-choice' as const,
    options: [
      'Keep tasks whole',
      'Break into study chunks >1hr',
      'Break into study chunks <1hr',
      'Let AI decide',
    ],
  },
  {
    id: 5,
    question: 'Are your current study habits working for you?',
    type: 'multiple-choice' as const,
    options: [
      'No, I need to develop a new routine',
      'Somewhat, but I need to adjust them for college',
      'Yes, but they can be improved',
      'Yes, they need no improvements',
    ],
    requiresFollowUp: [0, 1, 2], // Indices that require follow-up
  },
  {
    id: 6,
    question: 'What type of reminders work best for you?',
    type: 'multiple-choice' as const,
    options: [
      'Visual notifications',
      'Sound alerts',
      'Email summaries',
      'No notifications',
    ],
  },
]

export const SCHEDULING_AI = {
  id: 1,
  name: 'Fred the lion',
  color: 'bg-orange-600',
  description: 'Your friendly scheduling buddy',
  emoji: '🦁',
}