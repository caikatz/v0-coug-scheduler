import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { AIGeneratedScheduleSchema, ScheduleItems } from '@/lib/schemas'
import { PostHog } from 'posthog-node'
import { withTracing } from '@posthog/ai'

export const maxDuration = 30

const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_GEMINI_API_KEY,
})

const phClient = new PostHog(
  'phc_I2KRzOerAFE5xbd3DKMHQUIOcLnOQkD4he91kmJYAFT',
  { host: 'https://us.i.posthog.com' }
)

interface GenerateScheduleRequest {
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    parts: Array<{ type: string; text: string }>
  }>
  existingSchedule?: ScheduleItems
}

export async function POST(req: Request) {
  console.time('schedule-generation-total')
  console.log('🚀 Schedule generation started at:', new Date().toISOString())

  try {
    console.time('request-parsing')
    const { messages, existingSchedule }: GenerateScheduleRequest = await req.json()
    console.timeEnd('request-parsing')

    console.log('📝 Number of messages received:', messages.length)

    console.time('conversation-context-building')
    // Build conversation context from messages
    const conversationContext = messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'Student' : 'Butch'
        const text = msg.parts?.map((p) => p.text).join('') || ''
        return `${role}: ${text}`
      })
      .join('\n\n')
    console.timeEnd('conversation-context-building')

    console.log(
      '📄 Conversation context length:',
      conversationContext.length,
      'characters'
    )

    const systemPrompt = `You are analyzing a conversation between Butch (an academic success coach) and a student to extract and generate a structured weekly schedule.

CRITICAL RULE: ONLY include schedule items that were EXPLICITLY mentioned by the student in the conversation. Do not add generic activities, assumptions, or filler content.

Review the conversation carefully and extract ONLY the following types of information that were DIRECTLY STATED:
- Specific classes with exact times, names, and days mentioned by the student
- Specific assignments, homework, or projects with deadlines mentioned by the student
- Specific work hours, shifts, or job commitments mentioned by the student
- Specific athletic practices, gym sessions, or activities mentioned by the student
- Specific meetings, study groups, or appointments mentioned by the student

DO NOT INCLUDE:
- Generic study time unless specifically requested by the student
- Meals, sleep, or personal care unless specifically discussed
- Transportation time unless mentioned
- Generic "prep time" unless requested
- Any activities not explicitly mentioned in the conversation

FORMATTING RULES:
1. Use 24-hour time format (e.g., "09:00", "15:30")
2. Map day names exactly as: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
3. Calculate accurate totals for the schedule_summary based ONLY on the blocks you create
4. Ensure all time blocks don't overlap within a day
5. If the student mentioned an activity but not a specific time, make a reasonable assumption based on context
6. Use the exact names and descriptions provided by the student

Determine if each item is recurring or not for is_recurring. TRUE: Classes, weekly work shifts, recurring meetings, regular gym sessions, etc.; FALSE: Specific assignment due dates, one-time events, single appointments

EXISTING SCHEDULE:
${existingSchedule ? JSON.stringify(existingSchedule, null, 2) : 'No existing schedule'}

DETERMINE UPDATE TYPE:
- "none": No schedule changes were discussed in the conversation
- "partial": Specific changes requested (move a class, add one item, remove something)
- "full": User wants to rebuild their entire schedule

For "partial" updates, return a 'changes' array specifying each operation.
For "full" updates, return a complete 'weekly_schedule'.
For "none", return update_type only.

CONVERSATION:
${conversationContext}

Generate a weekly schedule that includes ONLY what was explicitly discussed. Be precise and conservative - it's better to include too little than to add content that wasn't mentioned.`

    console.time('ai-api-call')
    console.log('🤖 Starting AI generation with Gemini 2.5 Flash...')

    const { object } = await generateObject({
      model: withTracing(google('gemini-2.5-flash'), phClient, {
        posthogProperties: {
          operation: 'schedule-generation',
          conversationLength: messages.length,
          contextCharacters: conversationContext.length,
          botName: 'fred-butch',
        },
        posthogPrivacyMode: false,
      }),
      schema: AIGeneratedScheduleSchema,
      schemaName: 'WeeklySchedule',
      schemaDescription:
        'A structured weekly schedule generated from the coaching conversation',
      system: systemPrompt,
      prompt:
        'Analyze the conversation above and generate a weekly schedule that includes ONLY the specific commitments, classes, assignments, and activities that were explicitly mentioned by the student. Do not add any generic activities, placeholder content, or assumptions beyond what was directly stated in the conversation.',
      temperature: 1, // Maximum consistency and determinism
    })

    await phClient.flush()

    console.timeEnd('ai-api-call')
    console.log('✅ AI generation completed')
    console.log('📋 Generated schedule object keys:', Object.keys(object))
    console.log('📌 Generated update_type:', object.update_type)

    console.timeEnd('schedule-generation-total')
    console.log('🏁 Schedule generation finished at:', new Date().toISOString())

    return Response.json({ success: true, schedule: object })
  } catch (error) {
    console.timeEnd('schedule-generation-total')
    console.error('❌ Schedule generation error at:', new Date().toISOString())
    console.error('Schedule generation error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
