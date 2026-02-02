
# Architecture


## Directory Structure
```
app/
  api/
    chat/
      route.ts                 # Streaming chat with Fred (Gemini)
    generate-schedule/
      route.ts                 # Extracts structured schedule from conversation (Gemini)

  globals.css                  # Global styles
  layout.tsx                   # Root layout, theme setup, PostHog init
  page.tsx                     # SINGLE PAGE APP – all views are composed here
  providers.tsx                # App-wide providers (PostHog, etc.)

components/
  theme-provider.tsx           # Dark / light mode handling
  ui/                          # Radix-based UI primitives
    button.tsx
    card.tsx
    dialog.tsx
    slider.tsx

lib/
  schemas.ts                   # Zod schemas, types, validation, user preference processing
  persistence-hooks.ts         # Client state hooks (survey, schedule, chat, navigation)
  storage-utils.ts             # Local storage helpers (save/load/clear)
  ai-chat-hook.ts              # useAIChat wrapper; adds context + calls /api/chat
  schedule-transformer.ts      # AI → ScheduleItems; merge + partial update logic
  core-utils.ts                # Re-exports for tests (backward compatibility)
  webhook-service.ts           # UNUSED – legacy n8n webhook integration
```
