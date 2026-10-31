import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Goal, GoalCategory, GoalOutcome } from '../types';
import { 
    Target, Trophy, Plus, ChevronDown, Check, Sparkles, Loader2, X, 
    Trash2, Calendar, Pencil, Zap, BookOpen, 
    Activity, PauseCircle, PlayCircle, Archive, RotateCcw,
    Leaf, Sun, Wind, Snowflake, Quote, Clock, Heart,
    AlertCircle, Briefcase, Smile, Users, CheckCircle2, ArrowRight, ArrowLeft
} from 'lucide-react';
import { generateMilestonesForGoal } from '../services/geminiService';
import { toLocalDateString, parseLocalDate } from '../services/date';

interface GoalsProps {
    setView: (view: string) => void;
}

const CATEGORY_META: Record<GoalCategory, { label: string; icon: any; desc: string }> = {
    [GoalCategory.Health]: { label: 'Health', icon: Heart, desc: 'Body, energy & vitality' },
    [GoalCategory.Career]: { label: 'Career', icon: Briefcase, desc: 'Work, craft & impact' },
    [GoalCategory.Personal]: { label: 'Personal', icon: Smile, desc: 'Mindset & daily peace' },
    [GoalCategory.Financial]: { label: 'Financial', icon: Trophy, desc: 'Wealth & discipline' },
    [GoalCategory.Learning]: { label: 'Learning', icon: BookOpen, desc: 'Knowledge & skills' },
    [GoalCategory.Relationships]: { label: 'Relationships', icon: Users, desc: 'Connection & empathy' },
    [GoalCategory.Creativity]: { label: 'Creativity', icon: Sparkles, desc: 'Art, voice & expression' }
};

export const Goals: React.FC<GoalsProps> = ({ setView }) => {
    const { 
        goals, habits, journalEntries, addGoal, updateGoal, deleteGoal, 
        addHabit, updateHabit, toggleHabitCompletion, setPreselectedGoalId, 
        themeClasses, language, triggerNotification, securitySettings 
    } = useApp();
    
    const [activeTab, setActiveTab] = useState<'active' | 'needs' | 'hall'>('active');
    const [showModal, setShowModal] = useState(false);
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);

    // Form State
    const [title, setTitle] = useState('');
    const [whyStatement, setWhyStatement] = useState('');
    const [category, setCategory] = useState<GoalCategory>(GoalCategory.Personal);
    const [deadline, setDeadline] = useState('');
    const [milestones, setMilestones] = useState<string[]>([]);
    const [manualMilestone, setManualMilestone] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Archiving Flow State
    const [showArchiveFlow, setShowArchiveFlow] = useState<string | null>(null);
    const [archiveOutcome, setArchiveOutcome] = useState<GoalOutcome>('Integrated');
    const [archiveStayed, setArchiveStayed] = useState('');
    const [archiveShifted, setArchiveShifted] = useState('');
    const [archiveImpact, setArchiveImpact] = useState('');
    
    // Confirmation State for deletion
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    const today = toLocalDateString();
    
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

    const activeGoals = goals.filter(g => !g.completed && !g.isPaused);
    const pausedGoals = goals.filter(g => g.isPaused && !g.completed);
    const completedGoals = goals.filter(g => g.completed);

    const filtered = activeTab === 'active' 
        ? activeGoals 
        : activeTab === 'needs' 
        ? pausedGoals 
        : completedGoals;

    // Validation helpers
    const canContinueStep1 = title.trim() !== '';
    const isDateValid = deadline === '' || deadline >= today;

    const handleSaveGoal = (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting || !title.trim()) return;
        setSubmitting(true);
        
        try {
            const milestoneTitles = milestones; 

            if (editingGoalId) {
                updateGoal(editingGoalId, {
                    title: title.trim(),
                    whyStatement: whyStatement.trim(),
                    category,
                    deadline: deadline || undefined,
                    milestones: milestoneTitles.map((m, idx) => {
                        const existing = goals.find(g => g.id === editingGoalId)?.milestones?.[idx];
                        return existing ? { ...existing, title: m } : { id: Math.random().toString(36).substr(2, 9), title: m, completed: false };
                    })
                });

                // Sync linked habits
                habits.forEach(h => {
                    const shouldBeLinked = selectedHabitIds.includes(h.id);
                    if (shouldBeLinked && h.linkedGoalId !== editingGoalId) {
                        updateHabit(h.id, { linkedGoalId: editingGoalId });
                    } else if (!shouldBeLinked && h.linkedGoalId === editingGoalId) {
                        updateHabit(h.id, { linkedGoalId: undefined });
                    }
                });

                triggerNotification('Goal Updated ✨', `"${title.trim()}" has been updated.`, 'achievement');
            } else {
                const newGoalId = Date.now().toString();
                addGoal({
                    id: newGoalId,
                    title: title.trim(), 
                    whyStatement: whyStatement.trim(),
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

                // Link selected habits
                selectedHabitIds.forEach(hid => {
                    updateHabit(hid, { linkedGoalId: newGoalId });
                });

                triggerNotification('Goal Created ✨', `"${title.trim()}" has been added.`, 'achievement');
            }
            resetForm();
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (goal: Goal) => {
        setEditingGoalId(goal.id);
        setTitle(goal.title);
        setWhyStatement(goal.whyStatement || '');
        setCategory(goal.category);
        setDeadline(goal.deadline || '');
        setMilestones(goal.milestones.map(m => m.title));
        setSelectedHabitIds(habits.filter(h => h.linkedGoalId === goal.id).map(h => h.id));
        setStep(1);
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
        setSelectedHabitIds([]);
        setSubmitting(false);
        setStep(1);
    };

    const handleGenerate = async () => {
        if (!title.trim() || securitySettings?.aiDisabled) return;
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
        
        if (completions > 5) return { label: 'High momentum', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' };
        if (completions > 2) return { label: 'Steady momentum', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' };
        if (completions > 0) return { label: 'Starting to build', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' };
        return { label: 'Awaiting routine', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/60' };
    };

    const getSeasonMarker = (dateStr?: string) => {
        if (!dateStr) return { label: 'Spring', icon: <Leaf size={12} />, color: 'text-emerald-500' };
        const month = new Date(dateStr).getMonth();
        if (month >= 2 && month <= 4) return { label: 'Spring', icon: <Leaf size={12} />, color: 'text-emerald-500' };
        if (month >= 5 && month <= 7) return { label: 'Summer', icon: <Sun size={12} />, color: 'text-amber-500' };
        if (month >= 8 && month <= 10) return { label: 'Autumn', icon: <Wind size={12} />, color: 'text-orange-500' };
        return { label: 'Winter', icon: <Snowflake size={12} />, color: 'text-blue-500' };
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

    const extractRitualFromGoal = (goal: Goal, e: React.MouseEvent) => {
        e.stopPropagation();
        addHabit({
            id: Date.now().toString(),
            title: `Habit: ${goal.title}`,
            category: goal.category,
            timeOfDay: 'Anytime',
            streak: 0,
            completedDates: [],
            linkedGoalId: goal.id
        });
        triggerNotification('Habit Created', 'New habit created from your goal.', 'achievement');
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
            setTimeout(() => setConfirmingDeleteId(prev => prev === id ? null : prev), 3500);
        }
    };

    return (
        <div className="pb-32 space-y-4 animate-in fade-in">
            {/* HEADER */}
            <div className="flex justify-between items-center px-1 pt-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Goals & Milestones</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track your intentions and break them into steady progress</p>
                </div>
                <button 
                    type="button"
                    onClick={() => {
                        resetForm();
                        setShowModal(true);
                    }} 
                    className={`bg-gradient-to-br ${themeClasses.gradient} text-white px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs font-semibold`}
                >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>New Goal</span>
                </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex shadow-xs">
                {(['active', 'needs', 'hall'] as const).map(tab => {
                    const count = tab === 'active' ? activeGoals.length : tab === 'needs' ? pausedGoals.length : completedGoals.length;
                    const isCurrent = activeTab === tab;
                    return (
                        <button 
                            key={tab} 
                            type="button"
                            onClick={() => setActiveTab(tab)} 
                            className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                isCurrent 
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                        >
                            {tab === 'active' && <Target size={14} className={isCurrent ? themeClasses.text : ''} />}
                            {tab === 'needs' && <PauseCircle size={14} />}
                            {tab === 'hall' && <Trophy size={14} />}
                            <span>
                                {tab === 'active' ? 'In Progress' : tab === 'needs' ? 'Paused' : 'Completed'}
                            </span>
                            <span className="text-[11px] opacity-60 tabular-nums">({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* LIST OF GOALS */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center px-6 animate-in fade-in duration-300">
                        {activeTab === 'hall' ? (
                            <div className="space-y-3 max-w-xs mx-auto">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800/70 rounded-2xl w-fit mx-auto text-slate-400">
                                    <Trophy size={28} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Completed Goals Yet</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        When you achieve a goal or archive it with reflection, it will be preserved here as part of your journey.
                                    </p>
                                </div>
                            </div>
                        ) : activeTab === 'needs' ? (
                            <div className="space-y-3 max-w-xs mx-auto">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800/70 rounded-2xl w-fit mx-auto text-slate-400">
                                    <PauseCircle size={28} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Paused Goals</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Any goals you temporarily put on hold will appear here so you can resume them whenever you are ready.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-sm mx-auto">
                                <div className={`p-4 rounded-2xl w-fit mx-auto ${themeClasses.secondary} ${themeClasses.text}`}>
                                    <Target size={32} />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Set Your First Intention</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Define clear, meaningful targets, break them into tangible milestones, and attach daily habits to stay consistent.
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            resetForm();
                                            setShowModal(true);
                                        }}
                                        className={`px-5 py-2.5 rounded-xl ${themeClasses.primary} text-white text-xs font-semibold shadow-sm active:scale-95 transition-all inline-flex items-center gap-1.5`}
                                    >
                                        <Plus size={15} />
                                        <span>Create a Goal</span>
                                    </button>
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
                        const isExpanded = expandedGoalId === goal.id;

                        // COMPLETED GOALS CARD VIEW
                        if (goal.completed) {
                            return (
                                <div 
                                    key={goal.id} 
                                    className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden ${
                                        isExpanded ? 'border-slate-300 dark:border-slate-700 shadow-md' : 'border-slate-200/80 dark:border-slate-800 shadow-xs'
                                    }`}
                                >
                                    <div 
                                        onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                                        className="p-4 flex flex-col cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className={`w-9 h-9 rounded-xl ${themeClasses.secondary} ${themeClasses.text} flex items-center justify-center shrink-0 border ${themeClasses.border} mt-0.5`}>
                                                    <Trophy size={18} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-snug break-words">
                                                        {goal.title}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                        <span>{goal.category}</span>
                                                        <span aria-hidden="true">·</span>
                                                        <span className={`flex items-center gap-1 ${season.color}`}>
                                                            {season.icon} {season.label}
                                                        </span>
                                                        {goal.archivedAt && (
                                                            <>
                                                                <span aria-hidden="true">·</span>
                                                                <span>Completed {formatDate(goal.archivedAt)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                                                {goal.outcomeLabel || 'Completed'}
                                            </span>
                                        </div>

                                        {(goal.whatStayed || goal.whatShifted) && (
                                            <div className="mt-3 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                {goal.whatStayed && (
                                                    <div className="space-y-0.5">
                                                        <span className="text-[11px] font-medium text-slate-400">What Stayed</span>
                                                        <p className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2 leading-relaxed">
                                                            "{goal.whatStayed}"
                                                        </p>
                                                    </div>
                                                )}
                                                {goal.whatShifted && (
                                                    <div className="space-y-0.5">
                                                        <span className="text-[11px] font-medium text-slate-400">What Shifted</span>
                                                        <p className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2 leading-relaxed">
                                                            "{goal.whatShifted}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-3 duration-200 space-y-4 border-t border-slate-100 dark:border-slate-800">
                                            {goal.identityImpact ? (
                                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        <Quote size={13} className={themeClasses.text} />
                                                        <span>Personal Reflection</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                                        "{goal.identityImpact}"
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                                    <textarea 
                                                        className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed resize-none border-none outline-none"
                                                        value={goal.identityImpact || ""}
                                                        placeholder="Add an optional reflection: How did achieving this goal shape you?"
                                                        onChange={(e) => updateGoal(goal.id, { identityImpact: e.target.value })}
                                                        rows={2}
                                                    />
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => revisitGoal(goal, e)} 
                                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all text-xs font-medium border border-slate-200/60 dark:border-slate-700/60"
                                                >
                                                    <RotateCcw size={13} />
                                                    <span>Revisit</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => extractRitualFromGoal(goal, e)} 
                                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl transition-all text-xs font-medium border border-slate-200/60 dark:border-slate-700/60"
                                                >
                                                    <Zap size={13} />
                                                    <span>Create Habit</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => onReflectAction(goal.id, e)} 
                                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all text-xs font-medium border border-slate-200/60 dark:border-slate-700/60"
                                                >
                                                    <BookOpen size={13} />
                                                    <span>Reflect</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => { e.stopPropagation(); setExpandedGoalId(null); }} 
                                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-all text-xs font-medium border border-slate-200/60 dark:border-slate-700/60"
                                                >
                                                    <span>Close</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // ACTIVE & PAUSED GOALS CARD VIEW
                        return (
                            <div 
                                key={goal.id} 
                                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden ${
                                    isExpanded ? 'border-slate-300 dark:border-slate-700 shadow-md' : 'border-slate-200/80 dark:border-slate-800 shadow-xs'
                                }`}
                            >
                                <div 
                                    onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)} 
                                    className="p-4 cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${themeClasses.secondary} ${themeClasses.text} border ${themeClasses.border} mt-0.5`}>
                                                <Target size={18} strokeWidth={2.2} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-snug break-words">
                                                    {goal.title}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    <span>{goal.category}</span>
                                                    {goal.deadline && (
                                                        <>
                                                            <span aria-hidden="true">·</span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock size={11} /> {formatDate(goal.deadline)}
                                                            </span>
                                                        </>
                                                    )}
                                                    <span aria-hidden="true">·</span>
                                                    <span className="tabular-nums">
                                                        {goal.milestones.length > 0 ? `${doneCount}/${goal.milestones.length} milestones` : 'No steps yet'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                            <div className="text-right">
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                                    {goal.progress || 0}%
                                                </span>
                                                <span className="block text-[10px] text-slate-400 font-medium">
                                                    {growthStage}
                                                </span>
                                            </div>
                                            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* PROGRESS BAR */}
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${themeClasses.gradient}`} 
                                            style={{ width: `${Math.min(100, Math.max(0, goal.progress || 0))}%` }}
                                        />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-5 pt-1 animate-in slide-in-from-top-3 duration-200 space-y-4 border-t border-slate-100 dark:border-slate-800">
                                        {/* WHY STATEMENT */}
                                        {goal.whyStatement && (
                                            <div className="space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                    Why This Matters
                                                </span>
                                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic">
                                                    "{goal.whyStatement}"
                                                </p>
                                            </div>
                                        )}

                                        {/* CONSISTENCY & PROGRESS STAGE */}
                                        <div className={`p-3.5 rounded-xl ${momentum.bg} border border-transparent flex items-center justify-between`}>
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Habit Momentum
                                                </span>
                                                <p className={`text-xs font-bold ${momentum.color}`}>{momentum.label}</p>
                                            </div>
                                            <div className="text-right space-y-0.5">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Growth Stage
                                                </span>
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    {growthStage} <span className="text-slate-400 font-normal">({goal.progress}%)</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* MILESTONES SECTION */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-0.5">
                                                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    Milestones
                                                </h4>
                                                <span className="text-xs text-slate-400 tabular-nums">
                                                    {doneCount} of {goal.milestones.length} completed
                                                </span>
                                            </div>
                                            
                                            {goal.milestones.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {goal.milestones.map(m => (
                                                        <div 
                                                            key={m.id} 
                                                            onClick={() => toggleMilestone(goal.id, m.id)}
                                                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.99] transition-all cursor-pointer"
                                                        >
                                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                                                m.completed 
                                                                    ? 'bg-emerald-500 border-transparent text-white' 
                                                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                                                            }`}>
                                                                {m.completed && <Check size={11} strokeWidth={3} />}
                                                            </div>
                                                            <span className={`text-xs sm:text-sm font-medium leading-relaxed flex-1 break-words ${
                                                                m.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                                                            }`}>
                                                                {m.title}
                                                            </span>
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => deleteMilestoneFromGoal(goal.id, m.id, e)}
                                                                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                                                                title="Remove milestone"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                                    <p className="text-xs text-slate-400">No milestones yet. Break this goal into achievable steps.</p>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleEditClick(goal)}
                                                        className="mt-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                                                    >
                                                        + Add Milestones
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* LINKED HABITS */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-0.5">
                                                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    Linked Habits ({linkedRituals.length})
                                                </h4>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => { e.stopPropagation(); setView('dashboard'); }} 
                                                    className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
                                                >
                                                    + Add Habit
                                                </button>
                                            </div>

                                            {linkedRituals.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {linkedRituals.map(h => {
                                                        const isDone = h.completedDates.includes(today);
                                                        return (
                                                            <div 
                                                                key={h.id} 
                                                                className={`p-3 rounded-xl border transition-all ${
                                                                    isDone 
                                                                        ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/40 opacity-75' 
                                                                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                                            isDone ? 'bg-slate-100 dark:bg-slate-700 text-slate-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-500'
                                                                        }`}>
                                                                            <Zap size={14} fill={isDone ? 'none' : 'currentColor'} />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <h5 className={`text-xs font-semibold truncate ${
                                                                                isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'
                                                                            }`}>
                                                                                {h.title}
                                                                            </h5>
                                                                            <span className="text-[10px] text-slate-400 tabular-nums">
                                                                                {h.completedDates.length} completions
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={(e) => { e.stopPropagation(); toggleHabitCompletion(h.id, today); }}
                                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                                                            isDone ? `${themeClasses.primary} text-white` : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600'
                                                                        }`}
                                                                    >
                                                                        <Check size={12} strokeWidth={3} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">No habits linked to this goal yet</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setView('dashboard')} 
                                                        className="font-semibold text-indigo-500 hover:text-indigo-600"
                                                    >
                                                        Link a Habit
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* RECENT REFLECTIONS */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-0.5">
                                                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    Recent Reflections
                                                </h4>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => onReflectAction(goal.id, e)} 
                                                    className="text-xs text-indigo-500 hover:text-indigo-600 font-medium"
                                                >
                                                    + Write Entry
                                                </button>
                                            </div>

                                            {recentReflections.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {recentReflections.map(e => (
                                                        <div key={e.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 italic leading-relaxed">
                                                                "{e.content}"
                                                            </p>
                                                            <span className="text-[10px] text-slate-400 block tabular-nums">
                                                                {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">No reflections logged for this goal yet</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => onReflectAction(goal.id, e)} 
                                                        className="font-semibold text-indigo-500 hover:text-indigo-600"
                                                    >
                                                        Log Reflection
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* ACTION BUTTONS */}
                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); handleEditClick(goal); }} 
                                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-xl transition-all text-xs font-medium border border-slate-200/60 dark:border-slate-700/60"
                                            >
                                                <Pencil size={13} />
                                                <span>Edit</span>
                                            </button>
                                            
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); updateGoal(goal.id, { isPaused: !goal.isPaused }); }} 
                                                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl transition-all text-xs font-medium border ${
                                                    goal.isPaused 
                                                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30' 
                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 border-slate-200/60 dark:border-slate-700/60'
                                                }`}
                                            >
                                                {goal.isPaused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                                                <span>{goal.isPaused ? 'Resume' : 'Pause'}</span>
                                            </button>
                                            
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); setShowArchiveFlow(goal.id); }} 
                                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all text-xs font-medium border border-slate-200/60 dark:border-slate-700/60"
                                            >
                                                <Archive size={13} />
                                                <span>Archive</span>
                                            </button>
                                            
                                            <button 
                                                type="button" 
                                                onClick={(e) => handleDeleteGoalRequest(goal.id, e)} 
                                                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border transition-all text-xs font-medium ${
                                                    confirmingDeleteId === goal.id 
                                                        ? 'bg-rose-500 text-white border-transparent shadow-sm' 
                                                        : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:text-rose-700 border-rose-100 dark:border-rose-900/20'
                                                }`}
                                            >
                                                {confirmingDeleteId === goal.id ? <AlertCircle size={13} /> : <Trash2 size={13} />}
                                                <span>{confirmingDeleteId === goal.id ? 'Confirm?' : 'Delete'}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ARCHIVE GOAL MODAL */}
            {showArchiveFlow && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowArchiveFlow(null)} />
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95">
                        <button 
                            type="button" 
                            onClick={() => setShowArchiveFlow(null)} 
                            className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            <X size={18}/>
                        </button>
                        
                        <div className="text-center mb-5">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Archive Goal</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Preserve what was learned and what was completed.</p>
                        </div>
                        
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pb-1">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Outcome</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['Integrated', 'Evolved', 'Completed', 'Paused', 'Redirected'] as GoalOutcome[]).map(outcome => (
                                        <button 
                                            key={outcome}
                                            type="button"
                                            onClick={() => setArchiveOutcome(outcome)}
                                            className={`px-3 py-2.5 rounded-2xl text-xs font-medium border transition-all ${
                                                archiveOutcome === outcome 
                                                    ? `${themeClasses.primary} text-white border-transparent shadow-xs` 
                                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:border-slate-300'
                                            }`}
                                        >
                                            {outcome}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Personal Impact</label>
                                    <textarea 
                                        value={archiveImpact}
                                        onChange={e => setArchiveImpact(e.target.value)}
                                        placeholder="How did pursuing this goal help you grow?"
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 text-sm font-normal border border-slate-200 dark:border-slate-700 outline-none h-20 resize-none text-slate-800 dark:text-slate-200 focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">What Stayed?</label>
                                    <textarea 
                                        value={archiveStayed}
                                        onChange={e => setArchiveStayed(e.target.value)}
                                        placeholder="Which habits or practices took root?"
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 text-sm font-normal border border-slate-200 dark:border-slate-700 outline-none h-16 resize-none text-slate-800 dark:text-slate-200 focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">What Shifted?</label>
                                    <textarea 
                                        value={archiveShifted}
                                        onChange={e => setArchiveShifted(e.target.value)}
                                        placeholder="How did your perspective or priorities change?"
                                        className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 text-sm font-normal border border-slate-200 dark:border-slate-700 outline-none h-16 resize-none text-slate-800 dark:text-slate-200 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <button 
                                type="button" 
                                onClick={finalizeArchive} 
                                className={`w-full py-3.5 rounded-2xl font-semibold text-xs text-white shadow-sm bg-gradient-to-br ${themeClasses.gradient} mt-2 active:scale-98 transition-all`}
                            >
                                Save to Completed Goals
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP-BY-STEP GOAL CREATION & EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={resetForm} />
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* MODAL HEADER */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    {editingGoalId ? 'Edit Goal' : 'New Goal'}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Define what you want to achieve and set milestones.
                                </p>
                            </div>
                            <button 
                                type="button" 
                                onClick={resetForm} 
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors shrink-0"
                            >
                                <X size={16}/>
                            </button>
                        </div>

                        {/* STEP PROGRESS PILL BAR (matching Habit Wizard) */}
                        <div className="grid grid-cols-4 gap-2 pt-3 pb-2">
                            {[
                                { stepNum: 1, label: 'Intent' },
                                { stepNum: 2, label: 'Pillar' },
                                { stepNum: 3, label: 'Steps' },
                                { stepNum: 4, label: 'Habits' }
                            ].map(item => {
                                const isCurrent = step === item.stepNum;
                                const isPassed = step > item.stepNum;
                                const canNav = item.stepNum === 1 || title.trim().length > 0 || editingGoalId;
                                return (
                                    <button
                                        key={item.stepNum}
                                        type="button"
                                        disabled={!canNav}
                                        onClick={() => {
                                            if (canNav) setStep(item.stepNum);
                                        }}
                                        className="flex flex-col gap-1 text-left group transition-all disabled:opacity-40"
                                    >
                                        <div className={`h-1.5 rounded-full transition-all ${
                                            isCurrent 
                                                ? `${themeClasses.primary} shadow-xs` 
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

                        {/* STEP CONTENT FORM */}
                        <form onSubmit={handleSaveGoal} className="flex flex-col flex-1 overflow-hidden pt-2">
                            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 pb-2 space-y-4">
                                
                                {/* STEP 1: INTENT & WHY */}
                                {step === 1 && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                <span>Goal Title <span className="text-rose-500">*</span></span>
                                                <span className="font-normal text-slate-400 text-[11px]">Clear target</span>
                                            </label>
                                            <input 
                                                required 
                                                value={title} 
                                                onChange={e => setTitle(e.target.value)} 
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && title.trim()) {
                                                        e.preventDefault();
                                                        setStep(2);
                                                    }
                                                }}
                                                className="w-full bg-slate-50 dark:bg-slate-800/80 rounded-2xl px-4 py-3 text-sm font-normal outline-none text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400" 
                                                placeholder="e.g. Run a 10K, Read 12 books, Learn Spanish" 
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                <span>Why This Matters</span>
                                                <span className="font-normal text-slate-400 text-[11px]">Core motivation</span>
                                            </label>
                                            <textarea 
                                                value={whyStatement} 
                                                onChange={e => setWhyStatement(e.target.value)} 
                                                className="w-full bg-slate-50 dark:bg-slate-800/80 rounded-2xl px-4 py-3 text-sm font-normal outline-none text-slate-900 dark:text-white h-24 resize-none border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400" 
                                                placeholder="What will achieving this bring to your life? What will change?" 
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: LIFE PILLAR & TARGET DATE */}
                                {step === 2 && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Life Pillar
                                            </label>
                                            <p className="text-xs text-slate-400">
                                                Choose which area of your life this goal elevates.
                                            </p>

                                            {/* Visual category cards matching Dashboard */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-56 overflow-y-auto no-scrollbar pr-0.5">
                                                {Object.values(GoalCategory).map(cat => {
                                                    const meta = CATEGORY_META[cat] || { label: cat, icon: Target, desc: 'Growth pillar' };
                                                    const Icon = meta.icon;
                                                    const isSelected = category === cat;
                                                    return (
                                                        <button
                                                            key={cat}
                                                            type="button"
                                                            onClick={() => setCategory(cat)}
                                                            className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                                                                isSelected
                                                                    ? 'bg-slate-50 dark:bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                                                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                            }`}
                                                        >
                                                            <div className={`p-2 rounded-xl shrink-0 ${isSelected ? `${themeClasses.secondary} ${themeClasses.text}` : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                                <Icon size={16} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                                                        {meta.label}
                                                                    </span>
                                                                    {isSelected && (
                                                                        <CheckCircle2 size={14} className="text-indigo-500 shrink-0" />
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
                                                                    {meta.desc}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 pt-1">
                                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                <span>Target Date (optional)</span>
                                                <span className="font-normal text-slate-400 text-[11px]">Aiming for</span>
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="date"
                                                    value={deadline}
                                                    onChange={e => setDeadline(e.target.value)}
                                                    className={`w-full bg-slate-50 dark:bg-slate-800/80 rounded-2xl px-4 py-3 text-sm font-normal text-slate-800 dark:text-white outline-none border ${
                                                        isDateValid ? 'border-slate-200 dark:border-slate-700' : 'border-rose-500'
                                                    } focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                                                />
                                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                            </div>
                                            {/* Quick Date Presets */}
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                {[
                                                    { label: '+30 Days', days: 30 },
                                                    { label: '+90 Days', days: 90 },
                                                    { label: '+6 Months', days: 180 },
                                                ].map(preset => (
                                                    <button
                                                        key={preset.label}
                                                        type="button"
                                                        onClick={() => {
                                                            const target = new Date();
                                                            target.setDate(target.getDate() + preset.days);
                                                            setDeadline(target.toISOString().split('T')[0]);
                                                        }}
                                                        className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const now = new Date();
                                                        const eoy = new Date(now.getFullYear(), 11, 31);
                                                        setDeadline(eoy.toISOString().split('T')[0]);
                                                    }}
                                                    className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    End of Year
                                                </button>
                                                {deadline && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeadline('')}
                                                        className="px-2.5 py-1 rounded-xl text-[11px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            {!isDateValid && <p className="text-[11px] text-rose-500">Target date cannot be in the past.</p>}
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: MILESTONES */}
                                {step === 3 && (
                                    <div className="space-y-3.5 animate-in fade-in duration-200">
                                        <div className="flex justify-between items-center px-0.5">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    Actionable Milestones
                                                </label>
                                                <p className="text-xs text-slate-400">
                                                    Break this goal down into tangible checkpoints.
                                                </p>
                                            </div>
                                            {!securitySettings?.aiDisabled && (
                                                <button 
                                                    type="button" 
                                                    onClick={handleGenerate} 
                                                    disabled={generating || !title} 
                                                    className={`text-xs font-semibold flex items-center gap-1.5 ${themeClasses.text} hover:opacity-80 transition-all disabled:opacity-30`}
                                                >
                                                    {generating ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}
                                                    <span>AI Milestones</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <input 
                                                value={manualMilestone}
                                                onChange={e => setManualMilestone(e.target.value)}
                                                className="flex-1 bg-slate-50 dark:bg-slate-800/80 rounded-2xl px-4 py-2.5 text-sm font-normal outline-none text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                                                placeholder="Add a milestone step..."
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addManualMilestone();
                                                    }
                                                }}
                                            />
                                            <button 
                                                type="button" 
                                                onClick={addManualMilestone}
                                                className={`w-11 h-11 rounded-2xl ${themeClasses.secondary} ${themeClasses.text} flex items-center justify-center active:scale-95 transition-all shrink-0 border ${themeClasses.border} shadow-xs`}
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>

                                        <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pt-1">
                                            {milestones.length > 0 ? (
                                                milestones.map((m, i) => (
                                                    <div key={i} className="group p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center animate-in slide-in-from-left-2 duration-150">
                                                        <span className="flex-1 break-words pr-3 leading-snug">{m}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setMilestones(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                                    <p className="text-xs text-slate-400">No milestones added yet. Add a few steps or use AI Milestones.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* STEP 4: HABIT ALIGNMENT & SUMMARY PREVIEW */}
                                {step === 4 && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Connect Supporting Habits
                                            </h4>
                                            <p className="text-xs text-slate-400">
                                                Link habits that build daily momentum toward this goal.
                                            </p>
                                        </div>

                                        {habits.length > 0 ? (
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar pr-0.5">
                                                {habits.map(h => {
                                                    const isChecked = selectedHabitIds.includes(h.id);
                                                    return (
                                                        <button
                                                            key={h.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedHabitIds(prev => 
                                                                    isChecked ? prev.filter(id => id !== h.id) : [...prev, h.id]
                                                                );
                                                            }}
                                                            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                                                isChecked 
                                                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600' 
                                                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Zap size={14} className={isChecked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                                                                        {h.title}
                                                                    </p>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {h.category} · {h.timeOfDay}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                                                isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
                                                            }`}>
                                                                {isChecked && <Check size={11} strokeWidth={3} />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                                <p className="text-xs text-slate-400">No habits created yet. You can link habits anytime from the Dashboard.</p>
                                            </div>
                                        )}

                                        {/* GOAL BLUEPRINT SUMMARY */}
                                        <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                    <Target size={12} className={themeClasses.text} /> Goal Blueprint
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                    {category}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-white leading-snug">
                                                {title || 'Untitled Goal'}
                                            </p>
                                            {whyStatement && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-2">
                                                    "{whyStatement}"
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                                <span>{milestones.length} milestones</span>
                                                <span aria-hidden="true">·</span>
                                                <span>{selectedHabitIds.length} linked habits</span>
                                                {deadline && (
                                                    <>
                                                        <span aria-hidden="true">·</span>
                                                        <span>Due {formatDate(deadline)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* WIZARD FOOTER NAVIGATION */}
                            <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                                {step > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => setStep(prev => prev - 1)}
                                        className="py-3 px-4 rounded-2xl font-semibold text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-98 flex items-center justify-center gap-1"
                                    >
                                        <ArrowLeft size={14} />
                                        <span>Back</span>
                                    </button>
                                )}
                                
                                {step < 4 ? (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            if (step === 1 && !canContinueStep1) return;
                                            if (step === 2 && !isDateValid) return;
                                            setStep(prev => prev + 1);
                                        }}
                                        className={`flex-1 py-3.5 rounded-2xl font-semibold text-xs text-white transition-all bg-gradient-to-br ${themeClasses.gradient} ${
                                            step === 1 && !canContinueStep1 ? 'opacity-50 cursor-not-allowed' : ''
                                        } active:scale-98 flex items-center justify-center gap-1`}
                                    >
                                        <span>Continue</span>
                                        <ArrowRight size={14} />
                                    </button>
                                ) : (
                                    <button 
                                        type="submit" 
                                        disabled={!title.trim() || submitting} 
                                        className={`flex-1 py-3.5 rounded-2xl font-semibold text-xs text-white transition-all bg-gradient-to-br ${themeClasses.gradient} disabled:opacity-50 active:scale-98 flex items-center justify-center gap-2`}
                                    >
                                        {submitting && <Loader2 size={14} className="animate-spin" />}
                                        <span>{editingGoalId ? 'Update Goal' : 'Save Goal'}</span>
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
