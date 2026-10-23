
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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

const THEME_HEX_MAP: Record<string, string> = {
  indigo: '#6366f1',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  blue: '#3b82f6'
};

export const Insights: React.FC<{ setView: (v: string) => void }> = ({ setView }) => {
  const { habits, goals, journalEntries, themeColor, themeClasses, language, t } = useApp();
  const [timeframe, setTimeframe] = useState<'Week' | 'Month'>('Month');
  const [audit, setAudit] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showThemeHelp, setShowThemeHelp] = useState(false);
  const [lastAuditTime, setLastAuditTime] = useState<string | null>(localStorage.getItem('lumina_last_audit_time'));

  const accentHex = THEME_HEX_MAP[themeColor || 'indigo'] || '#6366f1';

  const hasHabits = habits.length > 0;
  const hasJournal = journalEntries.length > 0;
  const hasGoals = goals.length > 0;
  const hasAnyData = hasHabits || hasJournal || hasGoals;

  const fetchAudit = useCallback(async (force: boolean = false) => {
    if (!hasAnyData) return;
    if (loadingAudit) return;
    
    setLoadingAudit(true);
    try {
        console.log("Triggering Growth Audit with Force:", force);
        const res = await generateGrowthAudit(habits, goals, journalEntries, language);
        setAudit(res);
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastAuditTime(nowStr);
        localStorage.setItem('lumina_last_audit_time', nowStr);
    } catch (e) {
        console.error("Audit fetch failed in component:", e);
    } finally {
        // Minimum delay for UI satisfaction
        setTimeout(() => setLoadingAudit(false), 800);
    }
  }, [habits, goals, journalEntries, language, hasAnyData, loadingAudit]);

  // Comprehensive key that changes whenever any completion data changes
  const dataSignalKey = useMemo(() => {
    const habitKey = habits.map(h => `${h.id}-${h.completedDates.length}-${h.streak}`).join('|');
    const journalKey = journalEntries.length > 0 ? journalEntries[0].id + journalEntries[0].content.length : 'none';
    const goalKey = goals.map(g => `${g.id}-${g.progress}`).join('|');
    return `${habitKey}-${journalKey}-${goalKey}-${new Date().getHours()}`;
  }, [habits, journalEntries, goals]);

  useEffect(() => {
    fetchAudit();
  }, [dataSignalKey, language]);

  const momentumGrid = useMemo(() => {
    const daysCount = 35;
    const result: { dateStr: string; ratio: number; }[] = [];
    for(let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
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
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Neuro Calibration</h1>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unlock your identity audit</p>
                
                <div className="max-w-[320px] mx-auto p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
                    <p className="text-xs font-normal text-slate-500 dark:text-slate-400 leading-relaxed italic">
                        "Insights are born from consistency. Provide a signal to begin your evolution audit."
                    </p>

                    <div className="space-y-2.5">
                        <button onClick={() => setView('goals')} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all active:scale-[0.98] ${hasGoals ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center gap-3">
                                {hasGoals ? <div className="bg-emerald-500 rounded-full p-1 text-white"><Check size={12} strokeWidth={3} /></div> : <Target size={16} className="text-slate-400" />}
                                <span className={`text-xs font-semibold uppercase tracking-wider ${hasGoals ? 'text-emerald-600' : 'text-slate-500'}`}>1. Plant a Goal</span>
                            </div>
                        </button>
                        <button onClick={() => setView('dashboard')} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all active:scale-[0.98] ${hasHabits ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center gap-3">
                                {hasHabits ? <div className="bg-emerald-500 rounded-full p-1 text-white"><Check size={12} strokeWidth={3} /></div> : <Zap size={16} className="text-slate-400" />}
                                <span className={`text-xs font-semibold uppercase tracking-wider ${hasHabits ? 'text-emerald-600' : 'text-slate-500'}`}>2. Start a Ritual</span>
                            </div>
                        </button>
                        <button onClick={() => setView('journal')} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all active:scale-[0.98] ${hasJournal ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center gap-3">
                                {hasJournal ? <div className="bg-emerald-500 rounded-full p-1 text-white"><Check size={12} strokeWidth={3} /></div> : <BookOpen size={16} className="text-slate-400" />}
                                <span className={`text-xs font-semibold uppercase tracking-wider ${hasJournal ? 'text-emerald-600' : 'text-slate-500'}`}>3. Write Reflection</span>
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
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Neuro Insights</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {loadingAudit ? 'Recalibrating...' : (audit?.archetype || 'Analyzing Identity...')}
                      </p>
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                          <Clock size={11} className="text-slate-400" />
                          <span className="text-[10px] font-medium uppercase text-slate-400 tracking-wider">
                              {lastAuditTime || 'Syncing...'}
                          </span>
                      </div>
                  </div>
              </div>
              <div className="flex gap-2 shrink-0">
                  <button 
                      onClick={() => fetchAudit(true)}
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
                        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Identity Resonance</h2>
                        <p className="text-xs font-normal text-slate-400">Strategic vs Daily Sync</p>
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
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mental Themes</span>
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
                                <h2 className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">Growth Strategist</h2>
                                <p className="text-xs font-normal text-slate-400">Dynamic AI Insight</p>
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

          {hasHabits && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95">
                  <div className="flex justify-between items-start mb-5">
                      <div>
                          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Momentum Density</h2>
                          <p className="text-xs font-normal text-slate-400">Habit Execution Heatmap</p>
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
