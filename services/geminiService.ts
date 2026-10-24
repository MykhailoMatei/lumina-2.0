import { Goal, AppLanguage, Habit, JournalEntry, DailyBriefing } from "../types";

const GET_DAILY_FALLBACK = (_lang: AppLanguage): DailyBriefing => {
  return {
    motivation: "Consistency is the only variable within your direct control. Focus on the execution, not the outcome.",
    focus: "Operational Efficiency",
    tip: "Reduce friction in your environment to make your desired habits the default choice.",
    journalPrompt: "What was the most effective choice you made today?",
    priorityTask: "Audit your current workload and identify one high-leverage task to focus on."
  };
};

export const generateGrowthAudit = async (
    habits: Habit[], 
    goals: Goal[], 
    journal: JournalEntry[], 
    lang: AppLanguage
): Promise<{ 
  summary: string, 
  correlation: string, 
  advice: string, 
  trajectory: string,
  happinessTrigger: string,
  mentalThemes: string[],
  identityScores: { subject: string, A: number, fullMark: number }[],
  archetype: string,
  isCalibrating: boolean
}> => {
    try {
        const res = await fetch('/api/gemini/growth-audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habits, goals, journal, lang })
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        return data;
    } catch (e) {
        console.error('Error generating growth audit:', e);
        return { 
            summary: "Data patterns are stabilizing.", 
            correlation: "Identifying leverage points.", 
            advice: "Stick to the schedule.", 
            trajectory: "Incremental progress.", 
            happinessTrigger: "Your routine is your foundation.", 
            mentalThemes: ["Consistency"], 
            identityScores: [], 
            archetype: "Systems Builder", 
            isCalibrating: true 
        };
    }
};

export const generateDailyBriefing = async (
    name: string, 
    goals: Goal[], 
    habits: Habit[], 
    recentJournal: JournalEntry[], 
    lang: AppLanguage
): Promise<DailyBriefing> => {
  try {
    const res = await fetch('/api/gemini/daily-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, goals, habits, recentJournal, lang })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return {
      motivation: data.motivation || "Success is the product of daily systems, not once-in-a-lifetime transformations.",
      focus: data.focus || "System Integrity",
      tip: data.tip || "Identify the point of greatest friction in your routine and resolve it.",
      journalPrompt: data.journalPrompt || data.journal_prompt || "What choice today saved you time or energy?",
      priorityTask: data.priorityTask || "Audit your current queue and eliminate one non-essential task."
    };
  } catch (err) {
    console.error('Error generating daily briefing:', err);
    return GET_DAILY_FALLBACK(lang);
  }
};

export const testApiConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch('/api/gemini/test-connection');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData.message || `Server returned ${res.status}` };
    }
    const data = await res.json();
    return { success: data.success, message: data.message || "AI Connection verified!" };
  } catch (e: any) { 
    return { success: false, message: e.message || "Network error testing connection" }; 
  }
};

export const suggestAtomicHabit = async (habitTitle: string, lang: AppLanguage): Promise<{ suggestion: string; reason: string }> => {
  try {
    const res = await fetch('/api/gemini/atomic-habit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitTitle, lang })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e) { 
    console.error('Error suggesting atomic habit:', e);
    return { suggestion: habitTitle, reason: "Consistency over intensity." }; 
  }
};

export const generateMilestonesForGoal = async (goalTitle: string, lang: AppLanguage): Promise<string[]> => {
  try {
    const res = await fetch('/api/gemini/goal-milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalTitle, lang })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { 
    console.error('Error generating milestones:', e);
    return []; 
  }
};

export const translateContent = async (title: string, content: string, lang: AppLanguage): Promise<{ title: string; content: string }> => {
  try {
    const res = await fetch('/api/gemini/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, lang })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e) { 
    console.error('Error translating content:', e);
    return { title, content }; 
  }
};

export const generateEntryInsight = async (
  content: string, 
  mood: string, 
  goalTitle: string | null, 
  habitTitle: string | null, 
  imageData: string | null, 
  lang: AppLanguage
): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/entry-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, mood, goalTitle, habitTitle, imageData, lang })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data.insight || "Your patterns reflect your priorities. Alignment is an ongoing practice.";
  } catch (e) { 
    console.error('Error generating entry insight:', e);
    return "Execution is the best form of reflection."; 
  }
};

/**
 * Helper to stream text content from the server-side Gemini API using SSE
 */
export const streamGeminiContent = async (
  prompt: string,
  onChunk: (text: string) => void,
  onComplete?: () => void,
  onError?: (err: any) => void
): Promise<void> => {
  try {
    const response = await fetch('/api/gemini/generate-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to initiate stream: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') {
          onComplete?.();
          return;
        }
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.text) {
            onChunk(parsed.text);
          } else if (parsed.error) {
            onError?.(new Error(parsed.error));
            return;
          }
        } catch {
          // ignore non-json chunk
        }
      }
    }
    onComplete?.();
  } catch (err) {
    onError?.(err);
  }
};

/**
 * Helper to create a WebSocket connection to the server's Gemini Live API bridge
 */
export const connectGeminiLive = (callbacks: {
  onAudio?: (base64Audio: string) => void;
  onText?: (text: string) => void;
  onInterrupted?: () => void;
  onError?: (err: any) => void;
  onClose?: () => void;
}) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/live`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.audio && callbacks.onAudio) callbacks.onAudio(data.audio);
      if (data.text && callbacks.onText) callbacks.onText(data.text);
      if (data.interrupted && callbacks.onInterrupted) callbacks.onInterrupted();
      if (data.error && callbacks.onError) callbacks.onError(new Error(data.error));
    } catch (err) {
      console.error('Failed to parse Live WS message:', err);
    }
  };

  ws.onerror = (err) => {
    callbacks.onError?.(err);
  };

  ws.onclose = () => {
    callbacks.onClose?.();
  };

  return {
    sendAudio: (base64Pcm16k: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ audio: base64Pcm16k }));
      }
    },
    sendText: (text: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ text }));
      }
    },
    close: () => {
      ws.close();
    },
    getReadyState: () => ws.readyState,
  };
};
