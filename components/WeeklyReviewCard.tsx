import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Sparkles, Check, CheckCircle2, Calendar, Flame, Trophy, 
  ChevronDown, ChevronUp, RefreshCw, BookOpen, Plus, 
  PenLine, ArrowRight, Sun, Coffee, CheckCheck, Loader2, Gift
} from 'lucide-react';
import { toLocalDateString, getPast7Days, getWeekRangeString, isSunday, parseLocalDate } from '../services/date';
import { generateWeeklyReview } from '../services/geminiService';
import { WeeklyReview } from '../types';

interface WeeklyReviewCardProps {
  onClose?: () => void;
  defaultExpanded?: boolean;
}

export const WeeklyReviewCard: React.FC<WeeklyReviewCardProps> = ({ 
  defaultExpanded = true 
}) => {
  const { 
    habits, 
    goals, 
    journalEntries, 
    name, 
    language, 
    themeClasses, 
    securitySettings,
    lastWeeklyReview,
    saveWeeklyReview,
    triggerNotification
  } = useApp();

  const isTodaySunday = useMemo(() => isSunday(new Date()), []);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded || isTodaySunday);
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
  const [newWinInput, setNewWinInput] = useState<string>('');
  const [userWins, setUserWins] = useState<string[]>([]);
  const [upcomingFocusInput, setUpcomingFocusInput] = useState<string>('');
  const [suggestedAdjustment, setSuggestedAdjustment] = useState<string>('');
  const [reflectionNotes, setReflectionNotes] = useState<string>('');
  const [isSavedToJournal, setIsSavedToJournal] = useState<boolean>(false);
  const [hasCompletedReview, setHasCompletedReview] = useState<boolean>(false);

  // 1. Calculate 7-day stats
  const past7Days = useMemo(() => getPast7Days(new Date()), []);
  const weekRange = useMemo(() => getWeekRangeString(new Date()), []);
  const past7DatesSet = useMemo(() => new Set(past7Days.map(d => d.dateStr)), [past7Days]);

  const weeklyHabitStats = useMemo(() => {
    let totalScheduled = 0;
    let totalCompleted = 0;

    const habitBreakdown = habits.map(h => {
      let scheduledThisWeek = 0;
      let completedThisWeek = 0;

      past7Days.forEach(day => {
        const dayOfWeek = day.date.getDay();
        const isScheduled = h.scheduleType === 'monthly'
          ? (h.monthlyDays || []).includes(day.dayNum)
          : (h.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek);

        if (isScheduled) {
          scheduledThisWeek++;
          if (h.completedDates.includes(day.dateStr)) {
            completedThisWeek++;
          }
        }
      });

      totalScheduled += scheduledThisWeek;
      totalCompleted += completedThisWeek;

      return {
        id: h.id,
        title: h.title,
        streak: h.streak,
        category: h.category,
        completedThisWeek,
        scheduledThisWeek,
        rate: scheduledThisWeek > 0 ? completedThisWeek / scheduledThisWeek : 0
      };
    });

    // Top habits (completed at least once, sorted by completion count and streak)
    const topHabits = habitBreakdown
      .filter(h => h.completedThisWeek > 0)
      .sort((a, b) => b.completedThisWeek - a.completedThisWeek || b.streak - a.streak)
      .slice(0, 3);

    const completionRate = totalScheduled > 0 
      ? Math.round((totalCompleted / totalScheduled) * 100) 
      : (habits.length > 0 && totalCompleted > 0 ? 100 : 0);

    return {
      totalScheduled,
      totalCompleted,
      completionRate,
      topHabits,
      habitBreakdown
    };
  }, [habits, past7Days]);

  // 1.5 Calculate weekly banked rewards earned
  const weeklyBankedRewards = useMemo(() => {
    const list: { habitTitle: string; rewardTitle: string; amountEarned: number; unit: string; count: number }[] = [];
    habits.forEach(h => {
      if (h.reward && h.reward.amount > 0) {
        let count = 0;
        past7Days.forEach(d => {
          if (h.completedDates.includes(d.dateStr)) count++;
        });
        if (count > 0) {
          list.push({
            habitTitle: h.title,
            rewardTitle: h.reward.title,
            amountEarned: count * h.reward.amount,
            unit: h.reward.unit,
            count
          });
        }
      }
    });
    return list;
  }, [habits, past7Days]);

  // 2. Extract journal wins from the past 7 days
  const journalWins = useMemo(() => {
    const recent = journalEntries.filter(entry => past7DatesSet.has(entry.date));
    const extracted: string[] = [];

    recent.forEach(entry => {
      const isWinCategory = entry.category === 'Growth' || entry.activities?.includes('win') || entry.title?.toLowerCase().includes('win');
      const isPositiveMood = entry.mood === 'Great' || entry.mood === 'Good';
      
      if (entry.title && (isWinCategory || entry.title.toLowerCase().includes('win'))) {
        extracted.push(entry.title);
      } else if (entry.content && (isWinCategory || isPositiveMood)) {
        // Grab first sentence or compact snippet
        const firstLine = entry.content.split('\n')[0].replace(/^[•\-\*]\s*/, '').trim();
        if (firstLine.length > 0 && firstLine.length <= 120) {
          extracted.push(firstLine);
        }
      }
    });

    return Array.from(new Set(extracted)).slice(0, 4);
  }, [journalEntries, past7DatesSet]);

  // Combine extracted journal wins and user-added wins
  const allWins = useMemo(() => {
    return Array.from(new Set([...journalWins, ...userWins]));
  }, [journalWins, userWins]);

  // 3. Initialize / prefill review content from cache or state
  useEffect(() => {
    if (lastWeeklyReview && lastWeeklyReview.weekEndDate === weekRange.endStr) {
      setHasCompletedReview(true);
      if (lastWeeklyReview.upcomingFocus) {
        setUpcomingFocusInput(lastWeeklyReview.upcomingFocus);
      }
      if (lastWeeklyReview.suggestedAdjustment) {
        setSuggestedAdjustment(lastWeeklyReview.suggestedAdjustment);
      }
      if (lastWeeklyReview.reflection) {
        setReflectionNotes(lastWeeklyReview.reflection);
      }
      if (lastWeeklyReview.wins?.length > 0) {
        setUserWins(lastWeeklyReview.wins.filter(w => !journalWins.includes(w)));
      }
      return;
    }

    // Default heuristics if no review saved yet
    if (!upcomingFocusInput) {
      if (goals.length > 0) {
        const activeGoal = goals.find(g => !g.completed && !g.isPaused);
        if (activeGoal) {
          setUpcomingFocusInput(`Make steady progress on ${activeGoal.title}`);
        } else {
          setUpcomingFocusInput('Protect 15 minutes of quiet time each morning');
        }
      } else {
        setUpcomingFocusInput('Focus on daily consistency over intensity');
      }
    }

    if (!suggestedAdjustment) {
      if (weeklyHabitStats.completionRate >= 80) {
        setSuggestedAdjustment('Your routine is calm and steady. Protect your restful evening hours.');
      } else if (weeklyHabitStats.completionRate >= 50) {
        setSuggestedAdjustment('Anchor your hardest habit right after an easy morning activity.');
      } else {
        setSuggestedAdjustment('Focus on keeping just one core habit for two minutes each day.');
      }
    }
  }, [lastWeeklyReview, weekRange.endStr, goals, weeklyHabitStats.completionRate, journalWins]);

  // 4. Trigger AI synthesis if user desires
  const handleFetchAiReview = async () => {
    if (isLoadingAI || securitySettings?.aiDisabled) return;
    setIsLoadingAI(true);
    try {
      const res = await generateWeeklyReview(
        name,
        habits,
        goals,
        journalEntries.filter(e => past7DatesSet.has(e.date)),
        {
          completionRate: weeklyHabitStats.completionRate,
          completedCount: weeklyHabitStats.totalCompleted,
          scheduledCount: weeklyHabitStats.totalScheduled
        },
        language
      );

      if (res.suggestedAdjustment) {
        setSuggestedAdjustment(res.suggestedAdjustment);
      }
      if (res.upcomingFocus) {
        setUpcomingFocusInput(res.upcomingFocus);
      }
      triggerNotification('Weekly Insights Ready ✨', 'Your reflection has been refreshed with thoughtful takeaways.', 'achievement');
    } catch (e) {
      console.error('Failed to generate weekly review:', e);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleAddWin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWinInput.trim();
    if (!trimmed) return;
    if (!userWins.includes(trimmed)) {
      setUserWins(prev => [...prev, trimmed]);
    }
    setNewWinInput('');
  };

  const handleRemoveWin = (winToRemove: string) => {
    setUserWins(prev => prev.filter(w => w !== winToRemove));
  };

  const handleSaveReview = (postToJournal: boolean) => {
    const reviewData: WeeklyReview = {
      id: 'review-' + Date.now().toString(),
      weekStartDate: weekRange.startStr,
      weekEndDate: weekRange.endStr,
      completionRate: weeklyHabitStats.completionRate,
      habitsDone: weeklyHabitStats.totalCompleted,
      habitsTotal: weeklyHabitStats.totalScheduled,
      topHabits: weeklyHabitStats.topHabits.map(h => h.title),
      wins: allWins,
      suggestedAdjustment: suggestedAdjustment || 'Keep habits gentle and consistent.',
      upcomingFocus: upcomingFocusInput || 'Continue mindful daily progress.',
      reflection: reflectionNotes.trim() || undefined,
      savedAt: new Date().toISOString()
    };

    saveWeeklyReview(reviewData, postToJournal);
    setHasCompletedReview(true);
    if (postToJournal) {
      setIsSavedToJournal(true);
    }
    triggerNotification(
      'Weekly Review Completed ✨', 
      postToJournal ? 'Your weekly reflection is saved to your journal.' : 'Your weekly reflection is saved.', 
      'achievement'
    );
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all overflow-hidden">
      {/* CARD HEADER */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-6 sm:p-7 flex items-center justify-between cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl ${themeClasses.secondary} flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner group-hover:scale-105 transition-transform`}>
            {hasCompletedReview ? (
              <CheckCircle2 size={20} className="text-emerald-500" />
            ) : (
              <Sun size={20} className={themeClasses.text} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {isTodaySunday ? 'Sunday Weekly Review' : 'Weekly Review'}
              </span>
              {hasCompletedReview && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  • Reviewed ✨
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Week of {weekRange.label}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-right">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {weeklyHabitStats.completionRate}%
            </span>
            <span className="text-[11px] text-slate-400">consistency</span>
          </div>
          <button 
            type="button"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
            aria-label={isExpanded ? 'Collapse review' : 'Expand review'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* EXPANDED REVIEW CONTENT */}
      {isExpanded && (
        <div className="px-6 pb-7 sm:px-7 space-y-6 pt-1 border-t border-slate-100 dark:border-slate-800/60 animate-in slide-in-from-top-2 duration-300">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Take a peaceful pause. Notice where your energy flowed this week, honor small victories, and choose one calm intention for the days ahead.
          </p>

          {/* 1. HABIT RHYTHM OVERVIEW */}
          <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Habit Consistency</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {weeklyHabitStats.completionRate}%
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({weeklyHabitStats.totalCompleted} of {weeklyHabitStats.totalScheduled} completed)
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-slate-400">
                <Flame size={16} className={weeklyHabitStats.completionRate >= 70 ? 'text-amber-500' : 'text-slate-400'} />
              </div>
            </div>

            {/* 7-Day Calm Indicator Strip */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1">
              {past7Days.map(day => {
                const dayName = day.dayName;
                const habitsOnThisDay = habits.filter(h => {
                  const dow = day.date.getDay();
                  return h.scheduleType === 'monthly'
                    ? (h.monthlyDays || []).includes(day.dayNum)
                    : (h.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dow);
                });
                const completedOnThisDay = habitsOnThisDay.filter(h => h.completedDates.includes(day.dateStr)).length;
                const isFullyDone = habitsOnThisDay.length > 0 && completedOnThisDay === habitsOnThisDay.length;
                const hasPartial = completedOnThisDay > 0 && !isFullyDone;

                return (
                  <div key={day.dateStr} className="flex flex-col items-center gap-1.5 py-1 text-center">
                    <span className="text-[10px] font-medium text-slate-400">{dayName}</span>
                    <div 
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        isFullyDone 
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : hasPartial
                          ? `${themeClasses.secondary} ${themeClasses.text} border border-indigo-200 dark:border-indigo-800`
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      title={`${completedOnThisDay}/${habitsOnThisDay.length} habits done`}
                    >
                      {isFullyDone ? (
                        <Check size={13} strokeWidth={3} />
                      ) : (
                        <span>{day.dayNum}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top Consistent Habits */}
            {weeklyHabitStats.topHabits.length > 0 && (
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Top Consistent Habits</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {weeklyHabitStats.topHabits.map(h => (
                    <div key={h.id} className="text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center gap-1.5 shadow-sm">
                      <Check size={12} className="text-emerald-500" strokeWidth={2.5} />
                      <span className="font-medium">{h.title}</span>
                      <span className="text-[11px] text-slate-400">({h.completedThisWeek}x)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Banked Rewards Earned This Week (Premack Principle) */}
            {weeklyBankedRewards.length > 0 && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Gift size={11} className="text-emerald-500" />
                  Guilt-Free Rewards Earned This Week
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {weeklyBankedRewards.map((r, i) => (
                    <div key={i} className="text-xs bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1.5 shadow-2xs font-medium">
                      <span>🎁</span>
                      <span>+{r.amountEarned} {r.unit} of {r.rewardTitle}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                        ({r.count}x via "{r.habitTitle}")
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. WINS OF THE WEEK */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Trophy size={12} className="text-amber-500" /> Wins & Moments from This Week
              </span>
              <span className="text-[10px] text-slate-400">
                {allWins.length} noted
              </span>
            </div>

            {allWins.length > 0 ? (
              <div className="space-y-2">
                {allWins.map((win, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span>{win}</span>
                    </div>
                    {userWins.includes(win) && (
                      <button 
                        onClick={() => handleRemoveWin(win)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                        title="Remove custom win"
                      >
                        <XIcon size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                No wins logged in your journal yet this week. Take a moment to add one below.
              </p>
            )}

            {/* Inline Add Win Form */}
            <form onSubmit={handleAddWin} className="flex items-center gap-2 pt-1">
              <input 
                type="text"
                value={newWinInput}
                onChange={e => setNewWinInput(e.target.value)}
                placeholder="Add a win or small victory from this week..."
                className="flex-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200 focus:border-indigo-500 transition-colors"
              />
              <button 
                type="submit"
                disabled={!newWinInput.trim()}
                className="px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium rounded-xl hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1 shrink-0"
              >
                <Plus size={13} /> Add
              </button>
            </form>
          </div>

          {/* 3. MINDFUL ADJUSTMENT & FOCUS FOR UPCOMING WEEK */}
          <div className="space-y-4 pt-2">
            {/* Suggested Adjustment */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles size={12} /> Mindful Adjustment
                </span>
                {!securitySettings?.aiDisabled && (
                  <button 
                    onClick={handleFetchAiReview}
                    disabled={isLoadingAI}
                    className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw size={10} className={isLoadingAI ? 'animate-spin' : ''} />
                    {isLoadingAI ? 'Refreshing...' : 'Refresh with AI'}
                  </button>
                )}
              </div>
              <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                {suggestedAdjustment}
              </p>
            </div>

            {/* Upcoming Week Focus */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                My Calm Focus for the Upcoming Week
              </label>
              <input 
                type="text"
                value={upcomingFocusInput}
                onChange={e => setUpcomingFocusInput(e.target.value)}
                placeholder="e.g. Protect 15 minutes of quiet morning reading"
                className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 text-xs border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-slate-100 focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Optional Personal Note */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Personal Reflection Notes (Optional)
              </label>
              <textarea 
                value={reflectionNotes}
                onChange={e => setReflectionNotes(e.target.value)}
                rows={2}
                placeholder="Any feelings or thoughts about this week..."
                className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs border border-slate-200 dark:border-slate-700 outline-none text-slate-900 dark:text-slate-100 focus:border-indigo-500 transition-colors resize-none"
              />
            </div>
          </div>

          {/* 4. ACTIONS & SAVE */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button 
              type="button"
              onClick={() => handleSaveReview(false)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Check size={14} strokeWidth={2.5} />
              {hasCompletedReview ? 'Update Weekly Review' : 'Complete Review'}
            </button>

            <button 
              type="button"
              onClick={() => handleSaveReview(true)}
              disabled={isSavedToJournal}
              className={`py-2.5 px-4 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all ${
                isSavedToJournal 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {isSavedToJournal ? (
                <>
                  <CheckCheck size={14} /> Saved to Journal
                </>
              ) : (
                <>
                  <BookOpen size={14} /> Save to Journal
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple helper icon for removal
const XIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
