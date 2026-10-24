
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Goal, GoalCategory, Milestone, Habit, JournalEntry, GoalOutcome } from '../types';
import { 
    Target, Trophy, Plus, ChevronDown, Check, Sparkles, Loader2, X, 
    Trash2, ListPlus, Calendar, Info, Pencil, Zap, BookOpen, 
    Activity, PauseCircle, PlayCircle, Archive, ArrowRight, RotateCcw,
    Leaf, Sun, Wind, Snowflake, History, Quote, Compass, Clock, Heart,
    Share2, ExternalLink, Flame, Sprout, AlertCircle
} from 'lucide-react';
import { generateMilestonesForGoal } from '../services/geminiService';
import { toLocalDateString, parseLocalDate } from '../services/date';

interface GoalsProps {
    setView: (view: string) => void;
}

export const Goals: React.FC<GoalsProps> = ({ setView }) => {
    const { goals, habits, journalEntries, addGoal, updateGoal, deleteGoal, addHabit, toggleHabitCompletion, setPreselectedGoalId, themeClasses, t, language, triggerNotification } = useApp();
    const [activeTab, setActiveTab] = useState<'active' | 'needs' | 'hall'>('active');
    const [showModal, setShowModal] = useState(false);
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

    // Confirmation State for deletion (Mobile-safe alternative to window.confirm)
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    // Archiving Flow State
    const [showArchiveFlow, setShowArchiveFlow] = useState<string | null>(null);
    const [archiveOutcome, setArchiveOutcome] = useState<GoalOutcome>('Integrated');
    const [archiveStayed, setArchiveStayed] = useState('');
    const [archiveShifted, setArchiveShifted] = useState('');
    const [archiveImpact, setArchiveImpact] = useState('');

    // Form State
    const [title, setTitle] = useState('');
    const [whyStatement, setWhyStatement] = useState('');
    const [category, setCategory] = useState<GoalCategory>(GoalCategory.Personal);
    const [deadline, setDeadline] = useState('');
    const [milestones, setMilestones] = useState<string[]>([]);
    const [manualMilestone, setManualMilestone] = useState('');

    const today = toLocalDateString();

    const filtered = goals.filter(g => {
        if (activeTab === 'active') return !g.completed && !g.isPaused;
        if (activeTab === 'needs') return g.isPaused;
        if (activeTab === 'hall') return g.completed;
        return false;
    });

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = parseLocalDate(dateStr.split('T')[0]);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getGrowthStage = (progress: number) => {
        if (progress === 0) return 'Dormant';
        if (progress <= 25) return 'Sprouting';
        if (progress <= 50) return 'Rising';
        if (progress <= 75) return 'Blooming';
        if (progress < 100) return 'Maturing';
        return 'Integrated';
    };

    const handleSaveGoal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        
        const milestoneTitles = milestones.length > 0 ? milestones : [title];

        if (editingGoalId) {
            const existingGoal = goals.find(g => g.id === editingGoalId);
            if (!existingGoal) return;

            const updatedMilestones: Milestone[] = milestoneTitles.map(mTitle => {
                const existing = existingGoal.milestones.find(m => m.title === mTitle);
                return {
                    id: existing?.id || Math.random().toString(36).substr(2, 9),
                    title: mTitle,
                    completed: existing?.completed || false
                };
            });

            const totalMilestones = updatedMilestones.length;
            const completedCount = updatedMilestones.filter(m => m.completed).length;
            const progress = totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : 0;

            updateGoal(editingGoalId, {
                title,
                whyStatement,
                category,
                deadline: deadline || undefined,
                milestones: updatedMilestones,
                progress,
                completed: progress === 100
            });
        } else {
            addGoal({
                id: Date.now().toString(),
                title, 
                whyStatement,
                category, 
                progress: 0, 
                completed: false,
                milestones: milestoneTitles.map(m => ({ 
                    id: Math.random().toString(36).substr(2, 9), 
                    title: m, 
                    completed: false 
                })),
                deadline: deadline || undefined,
                startDate: new Date().toISOString()
            });
        }
        resetForm();
    };

    const handleEditClick = (goal: Goal) => {
        setEditingGoalId(goal.id);
        setTitle(goal.title);
        setWhyStatement(goal.whyStatement || '');
        setCategory(goal.category);
        setDeadline(goal.deadline || '');
        setMilestones(goal.milestones.map(m => m.title));
        setShowModal(true);
    };

    const resetForm = () => {
        setShowModal(false);
        setEditingGoalId(null);
        setTitle('');
        setWhyStatement('');
        setCategory(GoalCategory.Personal);
        setDeadline('');
        setMilestones([]);
        setManualMilestone('');
    };

    const handleGenerate = async () => {
        if (!title.trim()) return;
        setGenerating(true);
        const results = await generateMilestonesForGoal(title, language);
        setMilestones(prev => [...prev, ...(Array.isArray(results) ? results : [])]);
        setGenerating(false);
    };

    const addManualMilestone = () => {
        if (manualMilestone.trim()) {
            setMilestones(prev => [...prev, manualMilestone.trim()]);
            setManualMilestone('');
        }
    };

    const toggleMilestone = (goalId: string, mid: string) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal || goal.completed) return;
        const newMilestones = goal.milestones.map(m => m.id === mid ? { ...m, completed: !m.completed } : m);
        const totalSteps = newMilestones.length;
        const finishedSteps = newMilestones.filter(m => m.completed).length;
        const progress = totalSteps > 0 ? Math.round((finishedSteps / totalSteps) * 100) : 0;
        updateGoal(goalId, { milestones: newMilestones, progress, completed: progress === 100 });
    };

    const deleteMilestoneFromGoal = (goalId: string, mid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const goal = goals.find(g => g.id === goalId);
        if (!goal || goal.completed) return;
        const newMilestones = goal.milestones.filter(m => m.id !== mid);
        const totalSteps = newMilestones.length;
        const finishedSteps = newMilestones.filter(m => m.completed).length;
        const progress = totalSteps > 0 ? Math.round((finishedSteps / totalSteps) * 100) : 0;
        updateGoal(goalId, { milestones: newMilestones, progress, completed: progress === 100 });
        triggerNotification('Step Removed', 'A milestone has been removed.', 'reminder');
    };

    const getMomentum = (goal: Goal) => {
        const linkedHabits = habits.filter(h => h.linkedGoalId === goal.id);
        const completions = linkedHabits.reduce((acc, h) => acc + h.completedDates.length, 0);
        
        if (completions > 5) return { label: 'Active Flow', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' };
        if (completions > 2) return { label: 'Steady Rise', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/10' };
        if (completions > 0) return { label: 'Returning', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10' };
        return { label: 'Quiet Roots', color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/50' };
    };

    const getSeasonMarker = (dateStr?: string) => {
        if (!dateStr) return { label: 'Spring', icon: <Leaf size={10} />, color: 'text-emerald-400' };
        const month = new Date(dateStr).getMonth();
        if (month >= 2 && month <= 4) return { label: 'Spring', icon: <Leaf size={10} />, color: 'text-emerald-400' };
        if (month >= 5 && month <= 7) return { label: 'Summer', icon: <Sun size={10} />, color: 'text-amber-400' };
        if (month >= 8 && month <= 10) return { label: 'Autumn', icon: <Wind size={10} />, color: 'text-orange-400' };
        return { label: 'Winter', icon: <Snowflake size={10} />, color: 'text-blue-400' };
    };

    const finalizeArchive = () => {
        if (!showArchiveFlow) return;
        updateGoal(showArchiveFlow, {
            completed: true,
            outcomeLabel: archiveOutcome,
            whatStayed: archiveStayed,
            whatShifted: archiveShifted,
            identityImpact: archiveImpact,
            archivedAt: new Date().toISOString()
        });
        setShowArchiveFlow(null);
        setArchiveStayed('');
        setArchiveShifted('');
        setArchiveImpact('');
        setExpandedGoalId(null);
        triggerNotification('Milestone Achieved', 'This path is now a permanent part of your journey.', 'achievement');
    };

    const revisitGoal = (goal: Goal, e: React.MouseEvent) => {
        e.stopPropagation();
        addGoal({
            ...goal,
            id: Date.now().toString(),
            completed: false,
            progress: 0,
            milestones: goal.milestones.map(m => ({ ...m, completed: false, id: Math.random().toString(36).substr(2, 9) })),
            startDate: new Date().toISOString(),
            archivedAt: undefined
        });
        setActiveTab('active');
        setExpandedGoalId(null);
    };

    const onReflectAction = (goalId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPreselectedGoalId(goalId);
        setView('journal');
    };

    // Fixed: Added mandatory 'category' property from the goal to the extracted ritual
    const extractRitualFromGoal = (goal: Goal, e: React.MouseEvent) => {
        e.stopPropagation();
        addHabit({
            id: Date.now().toString(),
            title: `Ritual: ${goal.title}`,
            category: goal.category,
            timeOfDay: 'Anytime',
            streak: 0,
            completedDates: [],
            linkedGoalId: goal.id
        });
        triggerNotification('Ritual Created', 'New ritual extracted from your growth path.', 'achievement');
    };

    const handleDeleteGoalRequest = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirmingDeleteId === id) {
            deleteGoal(id);
            setExpandedGoalId(null);
            setConfirmingDeleteId(null);
            triggerNotification('Path Removed', 'Growth path has been permanently deleted.', 'reminder');
        } else {
            setConfirmingDeleteId(id);
            setTimeout(() => setConfirmingDeleteId(prev => prev === id ? null : prev), 3000);
        }
    };

    return (
        <div className="pb-32 space-y-4 animate-in fade-in">
            {/* HEADER */}
            <div className="flex justify-between items-center px-1 pt-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Growth Map</h1>
                </div>
                <button 
                    type="button"
                    onClick={() => setShowModal(true)} 
                    className={`${themeClasses.primary} text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs font-semibold uppercase tracking-wider`}
                >
                    <Plus size={15} strokeWidth={2.5} /> Plant Seed
                </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex shadow-sm">
                {(['active', 'needs', 'hall'] as const).map(tab => (
                    <button 
                        key={tab} 
                        type="button"
                        onClick={() => setActiveTab(tab)} 
                        className={`flex-1 py-2 text-xs font-semibold tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        {tab === 'active' && <Compass size={13} className={activeTab === tab ? themeClasses.text : ''} />}
                        {tab === 'needs' && <PauseCircle size={13} />}
                        {tab === 'hall' && <Trophy size={13} />}
                        {tab === 'active' ? 'Nurturing' : tab === 'needs' ? 'Resting' : 'Journey'}
                    </button>
                ))}
            </div>

            {/* LIST OF GOALS */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center px-8 animate-in fade-in duration-500">
                        {activeTab === 'hall' ? (
                            <div className="space-y-3 opacity-60">
                                <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit mx-auto">
                                    <Trophy size={28} className="text-slate-400" />
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Journey Awaits</p>
                                    <p className="text-xs font-normal text-slate-400 dark:text-slate-500 leading-relaxed max-w-[240px] mx-auto italic">
                                        This hall captures the echoes of your transformation. Complete a goal to see it bloom here.
                                    </p>
                                </div>
                            </div>
                        ) : activeTab === 'needs' ? (
                            <div className="space-y-3 opacity-60">
                                <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit mx-auto">
                                    <PauseCircle size={28} className="text-slate-400" />
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resting Phase</p>
                                    <p className="text-xs font-normal text-slate-400 dark:text-slate-500 leading-relaxed max-w-[240px] mx-auto italic">
                                        No active rest. All your intentions are currently in motion or waiting to be planted.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl w-fit mx-auto relative group">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${themeClasses.gradient} rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity`} />
                                    <Sprout size={32} className={`${themeClasses.text} relative z-10`} />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-base font-bold text-slate-700 dark:text-slate-200">A Blank Canvas</p>
                                    <p className="text-xs font-normal text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] mx-auto italic">
                                        "A vision without structure is just a dream." Plant your first seed to begin the transformation.
                                    </p>
                                    <div className="pt-4">
                                        <button 
                                            type="button"
                                            onClick={() => setShowModal(true)}
                                            className={`px-6 py-3 rounded-2xl ${themeClasses.primary} text-white text-xs font-semibold uppercase tracking-wider shadow-md active:scale-95 transition-all`}
                                        >
                                            Plant Your First Seed
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    filtered.map(goal => {
                        const momentum = getMomentum(goal);
                        const linkedRituals = habits.filter(h => h.linkedGoalId === goal.id);
                        const recentReflections = journalEntries.filter(e => e.linkedGoalId === goal.id).slice(0, 3);
                        const doneCount = goal.milestones.filter(m => m.completed).length;
                        const season = getSeasonMarker(goal.startDate);
                        const growthStage = getGrowthStage(goal.progress);

                        if (goal.completed) {
                            return (
                                <div key={goal.id} className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden ${expandedGoalId === goal.id ? 'border-slate-200 dark:border-slate-700 shadow-md' : 'border-slate-100 dark:border-slate-800 shadow-sm'}`}>
                                    <div 
                                        onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}
                                        className="p-4 flex flex-col cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl ${themeClasses.secondary} ${themeClasses.text} flex items-center justify-center shrink-0 border ${themeClasses.border}`}>
                                                    <Trophy size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight truncate">{goal.title}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-medium uppercase text-slate-400 tracking-wider">{goal.category}</span>
                                                        <span className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ${season.color}`}>
                                                            {season.icon} {season.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500`}>
                                                {goal.outcomeLabel || 'Integrated'}
                                            </span>
                                        </div>

                                        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/40 grid grid-cols-2 gap-3 relative">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">What Stayed</p>
                                                <p className="text-xs font-normal text-slate-600 dark:text-slate-300 line-clamp-2 italic leading-relaxed">
                                                    "{goal.whatStayed || 'Effort left traces...'}"
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">What Shifted</p>
                                                <p className="text-xs font-normal text-slate-600 dark:text-slate-300 line-clamp-2 italic leading-relaxed">
                                                    "{goal.whatShifted || 'Growth transformed.'}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {expandedGoalId === goal.id && (
                                        <div className="px-5 pb-5 pt-1 animate-in slide-in-from-top-4 space-y-5">
                                            <div className="space-y-2 p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Quote size={13} className={themeClasses.text} />
                                                    <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Identity Impact</p>
                                                </div>
                                                <textarea 
                                                    className="w-full bg-transparent text-xs font-normal text-slate-600 dark:text-slate-300 italic leading-relaxed resize-none border-none outline-none"
                                                    value={goal.identityImpact || ""}
                                                    placeholder="This goal helped me become..."
                                                    onChange={(e) => updateGoal(goal.id, { identityImpact: e.target.value })}
                                                    rows={2}
                                                />
                                            </div>

                                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 grid grid-cols-2 gap-2.5">
                                                <button type="button" onClick={(e) => revisitGoal(goal, e)} className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 rounded-xl transition-all active:scale-[0.98]">
                                                    <RotateCcw size={13} />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Revisit</span>
                                                </button>
                                                <button type="button" onClick={(e) => extractRitualFromGoal(goal, e)} className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-amber-500 rounded-xl transition-all active:scale-[0.98]">
                                                    <Zap size={13} />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Extract Ritual</span>
                                                </button>
                                                <button type="button" onClick={(e) => onReflectAction(goal.id, e)} className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 rounded-xl transition-all active:scale-[0.98]">
                                                    <BookOpen size={13} />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Reflect</span>
                                                </button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedGoalId(null); }} className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-700 rounded-xl transition-all active:scale-[0.98]">
                                                    <Activity size={13} />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Close</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <div key={goal.id} className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden ${expandedGoalId === goal.id ? 'border-slate-200 dark:border-slate-700 shadow-md' : 'border-slate-100 dark:border-slate-800 shadow-sm'}`}>
                                <div 
                                    onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)} 
                                    className="p-4 flex items-center justify-between cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${themeClasses.secondary} ${themeClasses.text} border ${themeClasses.border}`}>
                                            <Target size={15} strokeWidth={2.5} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight truncate">{goal.title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-medium uppercase text-slate-400 tracking-wider">{goal.category}</span>
                                                {goal.deadline && (
                                                    <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                                        <Clock size={10} /> {formatDate(goal.deadline)}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${momentum.bg} ${momentum.color}`}>
                                                    {growthStage}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 ml-2">
                                        {expandedGoalId !== goal.id && (
                                            <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.text}`}>{growthStage}</p>
                                        )}
                                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedGoalId === goal.id ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {expandedGoalId === goal.id && (
                                    <div className="px-5 pb-6 pt-1 animate-in slide-in-from-top-4 space-y-5">
                                        <div className="space-y-1">
                                            <p className="text-xs sm:text-[13px] font-normal text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                                "{goal.whyStatement || 'Seeking clarity...'}"
                                            </p>
                                            <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Emotional Anchor</p>
                                        </div>

                                        <div className={`p-4 rounded-xl ${momentum.bg} border border-transparent flex items-center justify-between`}>
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Growth Rhythm</p>
                                                <p className={`text-xs font-bold ${momentum.color}`}>{momentum.label}</p>
                                            </div>
                                            <div className="text-right space-y-0.5">
                                                <p className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Growth Stage</p>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{growthStage}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center px-1">
                                                <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Nurturing Steps</p>
                                                <span className="text-xs font-medium text-slate-400">{doneCount} of {goal.milestones.length} tended</span>
                                            </div>
                                            <div className="space-y-2">
                                                {goal.milestones.map(m => (
                                                    <div 
                                                        key={m.id} 
                                                        onClick={() => toggleMilestone(goal.id, m.id)}
                                                        className="flex items-center gap-3 p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 active:scale-[0.98] transition-all group/milestone cursor-pointer"
                                                    >
                                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${m.completed ? 'bg-emerald-500 border-transparent text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'}`}>
                                                            {m.completed && <Check size={10} strokeWidth={3} />}
                                                        </div>
                                                        <span className={`text-xs font-medium leading-snug flex-1 ${m.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{m.title}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => deleteMilestoneFromGoal(goal.id, m.id, e)}
                                                            className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-all"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2.5">
                                            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider px-1">Linked Rituals</p>
                                            {linkedRituals.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    {linkedRituals.map(h => {
                                                        const isDone = h.completedDates.includes(today);
                                                        return (
                                                            <div key={h.id} className={`p-3.5 bg-white dark:bg-slate-900 rounded-xl border transition-all ${isDone ? 'opacity-50 border-transparent bg-slate-50 dark:bg-slate-800' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50'}`}>
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDone ? 'bg-slate-100 dark:bg-slate-800' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'}`}>
                                                                        <Zap size={14} fill={isDone ? 'none' : 'currentColor'} />
                                                                    </div>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); toggleHabitCompletion(h.id, today); }}
                                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isDone ? `${themeClasses.primary} text-white` : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}
                                                                    >
                                                                        <Check size={12} strokeWidth={3} />
                                                                    </button>
                                                                </div>
                                                                <h4 className={`text-xs font-semibold mb-1 truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>{h.title}</h4>
                                                                <p className="text-[10px] font-medium text-slate-400">
                                                                    {h.completedDates.length} completed
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-1.5">
                                                    <p className="text-xs font-normal text-slate-400">No linked rituals found</p>
                                                    <button type="button" onClick={() => setView('dashboard')} className="text-xs font-semibold uppercase tracking-wider text-indigo-500 hover:text-indigo-600 transition-colors">Link Ritual</button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2.5">
                                            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider px-1">Recent Reflections</p>
                                            {recentReflections.length > 0 ? (
                                                <div className="space-y-2">
                                                    {recentReflections.map(e => (
                                                        <div key={e.id} className="p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                                            <p className="text-xs font-normal text-slate-600 dark:text-slate-300 line-clamp-2 italic">"{e.content}"</p>
                                                            <span className="text-[10px] font-medium text-slate-400 mt-1 block">
                                                                {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={(e) => onReflectAction(goal.id, e)} className="w-full py-1.5 text-xs font-semibold uppercase text-indigo-500 tracking-wider">Reflect Again</button>
                                                </div>
                                            ) : (
                                                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-1.5">
                                                    <p className="text-xs font-normal text-slate-400">No narrative reflections yet</p>
                                                    <button type="button" onClick={(e) => onReflectAction(goal.id, e)} className="text-xs font-semibold uppercase tracking-wider text-indigo-500 hover:text-indigo-600 transition-colors">Reflect Now</button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 space-y-2 border-t border-slate-100 dark:border-slate-800/50">
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleEditClick(goal); }} className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-700 rounded-xl transition-all active:scale-[0.98]">
                                                    <Pencil size={13} />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Edit</span>
                                                </button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); updateGoal(goal.id, { isPaused: !goal.isPaused }); }} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all active:scale-[0.98] ${goal.isPaused ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}>
                                                    {goal.isPaused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                                                    <span className="text-xs font-semibold uppercase tracking-wider">{goal.isPaused ? 'Resume' : 'Pause'}</span>
                                                </button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setShowArchiveFlow(goal.id); }} className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 rounded-xl transition-all active:scale-[0.98]">
                                                    <Archive size={13} />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Archive</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => handleDeleteGoalRequest(goal.id, e)} 
                                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all active:scale-[0.98] ${confirmingDeleteId === goal.id ? 'bg-rose-500 text-white border-transparent shadow-lg' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-400 hover:text-rose-600 border-rose-100 dark:border-rose-900/10'}`}
                                                >
                                                    {confirmingDeleteId === goal.id ? <AlertCircle size={13} /> : <Trash2 size={13} />}
                                                    <span className="text-xs font-semibold uppercase tracking-wider">
                                                        {confirmingDeleteId === goal.id ? 'Confirm?' : 'Delete'}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ARCHIVE JOURNEY MODAL */}
            {showArchiveFlow && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-sm rounded-[2rem] p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative animate-in zoom-in-95">
                        <button type="button" onClick={() => setShowArchiveFlow(null)} className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-600 transition-colors"><X size={18}/></button>
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Seal Your Journey</h2>
                            <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">Growth transforms, never disappears.</p>
                        </div>
                        
                        <div className="space-y-5 max-h-[60vh] overflow-y-auto no-scrollbar pb-1">
                             <div className="space-y-2">
                                <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">The Essence of Outcome</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['Integrated', 'Evolved', 'Paused with Insight', 'Completed', 'Redirected'] as GoalOutcome[]).map(outcome => (
                                        <button 
                                            key={outcome}
                                            type="button"
                                            onClick={() => setArchiveOutcome(outcome)}
                                            className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all ${archiveOutcome === outcome ? `${themeClasses.primary} text-white border-transparent shadow-sm` : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-800 hover:text-slate-800'}`}
                                        >
                                            {outcome}
                                        </button>
                                    ))}
                                </div>
                             </div>

                             <div className="space-y-3.5">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">Identity Impact</label>
                                    <textarea 
                                        value={archiveImpact}
                                        onChange={e => setArchiveImpact(e.target.value)}
                                        placeholder="This goal helped me become..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-xs font-normal italic border border-slate-100 dark:border-slate-700 outline-none h-18 resize-none text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">What Stayed?</label>
                                    <textarea 
                                        value={archiveStayed}
                                        onChange={e => setArchiveStayed(e.target.value)}
                                        placeholder="Which habits or beliefs took root?"
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-xs font-normal italic border border-slate-100 dark:border-slate-700 outline-none h-18 resize-none text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">What Shifted?</label>
                                    <textarea 
                                        value={archiveShifted}
                                        onChange={e => setArchiveShifted(e.target.value)}
                                        placeholder="How did your priorities evolve?"
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-xs font-normal italic border border-slate-100 dark:border-slate-700 outline-none h-18 resize-none text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                             </div>

                             <button type="button" onClick={finalizeArchive} className={`w-full py-3.5 rounded-xl font-semibold text-xs uppercase tracking-wider text-white shadow-md bg-gradient-to-br ${themeClasses.gradient} mt-3`}>
                                Integrate to Journey
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-7 shadow-2xl border border-slate-100 dark:border-slate-800 relative animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[85vh]">
                        <button type="button" onClick={resetForm} className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-600 transition-colors z-10"><X size={20}/></button>
                        
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{editingGoalId ? 'Refine Path' : 'New Horizon'}</h2>
                            <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">Growth transforms, never disappears.</p>
                        </div>

                        <form onSubmit={handleSaveGoal} className="space-y-5 flex-1 overflow-y-auto no-scrollbar pr-1 pb-2">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">Goal Identity</label>
                                <input 
                                    required 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3.5 text-sm font-normal outline-none dark:text-white border border-slate-200 dark:border-slate-700 focus:border-indigo-500 transition-colors" 
                                    placeholder="What are you becoming?" 
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">Emotional Anchor</label>
                                <textarea 
                                    value={whyStatement} 
                                    onChange={e => setWhyStatement(e.target.value)} 
                                    className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 text-sm font-normal italic outline-none dark:text-white h-20 resize-none border border-slate-200 dark:border-slate-700 focus:border-indigo-500 transition-colors" 
                                    placeholder="The narrative why..." 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">Essence</label>
                                    <select 
                                        value={category}
                                        onChange={e => setCategory(e.target.value as GoalCategory)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-3 text-xs font-medium dark:text-white outline-none border border-slate-200 dark:border-slate-700"
                                    >
                                        {Object.values(GoalCategory).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider ml-1">Horizon</label>
                                    <input 
                                        type="date"
                                        value={deadline}
                                        onChange={e => setDeadline(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 text-xs font-medium dark:text-white outline-none border border-slate-200 dark:border-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">Stepstones</label>
                                    <button 
                                        type="button" 
                                        onClick={handleGenerate} 
                                        disabled={generating || !title} 
                                        className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${themeClasses.text} hover:opacity-70 transition-all disabled:opacity-30`}
                                    >
                                        {generating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} AI Strategy
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <input 
                                        value={manualMilestone}
                                        onChange={e => setManualMilestone(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 text-xs font-normal outline-none dark:text-white border border-slate-200 dark:border-slate-700"
                                        placeholder="Add a step..."
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualMilestone())}
                                    />
                                    <button 
                                        type="button"
                                        onClick={addManualMilestone}
                                        className={`w-11 h-11 rounded-xl ${themeClasses.secondary} ${themeClasses.text} flex items-center justify-center active:scale-[0.9] transition-all shrink-0 border ${themeClasses.border} shadow-sm`}
                                    >
                                        <ListPlus size={18} />
                                    </button>
                                </div>

                                <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                                    {milestones.map((m, i) => (
                                        <div key={i} className="group p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800/40 flex justify-between items-center animate-in slide-in-from-left-2">
                                            <span className="flex-1 truncate pr-4">{m}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => setMilestones(prev => prev.filter((_, idx) => idx !== i))}
                                                className="p-1 text-rose-300 hover:text-rose-500 transition-all"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={!title} 
                                className={`w-full py-3.5 rounded-2xl font-semibold text-xs uppercase tracking-wider text-white transition-all active:scale-[0.98] bg-gradient-to-br ${themeClasses.gradient} disabled:opacity-50 mt-2`}
                            >
                                {editingGoalId ? 'Update Path' : 'Plant Seed'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
