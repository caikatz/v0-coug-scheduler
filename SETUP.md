# Local Development Setup

## Prerequisites

### 1. Install Git

```bash
# Check if already installed
git --version

# Windows: download from https://git-scm.com
# macOS: brew install git
```

### 2. Install Node.js (v18+)

```bash
# Windows: download from https://nodejs.org
# macOS: brew install node@20

# Verify
node --version
```

### 3. Install pnpm

```bash
npm install -g pnpm
pnpm --version
```

## Clone and Install

```bash
git clone https://github.com/swanzeyb/v0-coug-scheduler.git
cd v0-coug-scheduler
pnpm install
```

## Configure Environment

Create a `.env.local` file in the project root:

```
NEXT_GEMINI_API_KEY=your_api_key_here
```

Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Run Development Server

```bash
pnpm dev
```

Open [localhost:3000](http://localhost:3000) in your browser.

## Course Embeddings (Vector Search)

The repository includes precomputed course embeddings in `app/api/vector-encoding/data/course-embeddings.json`. If you need to regenerate them (e.g., after updating `courses.json`):

```bash
npx tsx app/api/vector-encoding/Scripts/generate-embeddings.ts
```

This requires a valid `NEXT_GEMINI_API_KEY` in `.env.local` and uses the `gemini-embedding-001` model with 768-dimensional output.

### Docker Alternative

A Docker image with prebuilt course data is available at [jakekolk/coug-schedule-app](https://hub.docker.com/repository/docker/jakekolk/coug-schedule-app/general).

This image was built for Windows x64. On other architectures, build your own image and regenerate the course catalog using the scraper (`Scripts/Scrape-WSU-Courses.ps1`) and the embedding script above.

## Editing the System Prompt

The AI system prompts are defined in `app/api/chat/route.ts`:

- **Onboarding prompt**: `createOnboardingPrompt()` (line ~51) — used during the initial chat conversation
- **Post-onboarding prompt**: `createPostOnboardingPrompt()` (line ~366) — used after the student has a schedule

Edit these functions and save; the dev server will auto-reload.

## Switching Gemini Models

Open `lib/constants.ts` and change the `ACTIVE_GEMINI_MODEL` constant:

```typescript
export const ACTIVE_GEMINI_MODEL: GeminiModelKey = '2.5-flash'  // or '3-flash' or '3.1-flash-lite'
```

## Common Issues

**Port already in use:**

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

**API key not working:**

- Verify `.env.local` exists in the project root (not `.env`)
- Check the key has no extra spaces or quotes
- Restart the dev server after changing environment variables

**Dependencies not installing:**

```bash
pnpm store prune
rm -rf node_modules
pnpm install
```
