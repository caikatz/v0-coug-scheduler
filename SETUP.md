# Local Development Setup

## Prerequisites

### 1. Install VS Code

Download and install from [code.visualstudio.com](https://code.visualstudio.com)

### 2. Install Git

```zsh
# Check if already installed
git --version

# If not installed, install via Homebrew
brew install git
```

### 3. Install Node.js (v18+)

```zsh
# Using Homebrew
brew install node@20

# Verify installation
node --version
```

### 4. Install pnpm

```zsh
npm install -g pnpm

# Verify installation
pnpm --version
```

## Clone Repository

```zsh
# Clone the repository
git clone https://github.com/swanzeyb/v0-coug-scheduler.git

# Navigate into directory
cd v0-coug-scheduler

# Open in VS Code
code .
```

## Configure Environment

Create a `.env.local` file in the project root:

```zsh
touch .env.local
```

Add your Gemini API key:

```
NEXT_GEMINI_API_KEY=your_api_key_here
```

**Get API Key:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

## Install Dependencies

```zsh
pnpm install
```

## Edit System Prompt

The AI system prompt is located in:

**File:** `app/api/chat/route.ts`  
**Line:** ~48 (starts with `const systemPrompt = `)

1. Open `app/api/chat/route.ts` in VS Code
2. Find the `systemPrompt` variable (Cmd+F to search)
3. Edit the template literal string
4. Save file (Cmd+S)

## Run Development Server

```zsh
pnpm dev
```

Open [localhost:3000](http://localhost:3000) in your browser.

## Making Changes

1. Edit the system prompt in `app/api/chat/route.ts`
2. Save the file
3. The app will automatically reload
4. Test your changes in the browser

## Common Issues

**Port already in use:**

```zsh
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**API key not working:**

- Verify `.env.local` exists in project root
- Check API key has no extra spaces
- Restart dev server after changing environment variables

**Dependencies not installing:**

```zsh
# Clear pnpm cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```
