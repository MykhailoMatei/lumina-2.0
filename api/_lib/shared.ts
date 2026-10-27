import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

let authClient: any = null;
let adminClient: any = null;

export const getAuthClient = () => {
  if (!authClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing');
    authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return authClient;
};

export const getAdminClient = () => {
  if (!SERVICE_KEY || !SUPABASE_URL) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
};

export async function requireUser(req: VercelRequest, res: VercelResponse) {
  const header = (req.headers.authorization as string) || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }
  try {
    const { data, error } = await getAuthClient().auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return null;
    }
    return { user: data.user, token };
  } catch (e) {
    console.error('[auth]', e);
    res.status(500).json({ error: 'Auth service unavailable.' });
    return null;
  }
}

// Per-minute limit is best effort (serverless instances don't share memory).
// The daily cap is enforced in the database and is the real protection.
const perMinute = new Map<string, { count: number; reset: number }>();
const MINUTE_LIMIT = Number(process.env.AI_PER_MINUTE || 20);
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 150);

export async function enforceLimits(userId: string, res: VercelResponse): Promise<boolean> {
  const now = Date.now();
  const cur = perMinute.get(userId);
  if (!cur || now > cur.reset) {
    perMinute.set(userId, { count: 1, reset: now + 60_000 });
  } else if (cur.count >= MINUTE_LIMIT) {
    res.status(429).json({ error: 'Too many AI requests. Please wait a moment.' });
    return false;
  } else {
    cur.count++;
  }
  if (perMinute.size > 5000) {
    for (const [k, v] of perMinute) if (now > v.reset) perMinute.delete(k);
  }

  const admin = getAdminClient();
  if (admin) {
    const { data, error } = await admin.rpc('increment_ai_usage', { p_user: userId });
    if (error) console.warn('[limits] usage counter failed:', error.message);
    else if (typeof data === 'number' && data > DAILY_LIMIT) {
      res.status(429).json({ error: 'Daily AI limit reached. Try again tomorrow.' });
      return false;
    }
  }
  return true;
}

export const getAI = () =>
  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '' });

export const cleanJson = (text: string) =>
  text.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();

const LANGS = ['English', 'French', 'German', 'Ukrainian', 'Spanish'];
export const safeLang = (l: unknown) => (LANGS.includes(String(l)) ? String(l) : 'English');
export const langInstr = (l: string) =>
  `CRITICAL: Response MUST be strictly in ${l}. Output ONLY valid JSON.`;
export const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
export const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

export async function generateWithRetry(ai: GoogleGenAI, params: any, maxRetries = 2) {
  let lastErr: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastErr = err;
      if (i < maxRetries && (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand'))) {
        await new Promise((r) => setTimeout(r, 600 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function askJson(contents: any, temperature?: number, empty = '{}') {
  const response = await generateWithRetry(getAI(), {
    model: MODEL,
    contents,
    config: {
      responseMimeType: 'application/json',
      ...(temperature !== undefined ? { temperature } : {}),
    },
  });
  return JSON.parse(cleanJson(response.text || empty));
}