
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
    ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    Scatter, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
    TrendingUp, Activity, Sparkles, Zap, Brain, Target, 
    ArrowUpRight, Loader2, Sunset, Sun, Coffee, 
    Flame, LayoutGrid, Heart, Fingerprint, Waves, Info,
    Lock, Sprout, PenLine, ChevronRight, BookOpen, PlusCircle,
    Check, RefreshCw, Clock
} from 'lucide-react';
import { generateGrowthAudit } from '../services/geminiService';
import { toLocalDateString, daysAgo } from '../services/date';
import { WeeklyReviewCard } from '../components/WeeklyReviewCard';

const THEME_HEX_MAP: Record<string, string> = {
  indigo: '#6366f1',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  blue: '#3b82f6'
};

export const Insights: React.FC<{ setView: (v: string) => void }> = ({ setView }) => {
  const { habits, goals, journalEntries, themeColor, themeClasses, language, t, securitySettings, aiConsentGranted } = useApp();
  const [timeframe, setTimeframe] = useState<'Week' | 'Month'>('Month');
  const [audit, setAudit] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showThemeHelp, setShowThemeHelp] = useState(false);

  const AUDIT_CACHE_KEY = 'lumina_audit_cache';
  const [lastAuditTime, setLastAuditTime] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const accentHex = THEME_HEX_MAP[themeColor || 'indigo'] || '#6366f1';

  const hasHabits = habits.length > 0;
  const hasJournal = journalEntries.length > 0;
  const hasGoals = goals.length > 0;
  const hasAnyData = hasHabits || hasJournal || hasGoals;

  // Changes only when data that matters to the audit changes (no clock in the key).
  const dataSignalKey = useMemo(() => {
    const habitKey = habits.map(h => `${h.id}-${h.completedDates.length}-${h.streak}`).join('|');
    const journalKey = journalEntries.length > 0 ? journalEntries[0].id + journalEntries[0].content.length : 'none';
    const goalKey = goals.map(g => `${g.id}-${g.progress}`).join('|');
    return `${language}::${habitKey}::${journalKey}::${goalKey}::${!!aiConsentGranted}`;
  }, [habits, journalEntries, goals, language, aiConsentGranted]);

  const readCache = () => {
    try { return JSON.parse(localStorage.getItem(AUDIT_CACHE_KEY) || 'null'); } catch { return null; }
  };

  const runAudit = useCallback(async () => {
    if (!hasAnyData || loadingRef.current || securitySettings?.aiDisabled) return;
    loadingRef.current = true;
    setLoadingAudit(true);
    try {
      const res = await generateGrowthAudit(habits, goals, journalEntries, language, !!aiConsentGranted);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setAudit(res);
      setLastAuditTime(nowStr);
      // Don't cache fallback/calibrating results, so they retry next time.
      if (!res.isCalibrating) {
        try {
          localStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify({ key: dataSignalKey, audit: res, time: nowStr }));
        } catch { /* storage full: ignore */ }
      }
    } catch (e) {
      console.error('Audit fetch failed in component:', e);
    } finally {
      loadingRef.current = false;
      setTimeout(() => setLoadingAudit(false), 800);
    }
  }, [habits, goals, journalEntries, language, hasAnyData, dataSignalKey, securitySettings?.aiDisabled, aiConsentGranted]);

  // Use the cached audit if the data hasn't changed; otherwise wait for edits to settle, then call the AI once.
  useEffect(() => {
    if (!hasAnyData || securitySettings?.aiDisabled) return;
    const cached = readCache();
    if (cached?.key === dataSignalKey) {
      setAudit(cached.audit);
      setLastAuditTime(cached.time);
      return;
    }
    const id = window.setTimeout(runAudit, 1500);
    return () => window.clearTimeout(id);
  }, [dataSignalKey, hasAnyData, runAudit]);

  const momentumGrid = useMemo(() => {
    const daysCount = 35;
    const result: { dateStr: string; ratio: number; }[] = [];
    for(let i = daysCount - 1; i >= 0; i--) {
        const dateStr = toLocalDateString(daysAgo(i));
        const habitsDone = habits.filter(h => h.completedDates.includes(dateStr)).length;
        const total = habits.length;
        const ratio = total > 0 ? habitsDone / total : 0;
        result.push({ dateStr, ratio });
    }
    return result;
  }, [habits]);

  const radarData = useMemo(() => {
      if (audit?.identityScores) return audit.identityScores;
      return [
        { subject: 'Health', A: 50, fullMark: 100 },
        { subject: 'Career', A: 50, fullMark: 100 },
        { subject: 'Creativity', A: 50, fullMark: 100 },
        { subject: 'Learning', A: 50, fullMark: 100 },
        { subject: 'Personal', A: 50, fullMark: 100 },
        { subject: 'Financial', A: 50, fullMark: 100 }
      ];
  }, [audit]);

  if (!hasAnyData) {
    return (
        <div className="pb-40 space-y-8 animate-in fade-in duration-1000 flex flex-col items-center justify-center min-h-[80vh] text-center px-8">
            <div className="relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${themeClasses.gradient} blur-[60px] opacity-10 animate-pulse-slow`} />
                <div className={`w-24 h-24 rounded-3xl ${themeClasses.secondary} flex items-center justify-center border ${themeClasses.border} relative z-10 shadow-xl`}>
                    <Sprout size={36} className={themeClasses.text} />
                </div>
            </div>

            <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Growth Insights</h1>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Start reflecting on your progress</p>
                
                <div className="max-w-[320px] mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
                    <p className="text-xs font-normal text-slate-500 dark:text-slate-400 leading-relaxed italic">
                        "Insights are built from your daily habits, goals, and reflections. Start with any of these to see patterns here."
                    </p>

                    <div className="space-y-2.5">
                        <button onClick={() => setView('goals')} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all active:scale-[0.98] ${hasGoals ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center gap-3">
                                {hasGoals ? <div className="bg-emerald-500 rounded-full p-1 text-white"><Check size={12} strokeWidth={3} /></div> : <Target size={16} className="text-slate-400" />}
                                <span className={`text-xs font-semibold uppercase tracking-wider ${hasGoals ? 'text-emerald-600' : 'text-slate-500'}`}>1. Add a Goal</span>
                            </div>
                        </button>
                        <button onClick={() => setView('dashboard')} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all active:scale-[0.98] ${hasHabits ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center gap-3">
                                {hasHabits ? <div className="bg-emerald-500 rounded-full p-1 text-white"><Check size={12} strokeWidth={3} /></div> : <Zap size={16} className="text-slate-400" />}
                                <span className={`text-xs font-semibold uppercase tracking-wider ${hasHabits ? 'text-emerald-600' : 'text-slate-500'}`}>2. Create a Habit</span>
                            </div>
                        </button>
                        <button onClick={() => setView('journal')} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all active:scale-[0.98] ${hasJournal ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center gap-3">
                                {hasJournal ? <div className="bg-emerald-500 rounded-full p-1 text-white"><Check size={12} strokeWidth={3} /></div> : <BookOpen size={16} className="text-slate-400" />}
                                <span className={`text-xs font-semibold uppercase tracking-wider ${hasJournal ? 'text-emerald-600' : 'text-slate-500'}`}>3. Write a Reflection</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  return (
      <div className="pb-40 space-y-6 animate-in fade-in duration-1000">
          <header className="px-1 pt-2 flex justify-between items-end">
              <div className="flex-1 pr-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Insights & Patterns</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {loadingAudit ? 'Reflecting...' : (audit?.archetype || 'Reviewing habits...')}
                      </p>
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                          <Clock size={11} className="text-slate-400" />
                          <span className="text-[10px] font-medium uppercase text-slate-400 tracking-wider">
                              {lastAuditTime || 'Updated'}
                          </span>
                      </div>
                  </div>
              </div>
              <div className="flex gap-2 shrink-0">
                  <button 
                      onClick={() => runAudit()}
                      disabled={loadingAudit}
                      className={`p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all active:scale-90 ${loadingAudit ? 'opacity-50' : ''}`}
                  >
                      <RefreshCw size={15} className={`${loadingAudit ? 'animate-spin' : ''} text-slate-400`} />
                  </button>
                  <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800 flex shadow-sm">
                      {(['Week', 'Month'] as const).map(t => (
                          <button 
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all ${timeframe === t ? `${themeClasses.primary} text-white shadow-sm` : 'text-slate-400 hover:text-slate-600'}`}
                          >
                              {t}
                          </button>
                      ))}
                  </div>
              </div>
          </header>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Life Balance</h2>
                        <p className="text-xs font-normal text-slate-400">Balance across life domains</p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${themeClasses.secondary} ${themeClasses.text}`}>
                        <Fingerprint size={18} />
                    </div>
                </div>

                <div className={`h-64 -mx-4 transition-all duration-700 ${loadingAudit ? 'opacity-30 blur-sm scale-95' : 'opacity-100'}`}>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" strokeOpacity={0.5} />
                            <PolarAngleAxis dataKey="subject" tick={{fontSize: 11, fontWeight: 500, fill: '#94a3b8'}} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} hide />
                            <Radar
                                name="Resonance"
                                dataKey="A"
                                stroke={accentHex}
                                fill={accentHex}
                                fillOpacity={0.4}
                                animationBegin={0}
                                animationDuration={1000}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2 relative">
                    <div className="w-full flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recurring Themes</span>
                        <button onClick={() => setShowThemeHelp(!showThemeHelp)} className="p-1 text-slate-400 hover:text-slate-600">
                            <Info size={13} />
                        </button>
                    </div>
                    {audit?.mentalThemes?.map((theme: string) => (
                        <div key={theme} className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-1.5 transition-transform hover:scale-105">
                            <Waves size={11} className={themeClasses.text} />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{theme}</span>
                        </div>
                    ))}
                </div>
          </div>

          <div className="relative p-6 rounded-3xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 group">
                <div className="relative z-10 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${themeClasses.secondary} flex items-center justify-center`}>
                                <Brain size={18} className={themeClasses.text} />
                            </div>
                            <div>
                                <h2 className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">Personal Reflection</h2>
                                <p className="text-xs font-normal text-slate-400">Thoughtful summary of your logs</p>
                            </div>
                        </div>
                    </div>

                    <div className={`space-y-4 transition-all duration-500 ${loadingAudit ? 'opacity-30' : 'opacity-100'}`}>
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex gap-3.5">
                            <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                                <Heart size={16} className="text-rose-400" />
                            </div>
                            <div>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Core Insight</span>
                                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 font-normal leading-relaxed mt-1">{audit?.summary}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Zap size={14} className="text-amber-400" />
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Advice</span>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-normal leading-relaxed italic">"{audit?.advice}"</p>
                            </div>
                            <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <TrendingUp size={14} className={themeClasses.text} />
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trajectory</span>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-normal leading-relaxed">{audit?.trajectory}</p>
                            </div>
                        </div>
                    </div>
                </div>
          </div>

          {timeframe === 'Week' && (
            <div className="animate-in fade-in duration-300">
              <WeeklyReviewCard defaultExpanded={true} />
            </div>
          )}

          {hasHabits && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95">
                  <div className="flex justify-between items-start mb-5">
                      <div>
                          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Habit Consistency</h2>
                          <p className="text-xs font-normal text-slate-400">Last 35 days activity</p>
                      </div>
                      <div className={`p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500`}>
                          <LayoutGrid size={18} />
                      </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                      {momentumGrid.map((day, idx) => (
                          <div 
                              key={idx}
                              className={`aspect-square rounded-lg border border-slate-100 dark:border-slate-800/50 transition-all duration-700 ${
                                  day.ratio > 0.8 ? `${themeClasses.primary} shadow-sm` :
                                  day.ratio > 0.5 ? `${themeClasses.primary} opacity-60` :
                                  day.ratio > 0.2 ? `${themeClasses.primary} opacity-20` :
                                  'bg-slate-50 dark:bg-slate-800/20'
                              }`}
                          />
                      ))}
                  </div>
            </div>
          )}
      </div>
  );
};
