
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Check, Sun, Moon, Clock, Sparkles, Trophy, 
    ChevronDown, ChevronUp, Zap, Star, Plus, X, ArrowRight, ArrowLeft, Loader2, Coffee, Sunset, Target, Play, Pencil, Trash2, RefreshCw, Flame, Cloud, CloudOff, History, Calendar, Tag, HelpCircle, Heart, Briefcase, Smile, BookOpen, Users, CheckCircle2, Gift, Gamepad2
} from 'lucide-react';
import { generateDailyBriefing, suggestAtomicHabit } from '../services/geminiService';
import { Habit, GoalCategory, HabitReward } from '../types';
import { toLocalDateString, parseLocalDate, isSunday, getWeekRangeString } from '../services/date';
import { calculateHabitStreak } from '../services/habitService';
import { WeeklyReviewCard } from '../components/WeeklyReviewCard';
import { BankedRewardsCard } from '../components/BankedRewardsCard';

interface DashboardProps {
    setView: (view: string) => void;
}

interface MomentumDay {
    full: string;
    dayNum: number;
    dayName: string;
    isToday: boolean;
    dayOfWeek: number;
}

const getTodayString = () => toLocalDateString();
const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CATEGORY_META: Record<GoalCategory, { label: string; icon: any; desc: string }> = {
    [GoalCategory.Health]: { label: 'Health', icon: Heart, desc: 'Body, energy & vitality' },
    [GoalCategory.Career]: { label: 'Career', icon: Briefcase, desc: 'Work, craft & impact' },
    [GoalCategory.Personal]: { label: 'Personal', icon: Smile, desc: 'Mindset & daily peace' },
    [GoalCategory.Financial]: { label: 'Financial', icon: Trophy, desc: 'Wealth & discipline' },
    [GoalCategory.Learning]: { label: 'Learning', icon: BookOpen, desc: 'Knowledge & skills' },
    [GoalCategory.Relationships]: { label: 'Relationships', icon: Users, desc: 'Connection & empathy' },
    [GoalCategory.Creativity]: { label: 'Creativity', icon: Sparkles, desc: 'Art, voice & expression' }
};

const TIME_OPTIONS: { id: 'Morning' | 'Afternoon' | 'Evening' | 'Anytime'; label: string; window: string; icon: any }[] = [
    { id: 'Morning', label: 'Morning', window: '06:00 – 12:00', icon: Coffee },
    { id: 'Afternoon', label: 'Afternoon', window: '12:00 – 18:00', icon: Sun },
    { id: 'Evening', label: 'Evening', window: '18:00 – 23:00', icon: Sunset },
    { id: 'Anytime', label: 'Anytime', window: 'Flexible window', icon: Clock }
];

const COMMON_ANCHORS = [
    'Pour morning coffee',
    'Finish lunch',
    'Close work laptop',
    'Brush teeth',
    'Arrive home'
];

const QUICK_DURATIONS = ['2m', '5m', '10m', '15m', '30m'];

export const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
    const { 
        name, avatar, goals, habits, journalEntries, toggleHabitCompletion, addHabit, updateHabit, deleteHabit,
        themeClasses, language, t, dailyBriefing, lastBriefingUpdate, 
        updateUserPreferences, circadian, syncStatus, user, dashboardLayout, triggerNotification, securitySettings, lastWeeklyReview
    } = useApp();
    
    const [currentTodayStr, setCurrentTodayStr] = useState(getTodayString());
    const [selectedDate, setSelectedDate] = useState(currentTodayStr);
    
    const [isMomentumOpen, setIsMomentumOpen] = useState(false);
    const [isBriefingExpanded, setIsBriefingExpanded] = useState(false);
    const [showHabitModal, setShowHabitModal] = useState(false);
    const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Habit Form State
    const [habitTitle, setHabitTitle] = useState('');
    const [habitCategory, setHabitCategory] = useState<GoalCategory>(GoalCategory.Personal);
    const [habitTrigger, setHabitTrigger] = useState('');
    const [habitDuration, setHabitDuration] = useState('5m');
    const [habitTime, setHabitTime] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Anytime'>('Morning');
    const [linkedGoalId, setLinkedGoalId] = useState('');
    const [isAtomizing, setIsAtomizing] = useState(false);
    const [habitDays, setHabitDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
    const [scheduleType, setScheduleType] = useState<'weekly' | 'monthly'>('weekly');
    const [monthlyDays, setMonthlyDays] = useState<number[]>([]);
    const [habitWizardStep, setHabitWizardStep] = useState<number>(1);
    const [showTriggerTooltip, setShowTriggerTooltip] = useState<boolean>(false);
    const [quickHabitTitle, setQuickHabitTitle] = useState<string>('');
    const [showScheduledHabits, setShowScheduledHabits] = useState<boolean>(false);
    const [submittingHabit, setSubmittingHabit] = useState<boolean>(false);

    // Temptation Bundling (Premack Principle) Reward State
    const [hasReward, setHasReward] = useState<boolean>(false);
    const [rewardTitle, setRewardTitle] = useState<string>('Gaming');
    const [rewardAmount, setRewardAmount] = useState<number>(30);
    const [rewardUnit, setRewardUnit] = useState<string>('min');
    const [targetAmount, setTargetAmount] = useState<string>('');
    const [targetUnit, setTargetUnit] = useState<string>('pages');

    useEffect(() => {
        const interval = setInterval(() => {
            const freshToday = getTodayString();
            if (freshToday !== currentTodayStr) {
                setCurrentTodayStr(freshToday);
                if (selectedDate === currentTodayStr) {
                    setSelectedDate(freshToday);
                }
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [currentTodayStr, selectedDate]);

    const momentumDays = useMemo(() => {
        const days: MomentumDay[] = [];
        const baseDate = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() - i);
            const iso = toLocalDateString(d);
            days.push({
                full: iso,
                dayNum: d.getDate(),
                dayName: d.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0),
                isToday: iso === currentTodayStr,
                dayOfWeek: d.getDay()
            });
        }
        return days;
    }, [currentTodayStr]);

    const currentHour = new Date().getHours();
    const initialTab = useMemo(() => {
        if (currentHour >= 5 && currentHour < 12) return 'Morning';
        if (currentHour >= 12 && currentHour < 17) return 'Afternoon';
        if (currentHour >= 17 && currentHour < 22) return 'Evening';
        return 'Anytime';
    }, [currentHour]);
    
    const [activeHabitTab, setActiveHabitTab] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Anytime'>(initialTab);

    const getHabitsForSelectedDate = useCallback(() => {
        const d = parseLocalDate(selectedDate);
        const dayOfWeek = d.getDay();
        const dayOfMonth = d.getDate();
        
        const isLastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() === dayOfMonth;
        
        return habits.filter(h => {
            const createdDateStr = (h.createdAt || '').split('T')[0] || '1970-01-01';
            const isHistoricalValid = createdDateStr <= selectedDate;
            
            if (h.scheduleType === 'monthly') {
                const scheduled = h.monthlyDays || [];
                if (scheduled.includes(dayOfMonth)) return isHistoricalValid;
                if (isLastDay) {
                    const maxScheduled = Math.max(...scheduled, 0);
                    if (maxScheduled > dayOfMonth && scheduled.some(sd => sd >= dayOfMonth)) return isHistoricalValid;
                }
                return false;
            }
            
            const isScheduledForDay = (h.daysOfWeek || []).includes(dayOfWeek);
            return isHistoricalValid && isScheduledForDay;
        });
    }, [habits, selectedDate]);

    const habitsForDay = useMemo(() => getHabitsForSelectedDate(), [getHabitsForSelectedDate]);

    const nextAction = useMemo(() => {
        const pendingHabits = habitsForDay.filter(h => !h.completedDates.includes(selectedDate));
        if (pendingHabits.length === 0) return null;
        const currentPhaseHabits = pendingHabits.filter(h => h.timeOfDay === initialTab);
        if (currentPhaseHabits.length > 0) return currentPhaseHabits[0];
        const anytimeHabits = pendingHabits.filter(h => h.timeOfDay === 'Anytime');
        if (anytimeHabits.length > 0) return anytimeHabits[0];
        return pendingHabits[0];
    }, [habitsForDay, selectedDate, initialTab]);

    const phaseIcon = useMemo(() => {
        switch(circadian.state) {
            case 'Morning': return <Sun className="animate-pulse" size={24} />;
            case 'Day': return <Clock size={24} />;
            case 'Evening': return <Sunset size={24} />;
            default: return <Moon size={24} />;
        }
    }, [circadian.state]);

    const fetchBriefing = async () => {
        if (securitySettings?.aiDisabled || dashboardLayout?.showDailyWisdom === false) return;
        setIsRefreshing(true);
        try {
            const briefing = await generateDailyBriefing(name, goals, habits, journalEntries, language);
            updateUserPreferences({ dailyBriefing: briefing, lastBriefingUpdate: Date.now() });
        } catch (error) {
            console.error("Dashboard briefing update failed", error);
        } finally {
            setTimeout(() => setIsRefreshing(false), 1000);
        }
    };

    useEffect(() => {
        const checkBriefingStaleness = () => {
            if (dashboardLayout?.showDailyWisdom === false || securitySettings?.aiDisabled) return;
            const lastUpdate = lastBriefingUpdate ? new Date(lastBriefingUpdate) : null;
            const lastUpdateDateStr = lastUpdate ? toLocalDateString(lastUpdate) : null;
            if (lastUpdateDateStr !== currentTodayStr) {
                fetchBriefing();
            }
        };
        checkBriefingStaleness();
    }, [currentTodayStr, language, dashboardLayout?.showDailyWisdom, securitySettings?.aiDisabled]);

    const handleAtomize = async () => {
        if (!habitTitle.trim() || securitySettings?.aiDisabled) return;
        setIsAtomizing(true);
        const { suggestion } = await suggestAtomicHabit(habitTitle, language);
        setHabitTitle(suggestion);
        setIsAtomizing(false);
    };

    const resetHabitForm = () => {
        setHabitTitle('');
        setHabitCategory(GoalCategory.Personal);
        setHabitTrigger('');
        setHabitDuration('5m');
        setHabitTime(initialTab);
        setLinkedGoalId('');
        setEditingHabitId(null);
        setHabitDays([0, 1, 2, 3, 4, 5, 6]);
        setScheduleType('weekly');
        setMonthlyDays([]);
        setHabitWizardStep(1);
        setShowTriggerTooltip(false);
        setHasReward(false);
        setRewardTitle('Gaming');
        setRewardAmount(30);
        setRewardUnit('min');
        setTargetAmount('');
        setTargetUnit('pages');
        setSubmittingHabit(false);
        setShowHabitModal(false);
    };

    const handleEditHabit = (h: Habit) => {
        setEditingHabitId(h.id);
        setHabitTitle(h.title);
        setHabitCategory(h.category || GoalCategory.Personal);
        setHabitTrigger(h.trigger || '');
        setHabitDuration(h.duration || '5m');
        setHabitTime(h.timeOfDay);
        setLinkedGoalId(h.linkedGoalId || '');
        setHabitDays(h.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
        setScheduleType(h.scheduleType || 'weekly');
        setMonthlyDays(h.monthlyDays || []);
        setHabitWizardStep(1);
        setShowTriggerTooltip(false);
        if (h.reward) {
            setHasReward(true);
            setRewardTitle(h.reward.title || 'Gaming');
            setRewardAmount(h.reward.amount || 30);
            setRewardUnit(h.reward.unit || 'min');
        } else {
            setHasReward(false);
            setRewardTitle('Gaming');
            setRewardAmount(30);
            setRewardUnit('min');
        }
        setTargetAmount(h.targetAmount ? String(h.targetAmount) : '');
        setTargetUnit(h.targetUnit || 'pages');
        setShowHabitModal(true);
    };

    const handleSaveHabit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (submittingHabit || !habitTitle.trim()) return;
        setSubmittingHabit(true);
        
        try {
            const effectiveDays = scheduleType === 'weekly' 
                ? (habitDays.length > 0 ? habitDays : [0, 1, 2, 3, 4, 5, 6])
                : [];

            const existingHabit = editingHabitId ? habits.find(h => h.id === editingHabitId) : null;
            const parsedTargetAmount = targetAmount ? parseFloat(targetAmount) : undefined;

            let rewardPayload: HabitReward | undefined = undefined;
            if (hasReward && rewardTitle.trim() && rewardAmount > 0) {
                rewardPayload = {
                    title: rewardTitle.trim(),
                    amount: rewardAmount,
                    unit: rewardUnit.trim() || 'min',
                    bankedBalance: existingHabit?.reward?.bankedBalance || 0,
                    totalEarned: existingHabit?.reward?.totalEarned || 0,
                    totalRedeemed: existingHabit?.reward?.totalRedeemed || 0
                };
            }

            const payload = {
                title: habitTitle.trim(),
                category: habitCategory,
                trigger: habitTrigger.trim(),
                duration: habitDuration || '5m',
                timeOfDay: habitTime,
                daysOfWeek: effectiveDays,
                monthlyDays: scheduleType === 'monthly' ? monthlyDays : [],
                scheduleType,
                linkedGoalId: linkedGoalId || undefined,
                targetAmount: parsedTargetAmount,
                targetUnit: parsedTargetAmount ? targetUnit : undefined,
                reward: rewardPayload
            };

            if (editingHabitId) {
                updateHabit(editingHabitId, payload);
                triggerNotification('Habit Updated', `"${payload.title}" has been saved.`, 'achievement');
            } else {
                addHabit({
                    id: Date.now().toString(),
                    ...payload,
                    streak: 0,
                    completedDates: [],
                    createdAt: new Date().toISOString()
                });
                triggerNotification('Habit Saved ✨', `"${payload.title}" has been added to your habits.`, 'achievement');
            }

            // Align active dashboard tab so the user sees their new ritual immediately
            if (payload.timeOfDay !== 'Anytime') {
                setActiveHabitTab(payload.timeOfDay);
            }

            resetHabitForm();
        } finally {
            setSubmittingHabit(false);
        }
    };

    const handleDeleteHabit = () => {
        if (editingHabitId) {
            deleteHabit(editingHabitId);
            resetHabitForm();
        }
    };

    const handleQuickAddHabit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = quickHabitTitle.trim();
        if (!trimmed || submittingHabit) return;
        setSubmittingHabit(true);

        try {
            addHabit({
                id: Date.now().toString(),
                title: trimmed,
                category: GoalCategory.Personal,
                duration: '5m',
                timeOfDay: activeHabitTab,
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                streak: 0,
                completedDates: [],
                createdAt: new Date().toISOString()
            });

            triggerNotification('Habit Saved ✨', `"${trimmed}" added for ${activeHabitTab}.`, 'achievement');
            setQuickHabitTitle('');
        } finally {
            setSubmittingHabit(false);
        }
    };

    const filteredHabits = habitsForDay.filter(h => h.timeOfDay === activeHabitTab);
    const progress = habitsForDay.length > 0 ? Math.round((habitsForDay.filter(h => h.completedDates.includes(selectedDate)).length / habitsForDay.length) * 100) : 0;

    const getTabStats = (time: string) => {
        const set = habitsForDay.filter(h => h.timeOfDay === time);
        const done = set.filter(h => h.completedDates.includes(selectedDate)).length;
        return { count: set.length, done };
    };

    const toggleDay = (dayNum: number) => {
        setHabitDays(prev => prev.includes(dayNum) ? prev.filter(d => d !== dayNum) : [...prev, dayNum].sort());
    };

    const toggleMonthlyDay = (day: number) => {
        setMonthlyDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a,b) => a-b));
    };

    const selectAllDays = () => setHabitDays([0, 1, 2, 3, 4, 5, 6]);
    const selectWeekdays = () => setHabitDays([1, 2, 3, 4, 5]);

    const scheduleSummary = useMemo(() => {
        if (scheduleType === 'monthly') {
            if (monthlyDays.length === 0) return 'No days selected';
            if (monthlyDays.length === 31) return 'Every day of the month';
            return `Monthly: day ${monthlyDays.slice().sort((a, b) => a - b).join(', ')}`;
        }
        if (habitDays.length === 7) return 'Every single day';
        if (habitDays.length === 5 && [1, 2, 3, 4, 5].every(d => habitDays.includes(d))) return 'Weekdays (Mon-Fri)';
        if (habitDays.length === 2 && [0, 6].every(d => habitDays.includes(d))) return 'Weekends (Sat-Sun)';
        if (habitDays.length === 0) return 'No days selected';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return habitDays.slice().sort().map(d => dayNames[d]).join(', ');
    }, [scheduleType, monthlyDays, habitDays]);

    const linkedGoal = useMemo(() => goals.find(g => g.id === linkedGoalId), [goals, linkedGoalId]);

    const renderHeaderStatus = () => {
        if (nextAction) {
            return (
                <button 
                    onClick={() => toggleHabitCompletion(nextAction.id, selectedDate)}
                    className="w-full bg-white/15 hover:bg-white/20 text-white rounded-[2rem] p-4 flex items-center justify-between active:scale-[0.97] transition-all group overflow-hidden border border-white/10 shadow-lg"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform bg-white/20 text-white shadow-inner`}>
                            <Play size={16} fill="currentColor" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 text-white">
                                {selectedDate === currentTodayStr ? 'Start Routine' : 'Backdate Completion'}
                            </p>
                            <h4 className="text-sm font-semibold truncate max-w-[200px] text-white">
                                {nextAction.title} <span className="opacity-70 ml-1.5 text-xs font-normal">({nextAction.duration || '5m'})</span>
                            </h4>
                        </div>
                    </div>
                    <ArrowRight size={18} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                </button>
            );
        }

        if (habits.length === 0) {
            return (
                <div className="w-full bg-white/5 backdrop-blur-md rounded-[2rem] p-4 flex items-center justify-center text-white/70 border border-white/5">
                    <span className="text-xs font-medium tracking-wide">Ready for your first habit</span>
                </div>
            );
        }

        if (habitsForDay.length === 0) {
            const dayName = parseLocalDate(selectedDate).toLocaleDateString(undefined, { weekday: 'long' });
            return (
                <div className="w-full bg-white/5 backdrop-blur-md rounded-[2rem] p-4 flex items-center justify-center text-white/70 border border-white/5">
                    <Calendar className="mr-2 opacity-50" size={14} />
                    <span className="text-xs font-medium tracking-wide">No habits scheduled for {dayName}</span>
                </div>
            );
        }

        return (
            <div className="w-full bg-white/5 backdrop-blur-md rounded-[2rem] p-4 flex items-center justify-center text-white/80 border border-white/5">
                <Check className="mr-2 opacity-70" size={16} strokeWidth={2.5} />
                <span className="text-xs font-semibold tracking-wide">All Habits Completed ✨</span>
            </div>
        );
    };

    return (
        <>
            <div className="pb-32 space-y-6 animate-in fade-in duration-700">
                {/* HERO HEADER */}
                <div className={`-mx-6 -mt-20 p-8 pt-28 rounded-b-[3.5rem] bg-gradient-to-br ${themeClasses?.gradient || 'from-indigo-600 to-blue-600'} relative shadow-xl overflow-hidden`}>
                    <div className="absolute top-4 right-6 opacity-20 text-white">{phaseIcon}</div>
                    <button 
                        onClick={() => setView('profile')} 
                        className="absolute top-24 right-6 w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-lg hover:scale-105 active:scale-95 transition-all overflow-hidden z-20 group"
                    >
                        {avatar && avatar.startsWith('data') ? <img src={avatar} className="w-full h-full object-cover" /> : avatar || '🌱'}
                    </button>

                    <div className="space-y-4 relative z-10">
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-80 text-white">Daily Focus</p>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight pr-16 text-white leading-tight">
                            {currentHour < 12 ? t('good_morning') : currentHour < 18 ? t('good_afternoon') : t('good_evening')}, {name.split(' ')[0]}
                        </h1>

                        {renderHeaderStatus()}
                        
                        {dashboardLayout?.showDailyWisdom !== false && dailyBriefing && (
                            <div onClick={() => setIsBriefingExpanded(!isBriefingExpanded)} className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 cursor-pointer hover:bg-black/25 transition-all group/briefing shadow-inner relative">
                                <div className="flex justify-between items-center opacity-70 mb-3">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                                        <Sparkles size={13} /> {t('daily_wisdom')}
                                    </span>
                                    <div className="flex items-center gap-3 text-white">
                                        <button onClick={(e) => { e.stopPropagation(); fetchBriefing(); }} className={`p-1 hover:bg-white/20 rounded-full transition-all ${isRefreshing ? 'opacity-40' : ''}`} disabled={isRefreshing}>
                                            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-300' : ''} />
                                        </button>
                                        {isBriefingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                </div>
                                <p className={`font-normal text-xs sm:text-[13px] leading-relaxed transition-opacity duration-300 ${isRefreshing ? 'opacity-30' : 'opacity-100'} text-white/95 ${isBriefingExpanded ? '' : 'line-clamp-2'}`}>
                                    "{dailyBriefing.motivation}"
                                </p>
                                {isBriefingExpanded && (
                                    <div className="grid grid-cols-2 gap-3 mt-5 animate-in slide-in-from-top-2">
                                        <div className="bg-white/10 rounded-2xl p-4 border border-white/10 text-center">
                                            <h3 className="text-[10px] font-semibold uppercase opacity-70 text-white mb-1 tracking-wider">Focus</h3>
                                            <p className="text-xs font-medium text-white">{dailyBriefing.focus}</p>
                                        </div>
                                        <div className="bg-white/10 rounded-2xl p-4 border border-white/10 text-center">
                                            <h3 className="text-[10px] font-semibold uppercase opacity-70 text-white mb-1 tracking-wider">Action</h3>
                                            <p className="text-xs font-medium text-white">{dailyBriefing.tip}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* KEYSTONE TASK */}
                {dailyBriefing?.priorityTask && (
                    <div className={`bg-white dark:bg-slate-800/90 p-6 rounded-[2rem] border ${themeClasses.border} animate-in slide-in-from-bottom-4 duration-500 shadow-sm`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl ${themeClasses.primary} flex items-center justify-center text-white shadow-md`}><Zap size={16} /></div>
                                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('keystone')}</h2>
                            </div>
                            <span className="text-xs font-medium text-slate-400">{parseLocalDate(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug mb-4">{dailyBriefing.priorityTask}</p>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${themeClasses.primary} transition-all duration-700 rounded-full`} style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}

                {/* SUNDAY WEEKLY REVIEW */}
                {(() => {
                    const weekRange = getWeekRangeString(new Date());
                    const isReviewCompleted = lastWeeklyReview?.weekEndDate === weekRange.endStr;
                    return isSunday(new Date()) && !isReviewCompleted && <WeeklyReviewCard />;
                })()}

                {/* RITUAL NAVIGATOR */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Daily Habits</h3>
                            <button onClick={() => setIsMomentumOpen(!isMomentumOpen)} className={`p-1.5 rounded-lg transition-all ${isMomentumOpen ? themeClasses.secondary + ' ' + themeClasses.text : 'text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                <History size={14} />
                            </button>
                        </div>
                        <button onClick={() => { setEditingHabitId(null); setShowHabitModal(true); }} className={`${themeClasses.text} p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors`} title="Habit Builder">
                            <Plus size={18} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* QUICK ADD HABIT (1-TAP ZERO FRICTION) */}
                    <form onSubmit={handleQuickAddHabit} className="flex items-center gap-2 px-1">
                        <div className="relative flex-1">
                            <input 
                                type="text"
                                value={quickHabitTitle}
                                onChange={e => setQuickHabitTitle(e.target.value)}
                                placeholder={`+ Quick add habit for ${activeHabitTab}...`}
                                className="w-full bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-500 shadow-sm transition-colors"
                            />
                            {quickHabitTitle && (
                                <button 
                                    type="button" 
                                    onClick={() => setQuickHabitTitle('')} 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <button 
                            type="submit" 
                            disabled={!quickHabitTitle.trim() || submittingHabit} 
                            className={`px-4 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider text-white shadow-sm disabled:opacity-40 transition-all bg-gradient-to-br ${themeClasses.gradient} shrink-0 active:scale-95`}
                        >
                            Add
                        </button>
                    </form>

                    {isMomentumOpen && (
                        <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-[2.5rem] p-4 border border-slate-100 dark:border-slate-700/50 animate-in slide-in-from-top-2">
                            <div className="flex justify-start gap-4 overflow-x-auto no-scrollbar py-1 snap-x">
                                {momentumDays.map((day) => {
                                    const isSelected = selectedDate === day.full;
                                    return (
                                        <button key={day.full} onClick={() => setSelectedDate(day.full)} className={`flex flex-col items-center gap-2 min-w-[48px] transition-all relative snap-center ${isSelected ? 'scale-110' : 'opacity-40'}`}>
                                            <span className={`text-[10px] font-semibold uppercase ${isSelected ? themeClasses.text : 'text-slate-400'}`}>{day.isToday ? 'Now' : day.dayName}</span>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${isSelected ? `${themeClasses.primary} text-white shadow-md border-transparent` : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>{day.dayNum}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">
                        {(['Morning', 'Afternoon', 'Evening', 'Anytime'] as const).map(time => {
                            const stats = getTabStats(time);
                            const isActive = activeHabitTab === time;
                            return (
                                <button key={time} onClick={() => setActiveHabitTab(time)} className={`flex flex-col min-w-[95px] p-4 rounded-[1.75rem] border-2 transition-all relative ${isActive ? `${themeClasses.secondary} ${themeClasses.border}` : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800/50 opacity-60'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        {time === 'Morning' && <Coffee size={13} className={isActive ? themeClasses.text : 'text-slate-400'} />}
                                        {time === 'Afternoon' && <Sun size={13} className={isActive ? themeClasses.text : 'text-slate-400'} />}
                                        {time === 'Evening' && <Sunset size={13} className={isActive ? themeClasses.text : 'text-slate-400'} />}
                                        {time === 'Anytime' && <Zap size={13} className={isActive ? themeClasses.text : 'text-slate-400'} />}
                                        <span className="text-[10px] font-medium text-slate-400">{stats.done}/{stats.count}</span>
                                    </div>
                                    <span className={`text-xs font-semibold tracking-wide text-left ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{time}</span>
                                </button>
                            );
                        })}
                    </div>
                    
                    <div className="space-y-3 min-h-[150px]">
                        {filteredHabits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                                <Calendar size={24} className="opacity-30" />
                                <p className="text-xs font-medium text-slate-400 text-center">No habits scheduled</p>
                                <button onClick={() => { setEditingHabitId(null); setHabitTime(activeHabitTab); setShowHabitModal(true); }} className={`text-xs font-semibold ${themeClasses.text}`}>Add a Habit</button>
                            </div>
                        ) : (
                            filteredHabits.map(h => {
                                const isDone = h.completedDates.includes(selectedDate);
                                const streakInfo = calculateHabitStreak(h.completedDates, h.daysOfWeek, selectedDate, h.scheduleType, h.monthlyDays);
                                const showRecoveryBadge = streakInfo.canRecoverToday && !isDone && selectedDate === currentTodayStr;

                                return (
                                    <div key={h.id} className={`bg-white dark:bg-slate-800/90 p-4 rounded-[2rem] border transition-all flex items-center group ${isDone ? 'opacity-50 border-transparent bg-slate-50/50 dark:bg-slate-800/40' : 'border-slate-100 dark:border-slate-700 shadow-sm'}`}>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className={`font-semibold text-sm leading-snug ${isDone ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>{h.title}</h4>
                                                <button onClick={() => handleEditHabit(h)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-indigo-500 transition-all ml-1"><Pencil size={12} /></button>
                                            </div>
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <div className="flex items-center gap-1">
                                                    <Flame size={12} className={isDone ? 'text-slate-300' : 'text-orange-500'} />
                                                    <span className={`text-xs font-semibold ${isDone ? 'text-slate-400' : 'text-orange-500'}`}>{streakInfo.currentStreak}d streak</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600/50">
                                                    <Tag size={9} className="text-slate-400" />
                                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{h.category}</span>
                                                </div>
                                                {showRecoveryBadge && (
                                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 animate-pulse">
                                                        <Zap size={9} /> Never miss twice: do today
                                                    </span>
                                                )}
                                                {h.reward && (
                                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${
                                                        (h.reward.bankedBalance || 0) > 0 
                                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                                                            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/50'
                                                    }`}>
                                                        <Gift size={9} />
                                                        <span>+{h.reward.amount}{h.reward.unit} {h.reward.title}</span>
                                                        {(h.reward.bankedBalance || 0) > 0 && (
                                                            <span className="font-bold">({h.reward.bankedBalance} ready)</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => toggleHabitCompletion(h.id, selectedDate)} className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 ml-4 ${isDone ? `${themeClasses.primary} text-white shadow-md` : 'bg-slate-50 dark:bg-slate-700 text-slate-300 border border-slate-100 dark:border-slate-600 shadow-sm'}`}>
                                            <Check size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    
                    <div className="pt-4">
                        <button 
                            onClick={() => setShowScheduledHabits(!showScheduledHabits)}
                            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors w-full justify-center py-2"
                        >
                            {showScheduledHabits ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {showScheduledHabits ? 'Hide Scheduled Habits' : 'View Scheduled Habits'}
                        </button>
                        {showScheduledHabits && (
                            <div className="space-y-3 pt-4 animate-in fade-in slide-in-from-top-2">
                                {habits.filter(h => !habitsForDay.includes(h)).length === 0 ? (
                                    <p className="text-xs text-center text-slate-400 italic">No other scheduled habits.</p>
                                ) : (
                                    habits.filter(h => !habitsForDay.includes(h)).map(h => (
                                        <div key={h.id} className="bg-white dark:bg-slate-800/50 p-3 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{h.title}</h4>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                                                    {h.scheduleType === 'monthly' ? `Monthly: Day ${h.monthlyDays?.join(', ')}` : `Weekly: ${h.daysOfWeek?.map(d => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d]).join(', ')}`}
                                                </p>
                                            </div>
                                            <button onClick={() => handleEditHabit(h)} className="p-2 text-slate-400 hover:text-indigo-500"><Pencil size={14} /></button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* GUILT-FREE REWARDS / BANKED TREATS (PREMACK PRINCIPLE) */}
                <BankedRewardsCard onOpenHabitModal={() => { setEditingHabitId(null); setShowHabitModal(true); setHabitWizardStep(4); }} />

                <div className="grid grid-cols-2 gap-4">
                    <div onClick={() => setView('insights')} className="bg-white dark:bg-slate-800/90 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 cursor-pointer active:scale-95 transition-all flex flex-col gap-2.5 shadow-sm hover:shadow-md">
                        <div className="flex justify-between items-start">
                            <div className={`w-8 h-8 rounded-xl ${themeClasses.secondary} ${themeClasses.text} flex items-center justify-center shadow-inner`}><Star size={16} fill="currentColor" /></div>
                            <span className={`text-base font-bold ${themeClasses.text}`}>{progress}%</span>
                        </div>
                        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 tracking-wide">Daily Consistency</h3>
                    </div>
                    <div onClick={() => setView('goals')} className="bg-white dark:bg-slate-800/90 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 cursor-pointer active:scale-95 transition-all flex flex-col gap-2.5 shadow-sm hover:shadow-md">
                        <div className="flex justify-between items-start">
                            <div className={`w-8 h-8 rounded-xl ${themeClasses.secondary} ${themeClasses.text} flex items-center justify-center shadow-inner`}><Trophy size={16} /></div>
                            <span className={`text-base font-bold ${themeClasses.text}`}>{goals.length}</span>
                        </div>
                        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 tracking-wide">Active Goals</h3>
                    </div>
                </div>
            </div>

            {showHabitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={resetHabitForm} />
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 relative animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[92vh]">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Step {habitWizardStep} of 4
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className={`text-[11px] font-semibold tracking-wide ${themeClasses.text}`}>
                                        {habitWizardStep === 1 ? 'Habit Loop' : habitWizardStep === 2 ? 'Category' : habitWizardStep === 3 ? 'Schedule & Time' : 'Connect to Goal'}
                                    </span>
                                </div>
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-white mt-0.5">
                                    {editingHabitId ? 'Edit Habit' : 'New Habit'}
                                </h2>
                            </div>
                            <button 
                                onClick={resetHabitForm} 
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Step Progress Pill Bar */}
                        <div className="grid grid-cols-4 gap-2 pt-3 pb-2">
                            {[
                                { step: 1, label: 'Loop' },
                                { step: 2, label: 'Category' },
                                { step: 3, label: 'Timing' },
                                { step: 4, label: 'Goal' }
                            ].map(item => {
                                const isCurrent = habitWizardStep === item.step;
                                const isPassed = habitWizardStep > item.step;
                                const canNavigate = item.step === 1 || habitTitle.trim().length > 0 || editingHabitId;
                                return (
                                    <button
                                        key={item.step}
                                        type="button"
                                        disabled={!canNavigate}
                                        onClick={() => {
                                            if (canNavigate) setHabitWizardStep(item.step);
                                        }}
                                        className="flex flex-col gap-1 text-left group transition-all disabled:opacity-40"
                                    >
                                        <div className={`h-1.5 rounded-full transition-all ${
                                            isCurrent 
                                                ? `${themeClasses.primary} shadow-sm` 
                                                : isPassed 
                                                ? 'bg-emerald-500' 
                                                : 'bg-slate-200 dark:bg-slate-800'
                                        }`} />
                                        <span className={`text-[10px] font-semibold tracking-wider uppercase transition-colors ${
                                            isCurrent ? themeClasses.text : isPassed ? 'text-emerald-500' : 'text-slate-400'
                                        }`}>
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Form / Step Content Area */}
                        <div className="flex-1 overflow-y-auto no-scrollbar pt-2 pb-2 flex flex-col justify-between">
                            {/* STEP 1: THE HABIT LOOP (CUE & ACTION) - Radically Simplified */}
                            {habitWizardStep === 1 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-normal text-slate-400">
                                            Anchor a new action to an existing daily cue.
                                        </p>
                                        
                                        {/* Helper Info Button & Popover */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setShowTriggerTooltip(!showTriggerTooltip)}
                                                onMouseEnter={() => setShowTriggerTooltip(true)}
                                                onMouseLeave={() => setShowTriggerTooltip(false)}
                                                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center justify-center transition-colors"
                                                aria-label="Why habit stacking works"
                                            >
                                                <HelpCircle size={14} />
                                            </button>

                                            {showTriggerTooltip && (
                                                <div className="absolute right-0 top-7 w-64 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 z-30 animate-in fade-in zoom-in-95 text-xs">
                                                    <div className="flex items-center gap-1.5 font-semibold text-emerald-400 text-xs mb-1">
                                                        <Sparkles size={13} />
                                                        <span>Habit Stacking</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                                        Anchoring a new habit to an existing routine (like <em>pouring morning coffee</em>) makes it natural to remember and effortless to sustain.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* CUE INPUT ("After I...") */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            After I... <span className="font-normal lowercase text-slate-400">(trigger anchor)</span>
                                        </label>
                                        <input
                                            value={habitTrigger}
                                            onChange={e => setHabitTrigger(e.target.value)}
                                            placeholder="e.g. pour morning coffee, finish dinner..."
                                            className="w-full bg-slate-50 dark:bg-slate-800/80 rounded-2xl px-4 py-3 text-sm font-normal text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 border border-slate-200 dark:border-slate-700"
                                        />
                                    </div>

                                    {/* ACTION INPUT ("I will...") */}
                                    <div className="space-y-1.5 pt-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                            <span>
                                                I will... <span className="text-rose-500">*</span>
                                            </span>
                                            <span className="font-normal lowercase text-slate-400">(micro-action)</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                value={habitTitle}
                                                onChange={e => setHabitTitle(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && habitTitle.trim()) {
                                                        e.preventDefault();
                                                        setHabitWizardStep(2);
                                                    }
                                                }}
                                                placeholder="e.g. read 5 pages, meditate for 3m, stretch..."
                                                className="w-full bg-slate-50 dark:bg-slate-800/80 rounded-2xl px-4 py-3 text-sm font-normal text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 pr-10 border border-slate-200 dark:border-slate-700"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAtomize}
                                                disabled={!habitTitle.trim() || isAtomizing}
                                                title="Make this habit smaller with AI"
                                                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl ${themeClasses.secondary} ${themeClasses.text} disabled:opacity-30 transition-all`}
                                            >
                                                {isAtomizing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* INLINE DURATION PILLS */}
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                            Duration
                                        </span>
                                        <div className="flex gap-1.5">
                                            {['2m', '5m', '10m', '15m'].map(dur => (
                                                <button
                                                    key={dur}
                                                    type="button"
                                                    onClick={() => setHabitDuration(dur)}
                                                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                                                        habitDuration === dur
                                                            ? `${themeClasses.primary} text-white border-transparent shadow-sm`
                                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {dur}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: LIFE DOMAIN (CATEGORY) */}
                            {habitWizardStep === 2 && (
                                <div className="space-y-3.5 animate-in fade-in duration-200">
                                    <p className="text-xs font-normal text-slate-400">
                                        Choose the pillar of your life this habit nurtures.
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                                        {Object.values(GoalCategory).map(cat => {
                                            const meta = CATEGORY_META[cat] || { label: cat, icon: Tag, desc: 'Daily ritual' };
                                            const Icon = meta.icon;
                                            const isSelected = habitCategory === cat;
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setHabitCategory(cat)}
                                                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                                                        isSelected
                                                            ? `bg-slate-50 dark:bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm`
                                                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                    }`}
                                                >
                                                    <div className={`p-2 rounded-xl shrink-0 ${isSelected ? `${themeClasses.secondary} ${themeClasses.text}` : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                        <Icon size={18} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                                                {meta.label}
                                                            </h4>
                                                            {isSelected && (
                                                                <CheckCircle2 size={15} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                                                            {meta.desc}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: ROUTINE CADENCE & TIME WINDOW - Clean & Uncluttered */}
                            {habitWizardStep === 3 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <p className="text-xs font-normal text-slate-400">
                                        Pick your active days and preferred time of day.
                                    </p>

                                    {/* Days Selection */}
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            {/* Weekly vs Monthly Pill Switcher */}
                                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setScheduleType('weekly')}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                        scheduleType === 'weekly'
                                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                                    }`}
                                                >
                                                    Weekly
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setScheduleType('monthly');
                                                        if (monthlyDays.length === 0) setMonthlyDays([1]);
                                                    }}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                        scheduleType === 'monthly'
                                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                                    }`}
                                                >
                                                    Monthly
                                                </button>
                                            </div>

                                            {/* Presets based on schedule type */}
                                            {scheduleType === 'weekly' ? (
                                                <div className="flex items-center gap-1.5 text-[11px]">
                                                    <button
                                                        type="button"
                                                        onClick={selectAllDays}
                                                        className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline"
                                                    >
                                                        Every Day
                                                    </button>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <button
                                                        type="button"
                                                        onClick={selectWeekdays}
                                                        className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline"
                                                    >
                                                        Weekdays
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <button
                                                        type="button"
                                                        onClick={() => setMonthlyDays([1])}
                                                        className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline"
                                                    >
                                                        1st
                                                    </button>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMonthlyDays([1, 15])}
                                                        className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline"
                                                    >
                                                        1st & 15th
                                                    </button>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMonthlyDays([31])}
                                                        className="font-semibold text-indigo-500 dark:text-indigo-400 hover:underline"
                                                    >
                                                        EOM
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Weekly Day Circles */}
                                        {scheduleType === 'weekly' ? (
                                            <div className="flex justify-between items-center gap-1.5 pt-0.5">
                                                {DAYS_OF_WEEK.map((day, i) => {
                                                    const isSelected = habitDays.includes(i);
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => toggleDay(i)}
                                                            className={`flex-1 aspect-square rounded-xl text-xs font-semibold transition-all flex items-center justify-center border ${
                                                                isSelected
                                                                    ? `${themeClasses.primary} text-white border-transparent shadow-sm`
                                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            /* Monthly 31-Day Date Matrix */
                                            <div className="space-y-1.5 pt-0.5">
                                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-0.5">
                                                    <span>Select Day(s) of Month:</span>
                                                    <span>{monthlyDays.length > 0 ? `${monthlyDays.length} selected` : 'None'}</span>
                                                </div>
                                                <div className="grid grid-cols-7 gap-1 max-h-36 overflow-y-auto no-scrollbar p-1 bg-slate-50 dark:bg-slate-850/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    {Array.from({ length: 31 }).map((_, i) => {
                                                        const dayNum = i + 1;
                                                        const isSelected = monthlyDays.includes(dayNum);
                                                        return (
                                                            <button
                                                                key={dayNum}
                                                                type="button"
                                                                onClick={() => toggleMonthlyDay(dayNum)}
                                                                className={`aspect-square rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center border ${
                                                                    isSelected
                                                                        ? `${themeClasses.primary} text-white border-transparent shadow-sm`
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                {dayNum === 31 ? 'EOM' : dayNum}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Clean Time Window Chips */}
                                    <div className="space-y-2 pt-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Time of Day
                                        </span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'Morning', label: 'Morning', icon: Coffee },
                                                { id: 'Afternoon', label: 'Afternoon', icon: Sun },
                                                { id: 'Evening', label: 'Evening', icon: Sunset },
                                                { id: 'Anytime', label: 'Anytime', icon: Clock }
                                            ].map(opt => {
                                                const Icon = opt.icon;
                                                const isSelected = habitTime === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setHabitTime(opt.id as any)}
                                                        className={`py-3 px-3.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                                                            isSelected
                                                                ? `${themeClasses.secondary} border-indigo-400/50 ring-2 ring-indigo-500/20`
                                                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-xl ${isSelected ? `${themeClasses.primary} text-white` : 'text-slate-400 bg-white dark:bg-slate-700'}`}>
                                                            <Icon size={15} />
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-white">
                                                            {opt.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: GOAL ALIGNMENT & DEPLOYMENT - Interactive & Guaranteed to Work */}
                            {habitWizardStep === 4 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <p className="text-xs font-normal text-slate-400">
                                        Optionally connect this habit to a goal, or track it standalone.
                                    </p>

                                    {/* Interactive Goal Sync Picker */}
                                    <div className="space-y-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Connect to a Goal
                                        </span>
                                        <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar pr-1">
                                            <button
                                                type="button"
                                                onClick={() => setLinkedGoalId('')}
                                                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                                                    !linkedGoalId
                                                        ? 'bg-slate-50 dark:bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
                                                        : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-base">🌱</span>
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-800 dark:text-white">
                                                            Standalone Habit
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-normal">
                                                            Independent routine, not tied to a single goal
                                                        </p>
                                                    </div>
                                                </div>
                                                {!linkedGoalId && (
                                                    <CheckCircle2 size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                                                )}
                                            </button>

                                            {goals.map(g => {
                                                const isSelected = linkedGoalId === g.id;
                                                return (
                                                    <button
                                                        key={g.id}
                                                        type="button"
                                                        onClick={() => setLinkedGoalId(g.id)}
                                                        className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                                                            isSelected
                                                                ? 'bg-slate-50 dark:bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20'
                                                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Target size={16} className={isSelected ? 'text-indigo-500' : 'text-slate-400'} />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                                                    {g.title}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 font-normal">
                                                                    {g.category}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <CheckCircle2 size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* OPTIONAL TEMPTATION BUNDLING / REWARD (PREMACK PRINCIPLE) */}
                                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${hasReward ? `${themeClasses.primary} text-white` : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                    <Gift size={14} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                                                        <span>Guilt-Free Reward</span>
                                                        <span className="text-[9px] uppercase tracking-wider text-indigo-500 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-md">Premack Principle</span>
                                                    </h4>
                                                    <p className="text-[10px] text-slate-400 font-normal">
                                                        Earn what you love after doing what matters
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setHasReward(!hasReward)}
                                                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                                                    hasReward ? themeClasses.primary : 'bg-slate-200 dark:bg-slate-700'
                                                }`}
                                            >
                                                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                                                    hasReward ? 'translate-x-5' : 'translate-x-0'
                                                }`} />
                                            </button>
                                        </div>

                                        {hasReward && (
                                            <div className="space-y-3 bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 animate-in fade-in duration-200">
                                                {/* Quick Presets */}
                                                <div>
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                        Popular Pairings
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                                                        {[
                                                            { title: 'Gaming', amount: 30, unit: 'min', icon: '🎮' },
                                                            { title: 'Netflix', amount: 1, unit: 'ep', icon: '🍿' },
                                                            { title: 'Coffee Treat', amount: 1, unit: 'cup', icon: '☕' },
                                                            { title: 'Social Media', amount: 15, unit: 'min', icon: '📱' },
                                                            { title: 'Podcast Walk', amount: 30, unit: 'min', icon: '🎧' }
                                                        ].map(preset => (
                                                            <button
                                                                key={preset.title}
                                                                type="button"
                                                                onClick={() => {
                                                                    setRewardTitle(preset.title);
                                                                    setRewardAmount(preset.amount);
                                                                    setRewardUnit(preset.unit);
                                                                }}
                                                                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                                                                    rewardTitle === preset.title && rewardAmount === preset.amount
                                                                        ? 'bg-indigo-500 text-white border-transparent shadow-xs'
                                                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
                                                                }`}
                                                            >
                                                                <span>{preset.icon}</span>
                                                                <span>{preset.amount}{preset.unit} {preset.title}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Inputs: Habit Target (Optional) & Earned Reward */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                                    {/* Habit Unit/Target (e.g. 20 pages) */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                            Habit Goal (optional)
                                                        </label>
                                                        <div className="flex gap-1.5">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={targetAmount}
                                                                onChange={e => setTargetAmount(e.target.value)}
                                                                placeholder="e.g. 20"
                                                                className="w-16 bg-white dark:bg-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={targetUnit}
                                                                onChange={e => setTargetUnit(e.target.value)}
                                                                placeholder="pages, min, reps"
                                                                className="flex-1 bg-white dark:bg-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Reward Earned */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                            Reward Earned
                                                        </label>
                                                        <div className="flex gap-1.5">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={rewardAmount}
                                                                onChange={e => setRewardAmount(parseInt(e.target.value) || 0)}
                                                                className="w-14 bg-white dark:bg-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={rewardUnit}
                                                                onChange={e => setRewardUnit(e.target.value)}
                                                                placeholder="min"
                                                                className="w-12 bg-white dark:bg-slate-800 rounded-xl px-1.5 py-1.5 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={rewardTitle}
                                                                onChange={e => setRewardTitle(e.target.value)}
                                                                placeholder="Gaming"
                                                                className="flex-1 bg-white dark:bg-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Tactile Habit Summary Preview */}
                                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <Zap size={12} className="text-amber-500" /> Habit Blueprint
                                            </span>
                                            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-lg ${themeClasses.secondary} ${themeClasses.text}`}>
                                                {habitDuration}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
                                            {habitTrigger ? (
                                                <span>After I <span className="font-semibold text-slate-900 dark:text-white">{habitTrigger}</span>, I will </span>
                                            ) : (
                                                <span>I will </span>
                                            )}
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {habitTitle || 'complete this habit'}
                                                {hasReward && targetAmount ? ` (${targetAmount} ${targetUnit})` : ''}
                                            </span>.
                                            {hasReward && rewardTitle && (
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
                                                    Then I enjoy {rewardAmount} {rewardUnit} of {rewardTitle} guilt-free.
                                                </span>
                                            )}
                                        </p>

                                        <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                                            <span className="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 font-medium">
                                                🏷️ {habitCategory}
                                            </span>
                                            <span className="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 font-medium">
                                                ☀️ {habitTime}
                                            </span>
                                            <span className="bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 font-medium">
                                                📅 {scheduleSummary}
                                            </span>
                                            {hasReward && rewardTitle && (
                                                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center gap-1">
                                                    🎁 +{rewardAmount}{rewardUnit} {rewardTitle}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Stepper Footer / Navigation Controls */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 space-y-2">
                                <div className="flex items-center gap-3">
                                    {habitWizardStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setHabitWizardStep(prev => prev - 1)}
                                            className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            <ArrowLeft size={15} /> Back
                                        </button>
                                    )}

                                    {habitWizardStep < 4 ? (
                                        <button
                                            type="button"
                                            disabled={habitWizardStep === 1 && !habitTitle.trim()}
                                            onClick={() => setHabitWizardStep(prev => prev + 1)}
                                            className={`flex-1 bg-gradient-to-br ${themeClasses.gradient} text-white py-3 rounded-2xl font-semibold text-xs tracking-wide shadow-md transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2`}
                                        >
                                            <span>
                                                {habitWizardStep === 1 ? 'Next: Category' : habitWizardStep === 2 ? 'Next: Timing' : 'Next: Connect Goal'}
                                            </span>
                                            <ArrowRight size={15} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={!habitTitle.trim() || submittingHabit}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleSaveHabit();
                                            }}
                                            className={`flex-1 bg-gradient-to-br ${themeClasses.gradient} text-white py-3.5 rounded-2xl font-semibold text-xs tracking-wide shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2`}
                                        >
                                            {submittingHabit ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                            <span>{submittingHabit ? 'Saving...' : editingHabitId ? 'Save Changes' : 'Save Habit'}</span>
                                        </button>
                                    )}
                                </div>

                                {editingHabitId && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteHabit}
                                        className="w-full py-2 text-xs font-medium text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 transition-all opacity-80 hover:opacity-100"
                                    >
                                        <Trash2 size={13} /> Delete Habit
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
