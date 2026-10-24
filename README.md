# Lumina: Growth & Journal

Lumina is a holistic self-improvement planner and journaling app powered by Google Gemini. Track habits, set goals, and reflect daily with personalized insights.

## Features

- **Goal tracking:** Set ambitious goals with actionable milestones and adaptive reviews.
- **Habit builder:** Build consistent routines with streaks, visual anchors, and step-by-step habit crafting.
- **AI journal:** Daily guided prompts, mood logging, and instant cognitive insights on every entry.
- **Growth audit & briefing:** Daily neuro-briefing and multi-dimensional growth audits generated directly from your personal patterns.
- **Optional cloud sync:** Secure authentication and cross-device sync powered by Supabase.
- **Local-first architecture:** Works entirely offline and stores your data on your device by default; signing in adds cloud synchronization and storage.

---

## Architecture

```text
Browser (React + Vite)  ──fetch /api/gemini/*──►  server.ts (Express)  ──►  Gemini
        │                                                │
        └── Supabase (auth, sync, storage)                └── API key stays server-side
```

The browser client never sees the Gemini API key. All AI calls route securely through `server.ts`.

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Google Gemini API key

### Install and Run

```bash
npm install
cp .env.example .env     # then set your GEMINI_API_KEY
npm run dev              # starts Express + Vite on http://localhost:3000
```

---

## Environment Variables

| Variable | Where | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server | Google Gemini API key |
| `GEMINI_MODEL` | Server (optional) | Model name used across all endpoints (defaults to `gemini-3.8-flash`) |
| `PORT` | Server (optional) | Dev / Production port (defaults to `3000`) |
| `VITE_API_BASE` | Client (optional) | API server origin if frontend is hosted separately from `server.ts` |
| `VITE_SUPABASE_URL` | Client (optional) | Supabase project URL for cloud sync and authentication |
| `VITE_SUPABASE_ANON_KEY` | Client (optional) | Supabase anon key for client-side authentication |

---

## Production Deployment

```bash
npm run build
NODE_ENV=production npm start
```

> **Note on Static Hosting (Vercel / Netlify / Cloudflare Pages):**  
> Static hosts only serve the frontend bundle. When deploying the frontend separately, run `server.ts` on a Node-capable host (e.g. Cloud Run, Railway, Render) and set `VITE_API_BASE` to your server's URL.

---

## Push Notifications

Deploy `supabase-edge-function.ts` as the `send-push-nudge` Supabase Edge Function and configure the required secrets:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

Signed-in users can only trigger notifications for themselves; automated background callers use the service-role key with a target `user_id`.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend / Proxy:** Node.js, Express, `@google/genai` (Google GenAI SDK)
- **Database & Auth:** Supabase (Auth, Postgres, Storage)
- **Offline / PWA:** Service Worker (`sw.js`), LocalStorage cache

---

## License

MIT
