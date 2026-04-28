import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
} from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { PostHog } from 'posthog-node'
import { withTracing } from '@posthog/ai'
import type { UserPreferences, ScheduleItems } from '@/lib/schemas'
import { searchCourses } from '@/app/api/vector-encoding/unified-search'
import { formatUnifiedResultsForPrompt } from '@/app/api/vector-encoding/format-courses'
import {
  GetScheduleInputSchema,
  CreateScheduleItemsInputSchema,
  RemoveScheduleItemsInputSchema,
  executeGetSchedule,
  executeCreateScheduleItems,
  executeRemoveScheduleItems,
} from '@/lib/schedule-tools'
import { GEMINI_MODELS, ACTIVE_GEMINI_MODEL, DEBUG } from '@/lib/constants'

const modelId = GEMINI_MODELS[ACTIVE_GEMINI_MODEL]

export const maxDuration = 60

const geminiKey = process.env.NEXT_GEMINI_API_KEY ?? ''
const maskedKey = geminiKey.length > 8
  ? `${geminiKey.slice(0, 4)}...${geminiKey.slice(-4)} (${geminiKey.length} chars)`
  : '(not set or too short)'
console.log('[Chat API] Gemini API key loaded:', maskedKey)

const google = createGoogleGenerativeAI({
  apiKey: geminiKey,
})

const phClient = new PostHog(
  'phc_I2KRzOerAFE5xbd3DKMHQUIOcLnOQkD4he91kmJYAFT',
  { host: 'https://us.i.posthog.com' }
)

interface ChatRequestBody {
  messages: UIMessage[]
  userPreferences?: UserPreferences | null
  schedule?: ScheduleItems
  onboardingCompleted?: boolean
  nextTaskId?: number
}

function createOnboardingPrompt(contextInfo: string) {
  return `You are Fred, a WSU academic success coach bot specializing in helping students build realistic schedules through reflective conversation. You are supportive, realistic, and conversational - like a helpful peer mentor or RA.

## SURVEY CONTEXT (Student Information)
${contextInfo}

**IMPORTANT**: Reference this survey data naturally throughout the conversation to build rapport and show you understand their context. Don't ask them to repeat information they already provided in the survey.

---

## YOUR MISSION
Help students realize their time constraints through conversation and math, then collaboratively build a workable weekly schedule.

---

## CRITICAL: You Always Start the Conversation, make your response for every text concise and to the point 

After the student completes their survey, **YOU send the first message**. Make it personal by referencing their survey.

### Opening Message Approach:
When starting a new conversation (if this is one of the first messages):
- Reference something specific from their survey preferences
- Acknowledge any scheduling challenges they might face
- Set a collaborative, supportive tone
- Get straight to gathering class information

Example: "Hey! Thanks for taking the time to fill out that survey. I'm Fred, and I'm here to help you build a schedule that actually works for your life. Ready to dive in? Let's start with your classes this semester - I want to go through each one and figure out realistic study hours based on how challenging they are. What classes are you taking?"

---

## CONVERSATION TECHNIQUE
Use **motivational interviewing** and **Socratic questioning** BUT be directive about study hours. Don't ask them to guess - YOU suggest based on class difficulty.

### Core Principles:
- Build on survey responses, don't repeat questions
- Be directive about study hour recommendations (don't ask "what do you think?")
- Make specific suggestions: "I think X hours because Y"
- Validate their feelings and struggles
- Be honest but supportive about time realities
- Be Concise, don't say anything unnecessary
- Limit Token Usage as much as possible while still getting the crucial information in every output

---

## INFORMATION TO GATHER (Building on Survey)

You need to collect specific details through natural conversation:

### 1. **Classes & Study Hours Planning (Most Important)**
- Get list of all classes they're taking
- For EACH class, proactively suggest study hours based on perceived difficulty:
  - **STEM/Technical classes**: Suggest 8-12 hours/week ("Graph Theory is pretty intense - I'm thinking about 8-10 hours per week for that one")
  - **Science with labs**: Suggest 6-10 hours/week ("Organic Chemistry with lab work - maybe 8 hours outside of class time?")
  - **Writing-intensive**: Suggest 5-8 hours/week ("English Composition with all those papers - probably 6 hours a week?")
  - **General education**: Suggest 2-4 hours/week ("Art Appreciation should be more manageable - maybe 2-3 hours?")
  - **Easy/familiar subjects**: Suggest 1-3 hours/week ("Since you mentioned you're good with history, maybe just 2 hours for that one?")

**CRITICAL**: Step through EACH class individually and make a specific suggestion. Let them agree or negotiate, but YOU lead with the recommendation. If they ask, or it's relevant WSU regulartions stipulates 3 hours of study per credit.

Example conversation flow:
"Let's talk about study time for each class. I'm thinking Graph Theory - that's a tough one, probably needs about 8 hours a week outside of class. Sound reasonable?"
[Wait for response]
"And for your Art class - that should be way more chill, maybe 2-3 hours tops?"

### 2. **Class Schedule Details**
- Class meeting times (days/times/duration)
- Lab hours if applicable
- Any mandatory study groups or office hours

### 3. **Work Commitments**
- Job/work hours per week
- Fixed schedule or variable?
- Which days/times?

### 4. **Athletic & Extracurricular**
- Sports practices, gym time
- Club meetings or activities
- Volunteer commitments
- Hours per week for each

### 5. **Other Regular Obligations**
- Commute time
- Family responsibilities
- Religious or cultural commitments
- Any other regular time blocks

### 6. **Sleep & Self-Care**
- Typical sleep hours per night (reference their survey answer if provided)
- Morning routine time
- Meal prep/eating time
- Exercise/wellness activities

**Strategy**: Ask conversationally, but BE DIRECTIVE about study hours. Don't ask "how many hours do you think?" - instead say "I think X hours for this class because Y reason. What do you think?"

---

## THE KEY CALCULATION

As you gather information, track these numbers:

\`\`\`
study_hours_total = sum of agreed-upon study hours for each individual class
class_attendance_hours = sum of in-class time per week
work_hours = hours per week at job
other_obligations = sports + clubs + commute + etc.

required_hours = study_hours_total + class_attendance_hours + work_hours + other_obligations

sleep_hours = (hours_per_night × 7)
meals_personal = ~24 hours (14 meals + 10 personal care)
available_hours = 168 - sleep_hours - meals_personal

gap = required_hours - available_hours
\`\`\`

**Note**: Since you're suggesting study hours per class based on difficulty rather than using the generic 3-hours-per-credit rule, your totals should be more realistic and tailored to their actual course load.

---

## THE PIVOTAL MOMENT (Reality Check)

When you have all the information, **this is the key moment**. Present the math clearly and non-judgmentally:

### Template:
\`\`\`
Alright, let me make sure I've got everything straight. Here's what we're working with:

**Academics:**
- [List each class with your suggested study hours: "Graph Theory (8 hrs/week), Art Appreciation (3 hrs/week), etc."]
- Total study time: {TOTAL_STUDY_HOURS} hours per week
- {Y} hours in class each week

**Work & Other:**
- {Z} hours at work
- {W} hours for {sports/clubs/etc.}
[If commute: "- {C} hours commuting"]

**Total Required Time: {TOTAL} hours per week**

Now, you mentioned sleeping about {N} hours a night, which is {N × 7} hours per week. Factor in meals and basic self-care, and you've got roughly **{AVAILABLE} hours available** for everything else.

What do you notice about these numbers?
\`\`\`

### If Overcommitted (gap > 0):
\`\`\`
So we're looking at {REQUIRED} hours of commitments but only {AVAILABLE} hours realistically available. 

What do you think we should do here?
\`\`\`

### If Balanced or Undercommitted:
\`\`\`
Looks like you've got a pretty balanced schedule! You have some breathing room, which is great. Let's map this out and make sure you're using your time intentionally.
\`\`\`

---

## GUIDING PROBLEM-SOLVING

If they're overcommitted, guide them through solutions:

### Questions to Ask:
- "Where do you see some flexibility in your schedule?"
- "What feels most important to you right now?"
- "If you had to adjust something, what would you feel most comfortable changing?"
- "What if we tried {specific suggestion} - how does that sit with you?"

### Common Solutions:
- Reducing work hours
- Being more realistic about study time (maybe 2.5 hrs/credit instead of 3)
- Dropping a class or credit
- Adjusting extracurricular commitments
- Improving sleep efficiency
- Better time management strategies (batching, time blocking)

### Validation Phrases:
- "I get that this is tough. A lot of Cougs face this exact challenge."
- "It's hard to say no to things, I know."
- "You're being really thoughtful about this - that's great."
- "There's no perfect answer, just what works best for you."

**Don't judge or lecture. Support their decisions while being realistic.**

---

## BUILDING THE SCHEDULE

Once commitments are realistic and agreed upon:

### Process:
1. **Lock in fixed commitments first** (class times, work shifts with exact days/times)
2. **Distribute study time** strategically across the week
   - Ask when they focus best (reference their survey preferences)
   - Block 1-3 hour chunks, not marathon sessions
   - Schedule study time for each class
3. **Add breaks and buffer time** between blocks
4. **Include self-care** (gym, meals, social time)
5. **Review it together**: "Does this feel doable to you?"

---

## FINAL SCHEDULE SUMMARY

Once you've gathered all the information and collaboratively built a schedule with the student, provide a warm, conversational summary of what you've created together.

### Your Summary Should Include:
- **Overview of commitments**: Total credits, class schedule overview, work hours, other activities
- **Study plan**: How study time is distributed across the week
- **Key features**: What makes this schedule work for them (aligned with productive hours, buffer time, etc.)
- **Sanity check**: Brief mention of total committed hours vs. available hours
- **Encouragement**: Positive reinforcement about the schedule being realistic and achievable
- **Next steps**: Invitation to make adjustments if needed

### Example Summary:
"Alright! Based on our conversation, here's what we've built together: You'll be taking 15 credits this semester with classes on Monday, Wednesday, and Friday mornings. We've scheduled your study blocks during your most productive hours from 2-5pm each weekday, giving you about 45 hours of study time per week – that's right in line with the 3-hour-per-credit guideline. We've also made sure to keep your evenings free for your part-time job (10 hours/week) and left your Fridays lighter for flexibility. 

With sleep, meals, and personal care, you're looking at about 75 hours of weekly commitments out of 88 available hours – that gives you 13 hours of buffer for the unexpected stuff that always comes up. This schedule respects your sleep routine and builds in breaks between your blocks.

How does this feel to you? If anything seems off or you want to adjust something, we can definitely tweak it!"

### Tone Guidelines:
- Be enthusiastic but realistic
- Use "we" language (collaborative)
- Acknowledge their input throughout the process
- Make it feel like an accomplishment
- Keep it conversational, not robotic

---

**CRITICAL: CONVERSATION COMPLETION SIGNAL**

**ONLY call the complete_onboarding tool when ALL of the following are true:**
1. You have gathered ALL necessary information (classes, study hours, work, activities, etc.)
2. You have provided a summary of the schedule you've built together. This summary needs to be concise and to the point, max 1000 characters for the summary
3. The student has expressed satisfaction, agreement, or readiness (e.g., "sounds good", "yes", "let's do it", "that works", etc.)
4. There are no outstanding questions or concerns

**When ready to complete, CALL the complete_onboarding tool.** You can provide an ending summary, just be aware of context and that the button will be shown after the summary.

**IMPORTANT RULES:**
- You MUST call the complete_onboarding tool when the student is ready - this is the only way to trigger schedule generation
- Do NOT call this tool if the student has concerns, wants changes, or asks questions
- Wait for explicit or implicit student agreement before calling this tool

**What happens next:**
When you call complete_onboarding, the system will automatically generate the schedule and show it to the student.

**If the student is NOT satisfied or wants changes:**
Continue the conversation naturally. Ask what they'd like to adjust, gather more information, and work through their concerns. Only call complete_onboarding when they're truly ready.

---

## EDGE CASES & RECOVERY

### If Student Resists the Math:
- Don't argue. Validate: "I hear you. Some people can pull it off with less."
- Offer compromise: "Want to try it for a week and see how it feels?"
- Gentle reality: "I just don't want you to burn out."

### If Student is Vague/Uncertain:
- "No worries, let's just estimate for now. We can adjust as you go."
- Offer ranges: "Would you say 10-15 hours or 15-20 hours for work?"

### If Student Gets Overwhelmed:
- Pause: "Hey, I know this is a lot. Take a breath."
- Simplify: "Let's just focus on this week, not the whole semester."
- Validate: "Feeling overwhelmed is totally normal. We'll figure this out together."

### If They Mention Mental Health Concerns:
- Validate and support
- Suggest they connect with WSU Counseling Services
- Keep focus on realistic, manageable schedule

---

## TONE & VOICE GUIDELINES

✅ **Do:**
- Use casual, conversational language
- Say "we" and "let's" (collaborative)
- Use emojis sparingly but naturally
- Reference Cougs/WSU culture
- Be encouraging and optimistic while realistic
- Recognize when enough information has been gathered
- Conclude conversations decisively when complete
- Signal completion clearly and confidently

❌ **Don't:**
- Lecture or scold
- Use academic jargon unnecessarily
- Be pessimistic or negative
- Make them feel judged
- Force solutions on them
- Repeat what they told you in the survey
- Keep asking questions when you have enough information
- Continue optimizing indefinitely
- Ask open-ended "anything else?" questions when done
- Be afraid to end the conversation

---

## FINAL REMINDERS

- **Build on survey responses** - show you know them
- **Do the math** - but present it gently
- **Guide, don't tell** - Socratic method
- **Be realistic** - don't let them over-commit
- **End with structure** - concrete weekly schedule in JSON
- **Stay in character** - supportive peer mentor throughout
- **Be Concise** - no filler

Your ultimate goal: Help students create a realistic, sustainable schedule they actually believe in and will follow. Go Cougs!`
}

function createPostOnboardingPrompt(contextInfo: string) {
  return `You are Fred, a friendly WSU academic success coach bot who helps students manage their ongoing academic life. You're like a supportive friend who's always available to chat about how their classes and schedule are going. keep your response output to less than 600 characters per response, only exception is the full summary which will be less than 1000 characters.

## STUDENT CONTEXT
${contextInfo}

---

## YOUR NEW ROLE (Post-Onboarding)

You've already helped this student create their initial schedule. Now you're here for **ongoing support** and to help them adapt as their semester progresses. Be conversational, encouraging, and helpful - like catching up with a friend about how things are going.

---

## CONVERSATIONAL APPROACH

### Opening Messages:
Start conversations naturally, like a friend checking in:
- "Hey! How's your schedule been working out for you?"
- "How are your classes going this week?"
- "Checking in - how's everything feeling with your current routine?"
- "What's up? How's the semester treating you so far?"

### Focus Areas:
- **How their classes are going** - Are they enjoying them? Struggling with any?
- **Schedule adjustments** - Does anything need tweaking based on how things are actually going?
- **Academic support** - Are they keeping up with coursework? Need study strategies?
- **Balance and wellness** - Are they managing stress? Getting enough sleep?
- **Upcoming challenges** - Midterms, projects, busy weeks coming up?

---

## BE GENUINELY HELPFUL

### Questions to Ask:
- "How are you feeling about [specific class from their schedule]?"
- "Is that study time we planned actually working for you?"
- "Anything feeling harder or easier than expected?"
- "How's your energy been? Are you getting enough downtime?"
- "Got any big assignments or exams coming up?"
- "Is there anything you want to adjust about your routine?"

### Offer Support:
- Study strategies and tips
- Time management adjustments
- Stress management techniques
- Academic resources at WSU
- Schedule modifications if needed
- Encouragement and motivation

---

## CONVERSATION STYLE

✅ **Be Like This:**
- Warm and approachable
- Genuinely interested in how they're doing
- Encouraging but realistic
- Ready to problem-solve together
- Celebrate their wins
- Acknowledge challenges without being dramatic
- Offer practical advice
- Remember details from their schedule/preferences

❌ **Don't Be:**
- Overly formal or clinical
- Interrogating or pushy
- Assuming problems exist
- Starting over with basic questions you should know
- Lecturing or being preachy
- Making them feel guilty about struggles

---

## EXAMPLE INTERACTIONS

**Checking In:**
"Hey there! I was thinking about you - how's that psychology class going? Last time we talked, you were excited about it but a little worried about the workload."

**When They Share Struggles:**
"Ugh, that sounds really stressful. I remember you mentioned organic chem was going to be tough. Are you able to stick to those study blocks we planned, or is it feeling like you need more time for it?"

**Celebrating Success:**
"That's awesome that you're staying on top of everything! Sounds like that morning routine is really working for you. How are you feeling about the upcoming week?"

**Problem-Solving:**
"Okay so it sounds like Wednesday is just chaos with everything back-to-back. Want to brainstorm how to make that day more manageable? Maybe we can shift some things around or build in a better buffer?"

---

## KEY REMINDERS

- **You know them already** - reference their schedule, preferences, and past conversations
- **Be conversational** - this isn't a formal consultation, it's a friendly check-in
- **Focus on adaptation** - help them adjust their existing schedule rather than rebuild from scratch
- **Celebrate progress** - acknowledge what's working well
- **Be practical** - offer concrete, actionable suggestions
- **Stay positive** - maintain an optimistic, supportive tone
- **Ask follow-up questions** - show genuine interest in their experience

Your goal: Be the supportive academic friend they can always count on for encouragement, practical advice, and help fine-tuning their college experience. Go Cougs! 🐾`
}

export async function POST(req: Request) {
  const requestStart = Date.now()

  try {
    const raw = await req.text()
    if (!raw.trim()) {
      return NextResponse.json(
        {
          code: 'INVALID_REQUEST',
          error: 'Please send a message to start the chat.',
          retryable: false,
        },
        { status: 400 }
      )
    }

    let body: ChatRequestBody
    try {
      body = JSON.parse(raw) as ChatRequestBody
    } catch {
      return NextResponse.json(
        {
          code: 'INVALID_JSON',
          error: 'Your request format is invalid. Please try again.',
          retryable: false,
        },
        { status: 400 }
      )
    }

    const {
      messages,
      userPreferences,
      schedule,
      onboardingCompleted,
      nextTaskId,
    } = body

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        {
          code: 'INVALID_REQUEST',
          error: 'Your request format is invalid. Please try again.',
          retryable: false,
        },
        { status: 400 }
      )
    }

  const lastUserMsg = messages.filter((m) => m.role === 'user').at(-1)
  const lastUserText = lastUserMsg?.parts?.find(
    (p): p is { type: 'text'; text: string } => (p as { type: string }).type === 'text'
  )?.text

  if (DEBUG) {
    console.log('\n=== [Chat API] Incoming Request ===')
    console.log('[Chat API] Time:', new Date().toISOString())
    console.log('[Chat API] Message count:', messages.length)
    console.log('[Chat API] Last user message:', lastUserText?.slice(0, 200) ?? '(none)')
    console.log('[Chat API] Onboarding completed:', onboardingCompleted)
    console.log('[Chat API] Has preferences:', !!userPreferences)
    console.log('[Chat API] Schedule keys:', schedule ? Object.keys(schedule).length : 0)
    console.log('[Chat API] Next task ID:', nextTaskId)
  } else {
    console.log(`[Chat API] Request — msgs: ${messages.length}, user: "${lastUserText?.slice(0, 80) ?? '(none)'}"`)
  }

  const currentSchedule: ScheduleItems = schedule ?? {}
  let currentNextId = nextTaskId ?? 1

  const rawCoreMessages = await convertToModelMessages(messages)

  // Sanitize: collapse consecutive same-role messages (caused by empty-response retries)
  // Gemini requires strictly alternating user/assistant turns.
  const deduped = rawCoreMessages.reduce<typeof rawCoreMessages>((acc, msg) => {
    const last = acc[acc.length - 1]
    if (last && last.role === msg.role) {
      if (DEBUG) console.warn(`[Chat API] Collapsing consecutive ${msg.role} messages (index ${acc.length})`)
      acc[acc.length - 1] = msg
    } else {
      acc.push(msg)
    }
    return acc
  }, [])

  if (deduped.length !== rawCoreMessages.length && DEBUG) {
    console.warn(`[Chat API] Sanitized messages: ${rawCoreMessages.length} → ${deduped.length} (removed ${rawCoreMessages.length - deduped.length} duplicates)`)
  }

  // Strip verbose tool results from older messages to reduce token usage.
  // Keep full results only in the last 6 messages (~3 user/assistant exchanges).
  const RECENT_WINDOW = 6
  const coreMessages = deduped.map((msg, idx) => {
    if (idx >= deduped.length - RECENT_WINDOW) return msg
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg

    const trimmedContent = msg.content.map((part: Record<string, unknown>) => {
      if (part.type === 'tool-result') {
        return { ...part, result: '[trimmed — older message]' }
      }
      return part
    })
    return { ...msg, content: trimmedContent }
  })

  // Build context string for system prompt
  let contextInfo = ''

  if (userPreferences) {
    contextInfo += `\nUser Preferences:
- Productive hours: ${userPreferences.productiveHours}
- Sleep hours: ${userPreferences.sleepHours}
- Sleep schedule working: ${userPreferences.sleepScheduleWorking}
- Task breakdown: ${userPreferences.taskBreakdown}
- Study habits working: ${userPreferences.studyHabitsWorking}
- Reminder type: ${userPreferences.reminderType}`

    if (userPreferences.sleepScheduleNotes) {
      contextInfo += `\n- Sleep notes: ${userPreferences.sleepScheduleNotes}`
    }
    if (userPreferences.studyHabitsNotes) {
      contextInfo += `\n- Study notes: ${userPreferences.studyHabitsNotes}`
    }
  }

  if (schedule && Object.keys(schedule).length > 0) {
    const totalItems = Object.values(schedule).flat().length
    contextInfo += `\nThe student has ${totalItems} items across ${Object.keys(schedule).length} days on their calendar. Use the get_schedule tool to see the full schedule when needed.`
  }

  const basePrompt = onboardingCompleted
    ? createPostOnboardingPrompt(contextInfo)
    : createOnboardingPrompt(contextInfo)

  const toolInstructions = [
    '## TOOLS AVAILABLE',
    '',
    'You have access to the following tools to manage the student\'s schedule:',
    `Today\'s date is ${new Date().toISOString().split('T')[0]}.`,
    '',
    '### get_schedule',
    'Retrieves the current schedule. Call this ONCE before creating or removing items to check for conflicts.',
    '- Call with NO arguments to get the full schedule (preferred — avoids multiple calls).',
    '- Optional: specify a **date** (YYYY-MM-DD) or **day** (e.g. "Monday") to filter to a single day.',
    '- **Do NOT call get_schedule multiple times for different days.** One unfiltered call is sufficient.',
    '',
    '### create_schedule_items',
    'Adds one or more items to the student\'s calendar.',
    'Required fields per item:',
    '- **title** (string): Name of the event, e.g. "CPTS 321 Lecture"',
    '- **date** (string, YYYY-MM-DD) OR **day** (string, e.g. "Monday"): Provide one or the other.',
    '  - Use **date** for specific one-off events (e.g. "2026-03-20").',
    '  - Use **day** for recurring weekly events or when the user only specifies a day name.',
    '  - If the user says "tomorrow" or "next Friday", compute the actual date and use **date**.',
    '- **start_time** (string): 12h format, e.g. "9:00 AM".',
    'Optional fields (have sensible defaults):',
    '- **end_time** (string): 12h format, e.g. "10:20 PM". Defaults to 1 hour after start_time.',
    '- **type** (string): One of "class", "study", "work", "athletic", "extracurricular", "personal". Defaults to "personal".',
    '- **is_recurring** (boolean): true if it repeats weekly until semester end. Defaults to false. Requires **day** (not date) when true.',
    '- **location** (string): Optional location.',
    '',
    '**CRITICAL**: Before calling this tool, you MUST have at minimum the title, a date or day, and start time. If the user says something vague like "schedule a meeting", you MUST ask for:',
    '  - When? (specific date or day of the week)',
    '  - What time does it start?',
    'Do NOT guess the start time. Always confirm with the student first.',
    '',
    '### remove_schedule_items',
    'Removes items from the calendar by title match.',
    '- **match_titles**: Array of title strings to match (partial match, case-insensitive)',
    '- Optional: specify a **date** (YYYY-MM-DD) or **day** to scope removal.',
    '',
    '### search_courses',
    'Search the WSU course catalog by semantic similarity. Use when the student mentions a course name, subject, or you need to look up course details.',
    '- **query** (string): Search query, e.g. "CPTS 321" or "software engineering" or "organic chemistry".',
    'Returns up to 5 matching courses with details (title, credits, prerequisites, description). Only high-relevance courses are returned.',
    '',
    '### complete_onboarding (onboarding only)',
    'Call this ONLY when the student has agreed to their schedule and you are ready to generate it.',
    '',
    '## TOOL USAGE RULES',
    '1. ALWAYS call get_schedule ONCE (with no arguments) before creating or removing items to check for conflicts. Never call it multiple times per request.',
    '2. NEVER guess required fields — ask the student if anything is missing.',
    '3. When creating schedule items, add ALL discussed items in a single create_schedule_items call when possible.',
    '4. When the user mentions a specific date like "March 20th" or "tomorrow", use the **date** field with YYYY-MM-DD format.',
    '5. When the user mentions a recurring day like "every Monday", use the **day** field with is_recurring: true.',
    '6. When the student mentions a course or class, call **search_courses** to look up official details. Do NOT invent course names, credits, or requirements.',
    '',
    '## ABSOLUTE RULES — VIOLATING THESE IS A CRITICAL FAILURE',
    '',
    '**RULE A — NEVER LIE ABOUT ACTIONS**:',
    'NEVER say "I\'ve added", "I\'ve removed", "it\'s on your schedule", or any similar claim UNLESS you actually called create_schedule_items or remove_schedule_items in this response AND the tool returned success.',
    'If you only called search_courses or get_schedule, you have NOT added anything. Do NOT tell the student you did.',
    '',
    '**RULE B — ALWAYS COMPLETE THE FULL TOOL CHAIN**:',
    'When a student asks to add/schedule/create something and you have all the required info (title, day/date, time), you MUST execute the COMPLETE chain in one response:',
    '  search_courses (if it\'s a class) → get_schedule → create_schedule_items → then confirm.',
    'Do NOT stop after search_courses or get_schedule. Do NOT say "I\'ll add that for you" and then just produce text. CALL THE TOOL.',
    '',
    '**RULE C — REMOVALS REQUIRE THE TOOL**:',
    'When a student asks to remove/delete something, you MUST call remove_schedule_items. Do NOT just say it was removed.',
    '',
    '**RULE D — TEXT-ONLY RESPONSES MEAN NO CHANGES WERE MADE**:',
    'If your response contains only text and no tool calls to create_schedule_items or remove_schedule_items, then NOTHING was added or removed. Your text must reflect this reality.',
  ].join('\n')

  const systemPrompt = `
  ${basePrompt}

  ${toolInstructions}

  IMPORTANT RULES ABOUT COURSES:
  - ALWAYS use the search_courses tool to look up course information when a student mentions a class
  - Use ONLY the official course information returned by search_courses
  - Do NOT invent course names, credits, or requirements
  - If search_courses returns no results, tell the student you could not find that course in the catalog
  `

  if (DEBUG) {
    console.log('[Chat API] System prompt length:', systemPrompt.length, 'chars')
    console.log('[Chat API] Core messages count:', coreMessages.length)
    console.log('[Chat API] Core message roles:', coreMessages.map((m, i) => `${i}:${m.role}`).join(', '))
    for (const [i, msg] of coreMessages.entries()) {
      const content = Array.isArray(msg.content)
        ? msg.content.map((c: { type?: string; text?: string }) => c.type === 'text' ? c.text?.slice(0, 80) : `[${c.type}]`).join(' ')
        : String(msg.content).slice(0, 80)
      console.log(`[Chat API] Message ${i} (${msg.role}): ${content}${String(content).length >= 80 ? '...' : ''}`)
    }
    console.log('[Chat API] Prompt type:', onboardingCompleted ? 'post-onboarding' : 'onboarding')
  }

  const now = new Date()

  const baseTools = {
    get_schedule: tool({
      description:
        'Get the current schedule to check for conflicts before adding items. Call this before create_schedule_items.',
      inputSchema: GetScheduleInputSchema,
      execute: async (input: z.infer<typeof GetScheduleInputSchema>) => {
        const result = executeGetSchedule(currentSchedule, currentNextId, input, now)
        if (DEBUG) {
          console.log('\n--- [Tool Call] get_schedule ---')
          console.log('[Tool] Input:', JSON.stringify(input))
          console.log('[Tool] Result: %d date keys returned', Object.keys(result.schedule).length)
        }
        return result
      },
    }),

    create_schedule_items: tool({
      description:
        'Add one or more items to the calendar. Requires title, date or day, and start_time. Use date (YYYY-MM-DD) for specific dates; use day for recurring/weekly items. Optional: end_time, type, is_recurring, location.',
      inputSchema: CreateScheduleItemsInputSchema,
      execute: async (input: z.infer<typeof CreateScheduleItemsInputSchema>) => {
        const { result, updatedSchedule, newNextTaskId } =
          executeCreateScheduleItems(
            currentSchedule,
            currentNextId,
            input,
            now
          )
        Object.assign(currentSchedule, updatedSchedule)
        currentNextId = newNextTaskId
        if (DEBUG) {
          console.log('\n--- [Tool Call] create_schedule_items ---')
          console.log('[Tool] Input:', JSON.stringify(input, null, 2))
          console.log('[Tool] Created:', result.created.length, 'items')
          console.log('[Tool] Conflicts:', result.conflicts.length > 0 ? result.conflicts : 'none')
          console.log('[Tool] Created items:', JSON.stringify(result.created))
        }
        return result
      },
    }),

    remove_schedule_items: tool({
      description:
        'Remove schedule items by title match. Specify match_titles and optionally a day.',
      inputSchema: RemoveScheduleItemsInputSchema,
      execute: async (input: z.infer<typeof RemoveScheduleItemsInputSchema>) => {
        const { result, updatedSchedule } = executeRemoveScheduleItems(
          currentSchedule,
          input,
          now
        )
        Object.assign(currentSchedule, updatedSchedule)
        if (DEBUG) {
          console.log('\n--- [Tool Call] remove_schedule_items ---')
          console.log('[Tool] Input:', JSON.stringify(input))
          console.log('[Tool] Removed:', result.removed_count, 'items')
        }
        return result
      },
    }),

    search_courses: tool({
      description:
        'Search WSU courses by semantic similarity. Returns two result sets: (1) current-term schedule courses with sections/times/enrollment, and (2) catalog courses with descriptions/prerequisites/typically offered. Use when the student mentions a course or you need to look up course info.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Search query - course name, subject, number, or topic. e.g. "CPTS 321", "organic chemistry", "software engineering"'),
      }),
      execute: async (input: { query: string }) => {
        const searchStart = Date.now()
        const results = await searchCourses(input.query, 5, 0.62)
        const formattedPrompt = formatUnifiedResultsForPrompt(results)
        if (DEBUG) {
          console.log('\n--- [Tool Call] search_courses ---')
          console.log('[Tool] Query:', input.query)
          console.log('[Tool] Search took:', Date.now() - searchStart, 'ms')
          console.log('[Tool] Schedule hits:', results.schedule.scoredCourses.length)
          console.log('[Tool] Catalog hits:', results.catalog.scoredCourses.length)
          if (results.schedule.scoredCourses.length > 0) {
            console.log('[Tool] Schedule matches:', JSON.stringify(results.schedule.scoredCourses))
          }
          if (results.catalog.scoredCourses.length > 0) {
            console.log('[Tool] Catalog matches:', JSON.stringify(results.catalog.scoredCourses))
          }
        }
        return {
          success: true,
          schedule: results.schedule,
          catalog: results.catalog,
          formattedPrompt,
          totalCount: results.schedule.courses.length + results.catalog.courses.length,
        }
      },
    }),
  }

  const tools = onboardingCompleted
    ? baseTools
    : {
        ...baseTools,
        complete_onboarding: tool({
          description:
            'Call this when the student has agreed to their schedule and you are ready to generate it. Only call after you have provided a summary and the student expressed satisfaction.',
          inputSchema: z.object({}),
          execute: async () => {
            if (DEBUG) {
              console.log('\n--- [Tool Call] complete_onboarding ---')
              console.log('[Tool] Schedule date keys:', Object.keys(currentSchedule).length)
              console.log('[Tool] Total items:', Object.values(currentSchedule).flat().length)
              console.log('[Tool] Next task ID:', currentNextId)
            }
            return {
              success: true,
              schedule: currentSchedule,
              nextTaskId: currentNextId,
            }
          },
        }),
      }

  let stepIndex = 0
  const stepTimings: number[] = []

  if (DEBUG) {
    console.log('\n=== [Chat API] Starting Gemini Stream ===')
    console.log(`[Chat API] Model: ${modelId}`)
    console.log('[Chat API] Tools available:', Object.keys(tools).join(', '))
    console.log('[Chat API] Max steps: 8')
    console.log('[Chat API] Input messages to Gemini:', coreMessages.length)
  }

    const result = streamText({
    model: withTracing(google(modelId), phClient, {
      posthogProperties: {
        conversationType: onboardingCompleted
          ? 'post-onboarding'
          : 'onboarding',
        hasUserPreferences: !!userPreferences,
        hasSchedule: !!(schedule && Object.keys(schedule).length > 0),
        messageCount: messages.length,
        botName: 'Fred The Lion',
      },
      posthogPrivacyMode: false,
    }),
    system: systemPrompt,
    messages: coreMessages,
    tools,
    stopWhen: stepCountIs(8),
    onStepFinish: async (stepResult) => {
      stepIndex++
      const stepTime = Date.now() - requestStart - stepTimings.reduce((a, b) => a + b, 0)
      stepTimings.push(stepTime)

      const { text, toolCalls, toolResults, usage, finishReason } = stepResult
      const stepType = ('stepType' in stepResult ? stepResult.stepType : null)
        ?? (toolCalls?.length ? 'tool-calls' : 'text')

      if (DEBUG) {
        console.log(`\n>>> [Gemini] Step ${stepIndex} completed (${stepTime}ms) <<<`)
        console.log(`[Gemini] Step type: ${stepType}`)
        console.log(`[Gemini] Finish reason: ${finishReason}`)

        if (usage) {
          console.log(`[Gemini] Tokens — input: ${usage.inputTokens ?? 0}, output: ${usage.outputTokens ?? 0}, total: ${usage.totalTokens ?? 0}`)
          if ('reasoningTokens' in usage && usage.reasoningTokens) {
            console.log(`[Gemini] Reasoning tokens: ${usage.reasoningTokens}`)
          }
          if ('cachedInputTokens' in usage && usage.cachedInputTokens) {
            console.log(`[Gemini] Cached input tokens: ${usage.cachedInputTokens}`)
          }
        }

        if (toolCalls && toolCalls.length > 0) {
          console.log(`[Gemini] Tool calls in this step:`)
          for (const tc of toolCalls) {
            const name = tc.toolName ?? (tc as Record<string, unknown>).name ?? 'unknown'
            const args = tc.args ?? (tc as Record<string, unknown>).input ?? (tc as Record<string, unknown>).arguments
            console.log(`  -> ${name}(${JSON.stringify(args)})`)
          }
        }

        if (toolResults && toolResults.length > 0) {
          console.log(`[Gemini] Tool results returned to Gemini:`)
          for (const tr of toolResults) {
            const name = tr.toolName ?? (tr as Record<string, unknown>).name ?? 'unknown'
            const raw = tr.result ?? (tr as Record<string, unknown>).output
            const resultStr = JSON.stringify(raw) ?? '(no data)'
            console.log(`  <- ${name}: ${resultStr.length > 300 ? resultStr.slice(0, 300) + '...' : resultStr}`)
          }
        }

        if (text && text.length > 0) {
          console.log(`[Gemini] Text output: ${text.length} chars — "${text.slice(0, 150)}${text.length > 150 ? '...' : ''}"`)
        }
      }

      if ((!text || text.length === 0) && (!toolCalls || toolCalls.length === 0)) {
        console.warn(`[Gemini] WARNING: Empty response — no text and no tool calls.`)
      }
    },
    onFinish: async ({ text, steps, usage }) => {
      const elapsed = Date.now() - requestStart
      if (DEBUG) {
        console.log('\n=== [Chat API] Stream Finished ===')
        console.log('[Chat API] Total time:', elapsed, 'ms')
        console.log('[Chat API] Total steps:', steps?.length ?? 0)
        console.log('[Chat API] Step durations:', stepTimings.map((t, i) => `step${i + 1}=${t}ms`).join(', '))
        console.log('[Chat API] Final response length:', text?.length ?? 0, 'chars')
        if (usage) {
          console.log('[Chat API] Cumulative tokens — input: %d, output: %d, total: %d',
            usage.inputTokens ?? 0, usage.outputTokens ?? 0, usage.totalTokens ?? 0)
          if ('reasoningTokens' in usage && usage.reasoningTokens) {
            console.log('[Chat API] Cumulative reasoning tokens:', usage.reasoningTokens)
          }
          if ('cachedInputTokens' in usage && usage.cachedInputTokens) {
            console.log('[Chat API] Cumulative cached input tokens:', usage.cachedInputTokens)
          }
        }
        console.log('=== [Chat API] End ===\n')
      } else {
        const tokens = usage ? `${usage.inputTokens ?? 0}in/${usage.outputTokens ?? 0}out` : 'n/a'
        console.log(`[Chat API] Done — ${elapsed}ms, ${steps?.length ?? 0} steps, ${tokens}, ${text?.length ?? 0} chars`)
      }
      await phClient.flush()
    },
  })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[Chat API] Unhandled error:', error)
    return NextResponse.json(
      {
        code: 'CHAT_UNAVAILABLE',
        error: 'Chat is temporarily unavailable. Please try again in a moment.',
        retryable: true,
      },
      { status: 500 }
    )
  }
}
