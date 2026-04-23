# WSU Coug Scheduler

An AI-powered scheduling assistant for Washington State University students. Students complete an onboarding survey, chat with "Fred the Lion" (an AI academic success coach), and collaboratively build a weekly schedule. Fred uses motivational interviewing to help students understand their time constraints and make realistic plans.

## Features

- **Onboarding survey** — Captures sleep habits, productive hours, and study preferences
- **AI chat with tool calling** — Fred can search the WSU course catalog, create/remove calendar items, and check for conflicts, all through structured tool calls to Google Gemini
- **Semantic course search** — Vector embeddings (768-dim, cosine similarity) over the WSU course catalog so Fred can look up real course details
- **iCal/ICS sync** — Import events from Google Calendar, Outlook, or Apple Calendar via ICS feed URLs
- **Date-keyed calendar** — Schedule items stored by full date (YYYY-MM-DD), with sorting by start time
- **Persistent chat history** — Single unified conversation across all sessions, stored in localStorage
- **Configurable Gemini model** — Switch between Gemini 2.5 Flash, 3 Flash Preview, and 3.1 Flash Lite Preview via a single constant

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Next.js (App Router) |
| UI | React, Radix UI (shadcn/ui), Tailwind CSS |
| AI | Vercel AI SDK, Google Gemini (configurable model) |
| Embeddings | `@google/genai` with `gemini-embedding-001` |
| State | localStorage via custom hooks (no database) |
| Analytics | PostHog, Vercel Analytics |
| Validation | Zod |
| Package Manager | pnpm |

## Project Structure

```
app/
  api/
    chat/route.ts                  # Streaming AI chat with tool calling
    generate-schedule/route.ts     # Structured schedule generation (generateObject)
    fetch-ics/route.ts             # Server-side ICS calendar fetching (CORS bypass)
    vector-encoding/
      route.ts                     # Semantic course search API
      course-search.ts             # Cosine similarity search over embeddings
      embed.ts                     # Text embedding via gemini-embedding-001
      format-courses.ts            # Course data → AI prompt formatting
      data/courses.json            # WSU course catalog
      data/course-embeddings.json  # Precomputed 768-dim embeddings
      Scripts/
        generate-embeddings.ts     # Script to regenerate course embeddings
        Scrape-WSU-Courses.ps1     # PowerShell scraper for WSU catalog
  globals.css                      # Global styles + responsive media queries
  layout.tsx                       # Root layout, theme, PostHog init
  page.tsx                         # Single-page app — all views composed here
  providers.tsx                    # App-wide providers (PostHog)

ui/
  views/
    ChatView.tsx                   # Chat interface with tool sync + auto-retry
    MainView.tsx                   # Calendar, week picker, task list, Fred button
    SurveyView.tsx                 # Onboarding survey
    TaskEditorView.tsx             # Add/edit/delete tasks
  components/                      # shadcn/ui primitives (button, card, dialog, slider)
  theme-provider.tsx               # Dark/light mode

lib/
  ai-chat-hook.ts                  # useAIChat — wraps useChat with persistence
  constants.ts                     # Gemini models, days, months, semester dates, survey questions
  ical-parser.ts                   # ICS feed parsing and schedule integration
  persistence-hooks.ts             # Client state hooks (survey, schedule, chat, navigation)
  schedule-tools.ts                # Tool schemas + server-side execution (create, remove, get)
  schedule-transformer.ts          # AI schedule output → ScheduleItems conversion
  schemas.ts                       # Zod schemas and TypeScript types
  storage-utils.ts                 # localStorage helpers (save/load/clear/migrate)
  utils.ts                         # Date formatting, week date calculation
```

## AI Tool Calls

Fred has access to the following tools during chat, executed server-side:

| Tool | Purpose |
| ---- | ------- |
| `get_schedule` | Retrieve the full current schedule (call before creating items to check conflicts) |
| `create_schedule_items` | Add items to the calendar (requires title, date, start_time; optional end_time, type, location, is_recurring) |
| `remove_schedule_items` | Remove items by title match |
| `search_courses` | Semantic search over the WSU course catalog (top 5 results, score > 0.62) |
| `complete_onboarding` | Trigger full schedule generation after the student agrees to a plan |

## Quick Start

See [SETUP.md](SETUP.md) for full local development instructions.

```bash
git clone https://github.com/swanzeyb/v0-coug-scheduler.git
cd v0-coug-scheduler
pnpm install
# Create .env.local with: NEXT_GEMINI_API_KEY=your_key_here
pnpm dev
```

## Deployment

1. Fork the repository on GitHub
2. Import into [Vercel](https://vercel.com) (Framework: Next.js, install/build with pnpm)
3. Add the `NEXT_GEMINI_API_KEY` environment variable in Vercel project settings
4. Deploy

**Live URL**: https://v0-coug-scheduler-one.vercel.app

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `NEXT_GEMINI_API_KEY` | Yes | Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey)) |
