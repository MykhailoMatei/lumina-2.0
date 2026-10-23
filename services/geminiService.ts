import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Goal, AppLanguage, Habit, JournalEntry, DailyBriefing } from "../types";
import { toLocalDateString, daysAgo } from "../utils/date";

const MODEL = 'gemini-3-flash-preview';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

const parseJson = <T>(text: string | undefined, fallback: T): T => {
  if (!text) return fallback;
  try {
    const cleaned = text
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
};

/**
 * Single entry point for all JSON calls.
 * Client creation is INSIDE the try, so a missing key returns the fallback
 * instead of throwing into the UI (which left loading spinners stuck).
 */
const callJson = async <T>(contents: any, fallback: T, temperature = 0.5): Promise<T> => {
  try {
    const ai = getAiClient();
    const res: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { responseMimeType: "application/json", temperature }
    });
    return parseJson<T>(res.text, fallback);
  } catch (e) {
    console.error("Gemini call failed:", e);
    return fallback;
  }
};

const getLangInstr = (lang: AppLanguage) =>
  `CRITICAL: Response MUST be strictly in ${lang}. Output ONLY valid JSON.`;

/* ------------------------------------------------------------------ */
/* Compact summaries of user data (keeps prompts small and relevant)   */
/* ------------------------------------------------------------------ */

const summarizeHabits = (habits: Habit[]) => {
  const last14 = new Set(Array.from({ length: 14 }, (_, i) => toLocalDateString(daysAgo(i))));
  return habits.slice(0, 20).map(h => ({
    title: h.title,
    timeOfDay: h.timeOfDay,
    streak: h.streak,
    completionsLast14Days: h.completedDates.filter(d => last14.has(d)).length,
    linkedToGoal: !!h.linkedGoalId
  }));
};

const summarizeGoals = (goals: Goal[]) =>
  goals.slice(0, 15).map(g => ({
    title: g.title,
    category: g.category,
    progress: g.progress,
    paused: !!g.isPaused,
    completed: g.completed,
    why: g.whyStatement || undefined
  }));

const summarizeJournal = (entries: JournalEntry[]) =>
  entries.slice(0, 8).map(e => ({
    date: e.date.split('T')[0],
    mood: e.mood,
    text: e.content.slice(0, 300)
  }));

/* ------------------------------------------------------------------ */
/* Growth audit                                                        */
/* ------------------------------------------------------------------ */

export interface GrowthAudit {
  summary: string;
  correlation: string;
  advice: string;
  trajectory: string;
  happinessTrigger: string;
  mentalThemes: string[];
  identityScores: { subject: string; A: number; fullMark: number }[];
  archetype: string;
  isCalibrating: boolean;
}

const DEFAULT_SCORES = ['Health', 'Career', 'Creativity', 'Learning', 'Personal', 'Financial']
  .map(subject => ({ subject, A: 50, fullMark: 100 }));

const AUDIT_FALLBACK: GrowthAudit = {
  summary: "Data patterns are stabilizing.",
  correlation: "Identifying leverage points.",
  advice: "Stick to the schedule.",
  trajectory: "Incremental progress.",
  happinessTrigger: "Your routine is your foundation.",
  mentalThemes: ["Consistency"],
  identityScores: DEFAULT_SCORES,
  archetype: "Systems Builder",
  isCalibrating: true
};

export const generateGrowthAudit = async (
  habits: Habit[],
  goals: Goal[],
  journal: JournalEntry[],
  lang: AppLanguage
): Promise<GrowthAudit> => {
  const isEarlyStage = goals.length <= 1 && habits.length === 0 && journal.length === 0;

  const userData = {
    today: toLocalDateString(),
    habits: summarizeHabits(habits),
    goals: summarizeGoals(goals),
    recentJournal: summarizeJournal(journal)
  };

  const prompt = `${getLangInstr(lang)}
You are the "Lumina Growth Architect", a practical, high-performance coach.

COACHING PHILOSOPHY:
1. AVOID ancient metaphors (mountains, rivers, monks, roots).
2. VOICE: intelligent, grounded in behavioral psychology, actionable.
3. FOCUS: systems over willpower, environment over motivation.
4. STYLE: minimalist, kind, but focused on data and trends.
5. Base every statement on the USER DATA below. Reference specific habits, goals or moods. Do not invent facts.

USER DATA:
${JSON.stringify(userData)}

Return JSON with exactly these keys:
{
  "summary": "Observation of current momentum and cognitive load.",
  "correlation": "A link between daily systems and long-term targets.",
  "advice": "Actionable adjustment based on behavioral science.",
  "trajectory": "The logical next step.",
  "archetype": "2-3 word identity label",
  "happinessTrigger": "One specific win to leverage.",
  "mentalThemes": ["3 short themes"],
  "identityScores": [{"subject":"Health","A":0-100,"fullMark":100}, ...for Health, Career, Creativity, Learning, Personal, Financial],
  "isCalibrating": false
}
Score identityScores from the evidence; use 50 where there is no evidence.`;

  const parsed = await callJson<Partial<GrowthAudit>>(prompt, {}, 0.4);
  const scores = Array.isArray(parsed.identityScores) && parsed.identityScores.length > 0
    ? parsed.identityScores
    : DEFAULT_SCORES;

  // No usable response at all -> fallback
  if (!parsed.summary) return { ...AUDIT_FALLBACK, isCalibrating: isEarlyStage || true };

  return {
    ...AUDIT_FALLBACK,
    ...parsed,
    identityScores: scores,
    isCalibrating: parsed.isCalibrating ?? isEarlyStage
  };
};

/* ------------------------------------------------------------------ */
/* Daily briefing                                                      */
/* ------------------------------------------------------------------ */

const BRIEFING_FALLBACK: DailyBriefing = {
  motivation: "Consistency is the only variable within your direct control. Focus on the execution, not the outcome.",
  focus: "Operational Efficiency",
  tip: "Reduce friction in your environment to make your desired habits the default choice.",
  journalPrompt: "What was the most effective choice you made today?",
  priorityTask: "Audit your current workload and identify one high-leverage task to focus on."
};

export const generateDailyBriefing = async (
  name: string,
  goals: Goal[],
  habits: Habit[],
  recentJournal: JournalEntry[],
  lang: AppLanguage
): Promise<DailyBriefing> => {
  const userData = {
    name: name.split(' ')[0],
    goals: summarizeGoals(goals.filter(g => !g.completed)),
    habits: summarizeHabits(habits),
    recentJournal: summarizeJournal(recentJournal).slice(0, 3)
  };

  const prompt = `${getLangInstr(lang)}
You are a Modern Growth Mentor. Grounded, practical, behavioral-science focused.

STRICT RULES:
1. NO ARCHAIC METAPHORS: never use mountains, rivers, flowers, or ancient wisdom.
2. MODERN TONE: use terms like 'friction', 'cognitive load', 'systems', 'leverage', 'momentum'.
3. NO INFORMAL GREETINGS: do not use "Hey" or "Hi". Start with the insight.
4. 'motivation' is a practical truth about growth or psychology.
5. 'priorityTask' is a 'High-Leverage Invitation' tied to one of the user's real goals or habits when possible.

USER DATA:
${JSON.stringify(userData)}

Return JSON: { "motivation", "focus", "tip", "journal_prompt", "priorityTask" }.`;

  const data = await callJson<any>(prompt, null, 0.7);
  if (!data) return BRIEFING_FALLBACK;

  return {
    motivation: data.motivation || BRIEFING_FALLBACK.motivation,
    focus: data.focus || BRIEFING_FALLBACK.focus,
    tip: data.tip || BRIEFING_FALLBACK.tip,
    journalPrompt: data.journal_prompt || data.journalPrompt || BRIEFING_FALLBACK.journalPrompt,
    priorityTask: data.priorityTask || BRIEFING_FALLBACK.priorityTask
  };
};

/* ------------------------------------------------------------------ */
/* Smaller helpers                                                     */
/* ------------------------------------------------------------------ */

export const testApiConnection = async () => {
  try {
    const ai = getAiClient();
    const res = await ai.models.generateContent({ model: MODEL, contents: "Reply 'OK'." });
    return { success: !!res.text, message: "AI Connection verified!" };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
};

export const suggestAtomicHabit = async (habitTitle: string, lang: AppLanguage) => {
  const prompt = `${getLangInstr(lang)} Suggest a smaller, high-leverage version of this habit: "${habitTitle}". JSON: { "suggestion", "reason" }.`;
  return callJson(prompt, { suggestion: habitTitle, reason: "Consistency over intensity." });
};

export const generateMilestonesForGoal = async (goalTitle: string, lang: AppLanguage): Promise<string[]> => {
  const prompt = `${getLangInstr(lang)} Give 5 strategic, concrete milestones for the goal "${goalTitle}". JSON array of strings.`;
  const res = await callJson<any>(prompt, []);
  const list = Array.isArray(res) ? res : Array.isArray(res?.milestones) ? res.milestones : [];
  return list.filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0);
};

export const translateContent = async (title: string, content: string, lang: AppLanguage) => {
  const prompt = `Translate to ${lang}. Return JSON {"title","content"}.\nTitle: ${title}\nContent: ${content}`;
  return callJson(prompt, { title, content }, 0.2);
};

export const generateEntryInsight = async (
  content: string,
  mood: string,
  goalTitle: string | null,
  habitTitle: string | null,
  imageData: string | null,
  lang: AppLanguage
): Promise<string> => {
  const text = `${getLangInstr(lang)}
Give ONE short strategic growth insight (max 2 sentences) about this journal reflection.
Avoid archaic wisdom; focus on psychology and next actions.
Mood: ${mood}
Linked goal: ${goalTitle ?? 'none'}
Linked habit: ${habitTitle ?? 'none'}
Reflection: ${content}
JSON: { "insight": "..." }`;

  const parts: any[] = [{ text }];
  if (imageData?.includes(',')) {
    parts.push({
      inlineData: {
        data: imageData.split(',')[1],
        mimeType: imageData.split(';')[0].split(':')[1]
      }
    });
  }

  const res = await callJson<{ insight?: string }>({ parts }, {});
  return res.insight || "Your patterns reflect your priorities. Alignment is an ongoing practice.";
};