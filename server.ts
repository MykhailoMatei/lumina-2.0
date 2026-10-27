import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://woxthjwqqlpmnlqtpced.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_NFIu48_HmmoIBixfMjBdbw_vYWN1bRo';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Rate limiters: per-minute window and daily cap per authenticated user
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();
const userDailyCounts = new Map<string, { date: string; count: number }>();

// Periodic memory cleanup every 10 minutes to prevent maps from growing indefinitely
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of userRequestCounts.entries()) {
    if (now > val.resetTime) {
      userRequestCounts.delete(key);
    }
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const [key, val] of userDailyCounts.entries()) {
    if (val.date !== todayStr) {
      userDailyCounts.delete(key);
    }
  }
}, 10 * 60 * 1000);

const geminiAuthAndRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  // Allow health test check without user session
  if (req.path === '/test-connection') {
    return next();
  }

  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const { data, error } = await supabaseServer.auth.getUser(token);
        if (!error && data?.user?.id) {
          userId = data.user.id;
          (req as any).user = data.user;
        }
      } catch (err) {
        console.warn('[Gemini Auth] Non-fatal token verification warning:', err);
      }
    }
  }

  // Closed Beta Policy: Generative AI endpoints require an authenticated user account
  if (!userId) {
    return res.status(401).json({
      error: 'Please sign in or create an account to access AI features during the closed beta.',
    });
  }

  // 1. Check daily cap (100 AI requests per user per calendar day)
  const todayStr = new Date().toISOString().slice(0, 10);
  const daily = userDailyCounts.get(userId);
  if (!daily || daily.date !== todayStr) {
    userDailyCounts.set(userId, { date: todayStr, count: 1 });
  } else if (daily.count >= 100) {
    return res.status(429).json({
      error: 'Daily AI generation quota reached (100 requests/day). Your quota will reset at midnight.',
    });
  } else {
    daily.count++;
  }

  // 2. Check per-minute burst rate limit (60 req/minute per user)
  const clientKey = `user:${userId}`;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 60;

  const current = userRequestCounts.get(clientKey);
  if (!current || now > current.resetTime) {
    userRequestCounts.set(clientKey, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (current.count >= limit) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before sending more AI requests.',
    });
  }

  current.count++;
  next();
};

// Initialize Google GenAI with User-Agent header as required
const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    console.warn('[Gemini] Warning: Neither GEMINI_API_KEY nor API_KEY is set in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const cleanJsonResponse = (text: string): string => {
  return text.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
};

const getLangInstr = (lang: string) => 
  `CRITICAL: Response MUST be strictly in ${lang}. Output ONLY valid JSON.`;

async function generateWithRetry(ai: GoogleGenAI, params: any, maxRetries = 2) {
  let lastErr;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastErr = err;
      if (i < maxRetries && (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand'))) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Trust proxy for correct IP identification behind reverse proxy
  app.set('trust proxy', 1);

  // Enable CORS
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'apikey', 'x-client-info']
  }));

  // Large payload limit for base64 image uploads in journal insights
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // Remote error reporting endpoint for client error monitoring
  app.post('/api/errors/report', (req: Request, res: Response) => {
    const { message, stack, context, timestamp } = req.body || {};
    console.error(`[Remote Tester Error] [${context || 'client'}] ${message}`, stack ? `\nStack: ${stack}` : '');
    res.json({ success: true });
  });

  // Apply auth and rate limiter to all Gemini AI proxy routes
  app.use('/api/gemini', geminiAuthAndRateLimiter);

  // --- Account Deletion Endpoint (Admin Service Role Verified Wipe) ---
  app.delete('/api/account/delete', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required to delete account.' });
    }

    if (!supabaseAdmin) {
      console.error('[Account Delete] SUPABASE_SERVICE_ROLE_KEY is missing on server.');
      return res.status(503).json({
        error: 'Account deletion requires SUPABASE_SERVICE_ROLE_KEY to be configured on the server.',
      });
    }

    const token = authHeader.slice(7).trim();
    try {
      const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
      if (authErr || !user) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
      }

      const userId = user.id;

      // 1. Purge database records using admin privileges (bypassing RLS constraints)
      const [goalsRes, habitsRes, journalRes, pushRes] = await Promise.all([
        supabaseAdmin.from('goals').delete().eq('user_id', userId),
        supabaseAdmin.from('habits').delete().eq('user_id', userId),
        supabaseAdmin.from('journal_entries').delete().eq('user_id', userId),
        supabaseAdmin.from('user_push_subscriptions').delete().eq('user_id', userId),
      ]);

      if (goalsRes.error || habitsRes.error || journalRes.error || pushRes.error) {
        console.warn('[Account Delete] Partial table purge warning:', {
          goals: goalsRes.error?.message,
          habits: habitsRes.error?.message,
          journal: journalRes.error?.message,
          push: pushRes.error?.message,
        });
      }

      // 2. Purge user files from storage using admin client
      try {
        const { data: avatars } = await supabaseAdmin.storage.from('avatars').list(userId);
        if (avatars && avatars.length > 0) {
          await supabaseAdmin.storage.from('avatars').remove(avatars.map((f: any) => `${userId}/${f.name}`));
        }
        const { data: journalFiles } = await supabaseAdmin.storage.from('journal').list(userId);
        if (journalFiles && journalFiles.length > 0) {
          await supabaseAdmin.storage.from('journal').remove(journalFiles.map((f: any) => `${userId}/${f.name}`));
        }
      } catch (storageErr) {
        console.warn('[Account Delete] Storage cleanup warning:', storageErr);
      }

      // 3. Delete the auth user from Supabase auth.users
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delErr) {
        console.error('[Account Delete] Auth admin deleteUser error:', delErr);
        return res.status(500).json({ error: `Failed to remove user account: ${delErr.message}` });
      }

      return res.json({ success: true, message: 'Account, data, and authentication record deleted permanently.' });
    } catch (err: any) {
      console.error('[Account Delete] Unexpected error:', err);
      return res.status(500).json({ error: err.message || 'Failed to delete account' });
    }
  });

  // --- Gemini Server-Side API Endpoints ---

  // 1. Health check & test connection
  app.get('/api/gemini/test-connection', async (_req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: "Reply 'OK'.",
      });
      res.json({ success: !!response.text, message: 'AI Connection verified!' });
    } catch (e: any) {
      console.error('[Gemini test-connection error]', e);
      res.status(500).json({ success: false, message: e.message || 'Connection test failed' });
    }
  });

  // 2. Growth Audit
  app.post('/api/gemini/growth-audit', async (req: Request, res: Response) => {
    const { habits = [], goals = [], journal = [], lang = 'English' } = req.body;
    const isEarlyStage = goals.length <= 1 && habits.length === 0 && journal.length === 0;

    const prompt = `${getLangInstr(lang)} 
    You are Lumina, a thoughtful and grounded mentor for personal growth.
    
    GUIDELINES:
    1. TONE: Warm, calm, concise, and encouraging. Avoid overly corporate jargon (no "operational efficiency", "cognitive load", "leverage", or "execution audit") and avoid vague pseudo-spiritual mysticism.
    2. FOCUS: Clear observations based on habits, goals, and journal logs. Practical, realistic steps.
    3. STYLE: Respectful, reflective, and human.

    USER DATA CONTEXT:
    Habits: ${JSON.stringify(habits.map((h: any) => ({ title: h.title, streak: h.streak, timeOfDay: h.timeOfDay })))}
    Goals: ${JSON.stringify(goals.map((g: any) => ({ title: g.title, category: g.category, completed: g.completed })))}
    Recent Reflections: ${JSON.stringify(journal.slice(0, 5).map((j: any) => ({ mood: j.mood, content: j.content?.slice(0, 150) })))}

    JSON OUTPUT:
    {
      "summary": "Warm, encouraging observation of current habits and routines.",
      "correlation": "A gentle connection between daily actions and long-term intentions.",
      "advice": "A simple, doable suggestion for the coming days.",
      "trajectory": "A realistic and positive look at current progress.",
      "archetype": "Mindful Explorer",
      "happinessTrigger": "One specific win or positive routine the user can build on.",
      "mentalThemes": ["Consistency", "Balance", "Daily Focus"],
      "identityScores": [
          {"subject": "Health", "A": 50, "fullMark": 100},
          {"subject": "Career", "A": 50, "fullMark": 100},
          {"subject": "Creativity", "A": 50, "fullMark": 100},
          {"subject": "Learning", "A": 50, "fullMark": 100},
          {"subject": "Personal", "A": 50, "fullMark": 100},
          {"subject": "Financial", "A": 50, "fullMark": 100}
      ],
      "isCalibrating": false
    }`;

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.4 },
      });
      const parsed = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json({ ...parsed, isCalibrating: parsed.isCalibrating ?? isEarlyStage });
    } catch (e: any) {
      console.error('[Gemini growth-audit error]', e);
      // Graceful fallback matching original behavior
      res.json({
        summary: 'Your daily patterns are steady.',
        correlation: 'Your daily habits support your bigger intentions.',
        advice: 'Take it one day at a time—consistency builds naturally.',
        trajectory: 'Steady, calm progress.',
        happinessTrigger: 'Your regular routines create a sense of calm.',
        mentalThemes: ['Consistency', 'Balance'],
        identityScores: [
          { subject: 'Health', A: 50, fullMark: 100 },
          { subject: 'Career', A: 50, fullMark: 100 },
          { subject: 'Creativity', A: 50, fullMark: 100 },
          { subject: 'Learning', A: 50, fullMark: 100 },
          { subject: 'Personal', A: 50, fullMark: 100 },
          { subject: 'Financial', A: 50, fullMark: 100 },
        ],
        archetype: 'Mindful Explorer',
        isCalibrating: true,
      });
    }
  });

  // 3. Daily Briefing
  app.post('/api/gemini/daily-briefing', async (req: Request, res: Response) => {
    const { name = 'Friend', goals = [], habits = [], recentJournal = [], lang = 'English' } = req.body;

    const prompt = `${getLangInstr(lang)} 
    You are Lumina, a warm and grounded daily companion for ${name}.
    
    STRICT RULES:
    1. CALM & GROUNDED: Avoid corporate jargon (do NOT use "operational efficiency", "friction points", "cognitive load", or "tactical leverage").
    2. AVOID MYSTICISM: Avoid grand cosmic or mystical metaphors.
    3. CLEAR & ENCOURAGING: Keep thoughts concise, empathetic, and actionable.
    4. FOCUS: Simple consistency, showing up, and enjoying the present day.

    ACTIVE TARGETS:
    Goals: ${goals.slice(0, 3).map((g: any) => g.title).join(', ') || 'Personal growth'}
    Habits: ${habits.slice(0, 4).map((h: any) => h.title).join(', ') || 'Daily routines'}
    Recent Mood: ${recentJournal?.[0]?.mood || 'Neutral'}

    JSON: { "motivation": "...", "focus": "...", "tip": "...", "journal_prompt": "...", "priorityTask": "..." }.`;

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.7 },
      });
      const data = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json({
        motivation: data.motivation || 'Small, consistent actions each day quietly add up to meaningful change.',
        focus: data.focus || 'Daily Balance',
        tip: data.tip || 'Make your next habit easy to start—even just two minutes builds momentum.',
        journalPrompt: data.journal_prompt || data.journalPrompt || "What is one moment from today you'd like to remember?",
        priorityTask: data.priorityTask || 'Choose one meaningful step today and give it your full attention.',
      });
    } catch (err) {
      console.error('[Gemini daily-briefing error]', err);
      res.json({
        motivation: 'Small, consistent actions each day quietly add up to meaningful change.',
        focus: 'Daily Balance',
        tip: 'Make your next habit easy to start—even just two minutes builds momentum.',
        journalPrompt: "What is one moment from today you'd like to remember?",
        priorityTask: 'Choose one meaningful step today and give it your full attention.',
      });
    }
  });

  // 4. Atomic Habit Suggestion
  app.post('/api/gemini/atomic-habit', async (req: Request, res: Response) => {
    const { habitTitle = '', lang = 'English' } = req.body;
    const prompt = `${getLangInstr(lang)} Suggest a high-leverage, frictionless version of: "${habitTitle}". JSON: { "suggestion": "...", "reason": "..." }.`;

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const data = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json(data);
    } catch (e) {
      console.error('[Gemini atomic-habit error]', e);
      res.json({ suggestion: habitTitle, reason: 'Consistency over intensity.' });
    }
  });

  // 5. Goal Milestones
  app.post('/api/gemini/goal-milestones', async (req: Request, res: Response) => {
    const { goalTitle = '', lang = 'English' } = req.body;
    const prompt = `${getLangInstr(lang)} 5 strategic, progressive milestones for "${goalTitle}". JSON array of strings.`;

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const data = JSON.parse(cleanJsonResponse(response.text || '[]'));
      res.json(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('[Gemini goal-milestones error]', e);
      res.json([]);
    }
  });

  // 6. Content Translation
  app.post('/api/gemini/translate', async (req: Request, res: Response) => {
    const { title = '', content = '', lang = 'English' } = req.body;
    const prompt = `Translate to ${lang}. JSON { "title": "...", "content": "..." }. Title: ${title} Content: ${content}`;

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const data = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json(data);
    } catch (e) {
      console.error('[Gemini translate error]', e);
      res.json({ title, content });
    }
  });

  // Weekly Review Synthesis
  app.post('/api/gemini/weekly-review', async (req: Request, res: Response) => {
    const { name = 'Friend', habits = [], goals = [], recentJournal = [], weekStats = {}, lang = 'English' } = req.body;
    const prompt = `${getLangInstr(lang)} You are a warm, calm, reflective mentor in Lumina.
Provide a peaceful weekly reflection for ${name}.
Context:
- Habits: ${JSON.stringify((habits || []).map((h: any) => ({ title: h.title, streak: h.streak })))}
- Recent journal entries & wins: ${JSON.stringify((recentJournal || []).slice(0, 5).map((j: any) => ({ title: j.title, content: j.content, mood: j.mood })))}
- Active goals: ${JSON.stringify((goals || []).map((g: any) => ({ title: g.title, progress: g.progress })))}
- Week stats: ${JSON.stringify(weekStats)}

Respond in valid JSON with:
{
  "summary": "A peaceful 1-2 sentence reflection celebrating this past week's consistency and rhythm.",
  "keyWin": "A brief recognition of a win or consistent effort observed this week.",
  "suggestedAdjustment": "One gentle, realistic adjustment for next week (e.g. keeping evening routines simpler, protecting morning focus). Avoid harshness or excessive productivity buzzwords.",
  "upcomingFocus": "A calm, one-sentence guiding intention for the upcoming week."
}`;

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.7 },
      });
      const data = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json({
        summary: data.summary || "You showed up with quiet consistency this week. Small actions laid the foundation for steady calm.",
        keyWin: data.keyWin || "Staying committed to your daily routines.",
        suggestedAdjustment: data.suggestedAdjustment || "Pick one habit to keep effortless, and protect 10 minutes of quiet each evening.",
        upcomingFocus: data.upcomingFocus || "Continue building momentum with steady, unhurried steps."
      });
    } catch (e) {
      console.error('[Gemini weekly-review error]', e);
      res.json({
        summary: "You showed up with quiet consistency this week. Small actions laid the foundation for steady calm.",
        keyWin: "Staying committed to your daily routines.",
        suggestedAdjustment: "Pick one habit to keep effortless, and protect 10 minutes of quiet each evening.",
        upcomingFocus: "Continue building momentum with steady, unhurried steps."
      });
    }
  });

  // 7. Journal Entry Insight (with optional image)
  app.post('/api/gemini/entry-insight', async (req: Request, res: Response) => {
    const { content = '', mood = 'Neutral', goalTitle = null, habitTitle = null, imageData = null, lang = 'English' } = req.body;

    const parts: any[] = [
      {
        text: `${getLangInstr(lang)} Provide a brief, supportive, uplifting 1-2 sentence observation or encouraging takeaway based on this journal entry. Whether it is a simple daily log (what they did/ate), a small victory, or a deeper reflection, be warm, genuine, positive, and practical. Avoid preachiness, unsolicited critique, or ancient metaphors. Mood: ${mood}.${goalTitle ? ` Related Goal: ${goalTitle}.` : ''}${habitTitle ? ` Related Habit: ${habitTitle}.` : ''} JSON: { "insight": "..." } Content: ${content}`,
      },
    ];

    if (imageData && typeof imageData === 'string') {
      try {
        let mimeType = 'image/jpeg';
        let base64Data: string | null = null;

        if (imageData.startsWith('data:')) {
          const commaIdx = imageData.indexOf(',');
          if (commaIdx !== -1) {
            const header = imageData.slice(0, commaIdx);
            base64Data = imageData.slice(commaIdx + 1);
            const match = header.match(/:(.*?);/);
            if (match && match[1]) mimeType = match[1];
          }
        } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
          try {
            const fetchRes = await fetch(imageData);
            if (fetchRes.ok) {
              const arrayBuf = await fetchRes.arrayBuffer();
              base64Data = Buffer.from(arrayBuf).toString('base64');
              const cType = fetchRes.headers.get('content-type');
              if (cType) mimeType = cType;
            }
          } catch (fetchErr) {
            console.warn('Failed to fetch remote image for entry insight:', fetchErr);
          }
        } else if (imageData.length > 100 && !imageData.startsWith('http')) {
          base64Data = imageData;
        }

        if (base64Data) {
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          });
        }
      } catch (err) {
        console.warn('Failed to parse image for insight generation:', err);
      }
    }

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: MODEL,
        contents: { parts },
        config: { responseMimeType: 'application/json' },
      });
      const data = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json({ insight: data.insight || 'Your patterns reflect your priorities. Alignment is an ongoing practice.' });
    } catch (e) {
      console.error('[Gemini entry-insight error]', e);
      res.json({ insight: 'Execution is the best form of reflection.' });
    }
  });

  // 8. Streaming Content Generation (Server-Sent Events)
  app.post('/api/gemini/generate-stream', async (req: Request, res: Response) => {
    const { prompt, model = MODEL, systemInstruction } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.length > 10000) {
      return res.status(400).json({ error: 'Valid prompt under 10000 characters required.' });
    }

    const ALLOWED_MODELS = [MODEL, 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.8-flash'];
    const safeModel = typeof model === 'string' && ALLOWED_MODELS.includes(model) ? model : MODEL;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const ai = getGenAIClient();
      const responseStream = await ai.models.generateContentStream({
        model: safeModel,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('[Gemini generate-stream error]', err);
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  });

  // --- WebSocket Server for Real-Time Gemini Live API ---
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/live' || url.pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[Live] Client connected to Live WebSocket');
    let liveSession: any = null;

    try {
      const ai = getGenAIClient();
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are Lumina, an intelligent, grounded, behavioral growth mentor and reflective companion.',
        },
        callbacks: {
          onmessage: (message: any) => {
            try {
              if (clientWs.readyState === WebSocket.OPEN) {
                const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ audio }));
                }
                const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
                if (text) {
                  clientWs.send(JSON.stringify({ text }));
                }
                if (message.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
              }
            } catch (err) {
              console.error('[Live callback error]', err);
            }
          },
          onclose: () => {
            console.log('[Live] Gemini session closed');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
          onerror: (err: any) => {
            console.error('[Live session error]', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Live session error' }));
            }
          },
        },
      });

      clientWs.on('message', (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio && liveSession) {
            liveSession.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (parsed.text && liveSession) {
            liveSession.sendRealtimeInput({
              text: parsed.text,
            });
          }
        } catch (err) {
          console.error('[Live message parsing error]', err);
        }
      });

      clientWs.on('close', () => {
        console.log('[Live] Client disconnected');
        try {
          if (liveSession) liveSession.close();
        } catch (err) {
          // ignore
        }
      });
    } catch (err: any) {
      console.error('[Live connect error]', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: err?.message || 'Failed to initialize Live API session' }));
        clientWs.close();
      }
    }
  });

  // Explicitly serve Service Worker and Web Manifest with exact headers
  app.get('/sw.js', (_req: Request, res: Response) => {
    res.type('application/javascript');
    const pubPath = path.resolve(__dirname, 'public', 'sw.js');
    if (fs.existsSync(pubPath)) return res.sendFile(pubPath);
    const distPath = path.resolve(__dirname, 'dist', 'sw.js');
    if (fs.existsSync(distPath)) return res.sendFile(distPath);
    res.sendFile(path.resolve(__dirname, 'sw.js'));
  });

  app.get('/manifest.json', (_req: Request, res: Response) => {
    res.type('application/manifest+json');
    const pubPath = path.resolve(__dirname, 'public', 'manifest.json');
    if (fs.existsSync(pubPath)) return res.sendFile(pubPath);
    const distPath = path.resolve(__dirname, 'dist', 'manifest.json');
    if (fs.existsSync(distPath)) return res.sendFile(distPath);
    res.sendFile(path.resolve(__dirname, 'manifest.json'));
  });

  // --- Vite Dev Server Middleware or Static Production Serving ---
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    // Express 5 catch-all syntax
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Lumina] Server running on port ${PORT} (production: ${isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('[Lumina] Failed to start server:', err);
  process.exit(1);
});
