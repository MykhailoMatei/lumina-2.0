import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

  // Large payload limit for base64 image uploads in journal insights
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // --- Gemini Server-Side API Endpoints ---

  // 1. Health check & test connection
  app.get('/api/gemini/test-connection', async (_req: Request, res: Response) => {
    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: 'gemini-3.8-flash',
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
    You are the "Lumina Growth Architect." You are a practical, high-performance coach.
    
    COACHING PHILOSOPHY:
    1. AVOID: Ancient metaphors (mountains, rivers, monks, roots). 
    2. VOICE: Intelligent, grounded in behavioral psychology, and actionable.
    3. FOCUS: Systems over willpower. Environment over motivation.
    4. STYLE: Minimalist, kind, but focused on data and trends.

    USER DATA CONTEXT:
    Habits: ${JSON.stringify(habits.map((h: any) => ({ title: h.title, streak: h.streak, timeOfDay: h.timeOfDay })))}
    Goals: ${JSON.stringify(goals.map((g: any) => ({ title: g.title, category: g.category, completed: g.completed })))}
    Recent Reflections: ${JSON.stringify(journal.slice(0, 5).map((j: any) => ({ mood: j.mood, content: j.content?.slice(0, 150) })))}

    JSON OUTPUT:
    {
      "summary": "Observation of current momentum and cognitive load.",
      "correlation": "A link between daily systems and long-term targets.",
      "advice": "Actionable adjustment based on behavioral science.",
      "trajectory": "The logical next step in the user's evolution.",
      "archetype": "Strategic Planner",
      "happinessTrigger": "One specific win the user should leverage.",
      "mentalThemes": ["Momentum", "Cognitive Load", "Systems"],
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
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.4 },
      });
      const parsed = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json({ ...parsed, isCalibrating: parsed.isCalibrating ?? isEarlyStage });
    } catch (e: any) {
      console.error('[Gemini growth-audit error]', e);
      // Graceful fallback matching original behavior
      res.json({
        summary: 'Data patterns are stabilizing.',
        correlation: 'Identifying leverage points.',
        advice: 'Stick to the schedule.',
        trajectory: 'Incremental progress.',
        happinessTrigger: 'Your routine is your foundation.',
        mentalThemes: ['Consistency'],
        identityScores: [
          { subject: 'Health', A: 50, fullMark: 100 },
          { subject: 'Career', A: 50, fullMark: 100 },
          { subject: 'Creativity', A: 50, fullMark: 100 },
          { subject: 'Learning', A: 50, fullMark: 100 },
          { subject: 'Personal', A: 50, fullMark: 100 },
          { subject: 'Financial', A: 50, fullMark: 100 },
        ],
        archetype: 'Systems Builder',
        isCalibrating: true,
      });
    }
  });

  // 3. Daily Briefing
  app.post('/api/gemini/daily-briefing', async (req: Request, res: Response) => {
    const { name = 'Growth Traveler', goals = [], habits = [], recentJournal = [], lang = 'English' } = req.body;

    const prompt = `${getLangInstr(lang)} 
    You are a Modern Growth Mentor for ${name}. Your voice is grounded, practical, and focuses on behavioral science.
    
    STRICT RULES:
    1. NO ARCHAIC METAPHORS: Never use mountains, rivers, flowers, or ancient wisdom.
    2. MODERN TONE: Use terms like 'friction', 'cognitive load', 'systems', 'leverage', and 'momentum'.
    3. NO INFORMAL GREETINGS: Do not use "Hey," "Hi," or "I was thinking." Start with the insight.
    4. ACTION-ORIENTED: The 'motivation' should be a practical truth about personal growth or psychology.
    5. KEYSTONE TASK ('priorityTask'): Frame it as a 'High-Leverage Invitation'.

    ACTIVE TARGETS:
    Goals: ${goals.slice(0, 3).map((g: any) => g.title).join(', ') || 'Personal mastery'}
    Habits: ${habits.slice(0, 4).map((h: any) => h.title).join(', ') || 'Daily momentum'}
    Recent Mood: ${recentJournal?.[0]?.mood || 'Neutral'}

    JSON: { "motivation": "...", "focus": "...", "tip": "...", "journal_prompt": "...", "priorityTask": "..." }.`;

    try {
      const ai = getGenAIClient();
      const response = await generateWithRetry(ai, {
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.7 },
      });
      const data = JSON.parse(cleanJsonResponse(response.text || '{}'));
      res.json({
        motivation: data.motivation || 'Success is the product of daily systems, not once-in-a-lifetime transformations.',
        focus: data.focus || 'System Integrity',
        tip: data.tip || 'Identify the point of greatest friction in your routine and resolve it.',
        journalPrompt: data.journal_prompt || data.journalPrompt || 'What choice today saved you time or energy?',
        priorityTask: data.priorityTask || 'Audit your current queue and eliminate one non-essential task.',
      });
    } catch (err) {
      console.error('[Gemini daily-briefing error]', err);
      res.json({
        motivation: 'Consistency is the only variable within your direct control. Focus on the execution, not the outcome.',
        focus: 'Operational Efficiency',
        tip: 'Reduce friction in your environment to make your desired habits the default choice.',
        journalPrompt: 'What was the most effective choice you made today?',
        priorityTask: 'Audit your current workload and identify one high-leverage task to focus on.',
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
        model: 'gemini-3.8-flash',
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
        model: 'gemini-3.8-flash',
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
        model: 'gemini-3.8-flash',
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

  // 7. Journal Entry Insight (with optional image)
  app.post('/api/gemini/entry-insight', async (req: Request, res: Response) => {
    const { content = '', mood = 'Neutral', goalTitle = null, habitTitle = null, imageData = null, lang = 'English' } = req.body;

    const parts: any[] = [
      {
        text: `${getLangInstr(lang)} Strategic growth insight based on this reflection. Avoid archaic wisdom. Focus on behavioral psychology and self-compassion. Mood: ${mood}.${goalTitle ? ` Related Goal: ${goalTitle}.` : ''}${habitTitle ? ` Related Habit: ${habitTitle}.` : ''} JSON: { "insight": "..." } Content: ${content}`,
      },
    ];

    if (imageData && typeof imageData === 'string' && imageData.includes(',')) {
      try {
        const mimeType = imageData.split(';')[0].split(':')[1];
        const base64Data = imageData.split(',')[1];
        if (mimeType && base64Data) {
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
        model: 'gemini-3.8-flash',
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
    const { prompt, model = 'gemini-3.8-flash', systemInstruction } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const ai = getGenAIClient();
      const responseStream = await ai.models.generateContentStream({
        model,
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
    app.get('*', (_req: Request, res: Response) => {
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
