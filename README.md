# WSU Butch Bot Scheduler - Deployment Instructions

Test

## Last Known Working Links

- **Live URL**: https://v0-coug-scheduler.vercel.app/
- **GitHub URL**: https://github.com/swanzeyb/v0-coug-scheduler

## 1. Fork Repository

1. Go to the repository on GitHub
2. Click "Fork" button in top-right
3. Select your account as destination

## 2. Deploy to Vercel via GitHub

1. Go to [vercel.com](https://vercel.com)
2. Sign up/login with GitHub account
3. Click "New Project"
4. Import your forked repository
5. Configure build settings:
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`
6. Click "Deploy"

## 3. Setup n8n Instance

### Option A: n8n Cloud (Easiest, $24/month)

1. Go to [n8n.cloud](https://n8n.cloud)
2. Sign up for account
3. Choose Starter plan ($24/month)
4. Access your n8n instance URL (e.g., `https://yourname.app.n8n.cloud`)

### Option B: Self-hosted (Free, Technical)

1. Use Railway template: [railway.app/template/n8n-with-workers](https://railway.app/template/n8n-with-workers)
2. Deploy with one click
3. Set environment variables:
   - Generate encryption key: `openssl rand -base64 24`
   - Set `N8N_ENCRYPTION_KEY` to generated key
4. Access deployed URL from Railway dashboard

## 4. Import Workflow to n8n

1. Open your n8n instance
2. Click "+" to create new workflow
3. Click the three dots menu → "Import from file"
4. Upload the `wsu-butch-bot.json` file
5. Click "Save" after import
6. Click "Execute workflow" to activate
7. Copy the webhook URL from the webhook node (format: `https://your-n8n-instance.com/webhook/[webhook-id]`)

## 5. Configure Google Gemini API

1. In n8n workflow, click on "Google Gemini Chat Model" node
2. Click "Create new credential"
3. Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Paste API key and save credential

## 6. Update Environment Variable in Vercel

1. Go to your Vercel project dashboard
2. Click "Settings" tab
3. Click "Environment Variables" in sidebar
4. Add new variable:
   - Name: `NEXT_PUBLIC_N8N_WEBHOOK_URL`
   - Value: Your webhook URL from step 4.7
5. Redeploy project (click "Deployments" → three dots → "Redeploy")

## 7. Test Deployment

1. Visit your Vercel deployment URL
2. Send a test message to Butch
3. Verify response comes from your n8n instance

## Required Accounts

- GitHub (free)
- Vercel (free tier available)
- Google AI Studio (free tier available)
- n8n Cloud ($24/month) OR Railway/similar (free tier available)

## Monthly Costs

- **Minimum**: $0 (free tiers only, self-hosted n8n)
- **Recommended**: $24 (n8n Cloud for reliability)
