# HardWord 🎯

A real-time word guessing game platform. Hosts create events with questions, players compete to fill in letter boxes fastest!

## Features

- **Admin Panel**: Create events, add questions with word answers, control game flow
- **Player Experience**: Join via event code, guess words in split letter boxes
- **Real-time**: Live leaderboard and instant question delivery via Supabase Realtime
- **Scoring**: First correct answer gets 10 points, second gets 9, etc.
- **Mobile Friendly**: Responsive design works on all devices

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Realtime)
- **Tailwind CSS**
- **Vercel** (Deployment)

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the contents of `schema.sql`
3. Go to **Settings → API** and copy your:
   - Project URL
   - Anon (public) key
   - Service role key

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_SESSION_SECRET=hardword_admin_secret_2024
```

### 3. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add the same environment variables in Vercel's project settings
4. Deploy!

## How It Works

### Admin Flow
1. Login at `/admin` (default: admin / admin123)
2. Create an event → get a 6-character code
3. Add questions with word answers (e.g., "Capital of France" → "PARIS")
4. Start the event when players have joined
5. Show questions one by one
6. Watch the leaderboard update in real-time

### Player Flow
1. Go to `/join` and enter the event code + your name
2. Wait for the host to start
3. When a question appears, fill in the letter boxes
4. Submit your answer — first correct answer gets the most points!
5. Watch the live leaderboard

## Scoring

| Rank | Points |
|------|--------|
| 1st  | 10     |
| 2nd  | 9      |
| 3rd  | 8      |
| 4th  | 7      |
| ...  | ...    |
| 10th+| 1      |
