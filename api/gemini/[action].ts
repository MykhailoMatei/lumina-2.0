import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  requireUser, enforceLimits, askJson, generateWithRetry, getAI, MODEL,
  langInstr, safeLang, clip, arr,
} from '../_lib/shared.js';

export const config = { maxDuration: 30 };

const SCORES = ['Health', 'Career', 'Creativity', 'Learning', 'Personal', 'Financial']
  .map((subject) => ({ subject, A: 50, fullMark: 100 }));

const BRIEFING_FALLBACK = {
  motivation: 'Small, consistent actions each day quietly add up to meaningful change.',
  focus: 'Daily Balance',
  tip: 'Make your next habit easy to start—even just two minutes builds momentum.',
  journalPrompt: "What is one moment from today you'd like to remember?",
  priorityTask: 'Choose one meaningful step today and give it your full attention.',
};

const WEEKLY_FALLBACK = {
  summary: 'You showed up with quiet consistency this week. Small actions laid the foundation for steady calm.',
  keyWin: 'Staying committed to your daily routines.',
  suggestedAdjustment: 'Pick one habit to keep effortless, and protect 10 minutes of quiet each evening.',
  upcomingFocus: 'Continue building momentum with steady, unhurried steps.',
};

const AUDIT_FALLBACK = {
  summary: 'Your daily patterns are steady.',
  correlation: 'Your daily habits support your bigger intentions.',
  advice: 'Take it one day at a time—consistency builds naturally.',
  trajectory: 'Steady, calm progress.',
  happinessTrigger: 'Your regular routines create a sense of calm.',
  mentalThemes: ['Consistency', 'Balance'],
  identityScores: SCORES,
  archetype: 'Mindful Explorer',
  isCalibrating: true,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || '');
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (action === 'test-connection') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const r = await generateWithRetry(getAI(), { model: MODEL, contents: "Reply 'OK'." });
      return res.json({ success: !!r.text, message: 'AI Connection verified!' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'Connection test failed' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await enforceLimits(auth.user.id, res))) return;

  const b: any = req.body || {};
  const lang = safeLang(b.lang);

  try {
    switch (action) {
      case 'growth-audit': {
        const habits = arr(b.habits), goals = arr(b.goals), journal = arr(b.journal);
        const isEarly = goals.length <= 1 && habits.length === 0 && journal.length === 0;
        const prompt = `${langInstr(lang)}
You are Lumina, a thoughtful and grounded mentor for personal growth.

GUIDELINES:
1. TONE: Warm, calm, concise, and encouraging. Avoid overly corporate jargon and vague pseudo-spiritual mysticism.
2. FOCUS: Clear observations based on habits, goals, and journal logs. Practical, realistic steps.
3. STYLE: Respectful, reflective, and human.

USER DATA CONTEXT:
Habits: ${JSON.stringify(habits.slice(0, 30).map((h: any) => ({ title: clip(h.title, 80), streak: h.streak, timeOfDay: h.timeOfDay })))}
Goals: ${JSON.stringify(goals.slice(0, 30).map((g: any) => ({ title: clip(g.title, 80), category: g.category, completed: g.completed })))}
Recent Reflections: ${JSON.stringify(journal.slice(0, 5).map((j: any) => ({ mood: j.mood, content: clip(j.content, 150) })))}

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
          const parsed = await askJson(prompt, 0.4);
          return res.json({ ...parsed, isCalibrating: parsed.isCalibrating ?? isEarly });
        } catch (e) {
          console.error('[growth-audit]', e);
          return res.json(AUDIT_FALLBACK);
        }
      }

      case 'daily-briefing': {
        const name = clip(b.name || 'Friend', 40);
        const goals = arr(b.goals), habits = arr(b.habits), recent = arr(b.recentJournal);
        const prompt = `${langInstr(lang)}
You are Lumina, a warm and grounded daily companion for ${name}.

STRICT RULES:
1. CALM & GROUNDED: Avoid corporate jargon.
2. AVOID MYSTICISM: Avoid grand cosmic or mystical metaphors.
3. CLEAR & ENCOURAGING: Keep thoughts concise, empathetic, and actionable.
4. FOCUS: Simple consistency, showing up, and enjoying the present day.

ACTIVE TARGETS:
Goals: ${goals.slice(0, 3).map((g: any) => clip(g.title, 80)).join(', ') || 'Personal growth'}
Habits: ${habits.slice(0, 4).map((h: any) => clip(h.title, 80)).join(', ') || 'Daily routines'}
Recent Mood: ${clip(recent?.[0]?.mood || 'Neutral', 20)}

JSON: { "motivation": "...", "focus": "...", "tip": "...", "journal_prompt": "...", "priorityTask": "..." }.`;
        try {
          const d = await askJson(prompt, 0.7);
          return res.json({
            motivation: d.motivation || BRIEFING_FALLBACK.motivation,
            focus: d.focus || BRIEFING_FALLBACK.focus,
            tip: d.tip || BRIEFING_FALLBACK.tip,
            journalPrompt: d.journal_prompt || d.journalPrompt || BRIEFING_FALLBACK.journalPrompt,
            priorityTask: d.priorityTask || BRIEFING_FALLBACK.priorityTask,
          });
        } catch (e) {
          console.error('[daily-briefing]', e);
          return res.json(BRIEFING_FALLBACK);
        }
      }

      case 'atomic-habit': {
        const title = clip(b.habitTitle, 120);
        try {
          const d = await askJson(`${langInstr(lang)} Suggest a high-leverage, frictionless version of: "${title}". JSON: { "suggestion": "...", "reason": "..." }.`);
          return res.json(d);
        } catch (e) {
          console.error('[atomic-habit]', e);
          return res.json({ suggestion: title, reason: 'Consistency over intensity.' });
        }
      }

      case 'goal-milestones': {
        const title = clip(b.goalTitle, 120);
        try {
          const d = await askJson(`${langInstr(lang)} 5 strategic, progressive milestones for "${title}". JSON array of strings.`, undefined, '[]');
          return res.json(Array.isArray(d) ? d : []);
        } catch (e) {
          console.error('[goal-milestones]', e);
          return res.json([]);
        }
      }

      case 'translate': {
        const title = clip(b.title, 300), content = clip(b.content, 5000);
        try {
          const d = await askJson(`Translate to ${lang}. JSON { "title": "...", "content": "..." }. Title: ${title} Content: ${content}`);
          return res.json(d);
        } catch (e) {
          console.error('[translate]', e);
          return res.json({ title, content });
        }
      }

      case 'weekly-review': {
        const name = clip(b.name || 'Friend', 40);
        const prompt = `${langInstr(lang)} You are a warm, calm, reflective mentor in Lumina.
Provide a peaceful weekly reflection for ${name}.
Context:
- Habits: ${JSON.stringify(arr(b.habits).slice(0, 30).map((h: any) => ({ title: clip(h.title, 80), streak: h.streak })))}
- Recent journal entries & wins: ${JSON.stringify(arr(b.recentJournal).slice(0, 5).map((j: any) => ({ title: clip(j.title, 80), content: clip(j.content, 300), mood: j.mood })))}
- Active goals: ${JSON.stringify(arr(b.goals).slice(0, 30).map((g: any) => ({ title: clip(g.title, 80), progress: g.progress })))}
- Week stats: ${JSON.stringify(b.weekStats || {})}

Respond in valid JSON with:
{
  "summary": "A peaceful 1-2 sentence reflection celebrating this past week's consistency and rhythm.",
  "keyWin": "A brief recognition of a win or consistent effort observed this week.",
  "suggestedAdjustment": "One gentle, realistic adjustment for next week. Avoid harshness or productivity buzzwords.",
  "upcomingFocus": "A calm, one-sentence guiding intention for the upcoming week."
}`;
        try {
          const d = await askJson(prompt, 0.7);
          return res.json({
            summary: d.summary || WEEKLY_FALLBACK.summary,
            keyWin: d.keyWin || WEEKLY_FALLBACK.keyWin,
            suggestedAdjustment: d.suggestedAdjustment || WEEKLY_FALLBACK.suggestedAdjustment,
            upcomingFocus: d.upcomingFocus || WEEKLY_FALLBACK.upcomingFocus,
          });
        } catch (e) {
          console.error('[weekly-review]', e);
          return res.json(WEEKLY_FALLBACK);
        }
      }

      case 'entry-insight': {
        const content = clip(b.content, 6000);
        const mood = clip(b.mood || 'Neutral', 20);
        const goalTitle = b.goalTitle ? clip(b.goalTitle, 80) : null;
        const habitTitle = b.habitTitle ? clip(b.habitTitle, 80) : null;
        const parts: any[] = [{
          text: `${langInstr(lang)} Provide a brief, supportive, uplifting 1-2 sentence observation or encouraging takeaway based on this journal entry. Be warm, genuine, positive, and practical. Avoid preachiness or unsolicited critique. Mood: ${mood}.${goalTitle ? ` Related Goal: ${goalTitle}.` : ''}${habitTitle ? ` Related Habit: ${habitTitle}.` : ''} JSON: { "insight": "..." } Content: ${content}`,
        }];

        // Only inline data: URLs are accepted. The server never fetches remote URLs.
        const img = typeof b.imageData === 'string' ? b.imageData : '';
        const m = img.match(/^data:(image\/[a-z+.-]+);base64,/i);
        if (m && img.length < 4_000_000) {
          parts.push({ inlineData: { data: img.slice(m[0].length), mimeType: m[1] } });
        }

        try {
          const d = await askJson({ parts });
          return res.json({ insight: d.insight || 'Your patterns reflect your priorities. Alignment is an ongoing practice.' });
        } catch (e) {
          console.error('[entry-insight]', e);
          return res.json({ insight: 'Execution is the best form of reflection.' });
        }
      }

      default:
        return res.status(404).json({ error: 'Unknown action' });
    }
  } catch (e: any) {
    console.error('[gemini]', e);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}