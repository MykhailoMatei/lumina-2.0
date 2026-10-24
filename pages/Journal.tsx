import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
    PenLine, X, Send, Sparkles, Search, Trash2, 
    ImageIcon, Loader2, Target, Calendar, Camera, Pencil,
    Sun, Moon, Clock, Sunset, BookOpen, Zap, CloudRain,
    Circle, Wind, ChevronDown, ChevronUp, ArrowRight, ArrowLeft,
    Tag, Heart, Briefcase, Smile, Users, Palette, Check, HelpCircle,
    CheckCircle2, Coffee, Trophy, FileText, Utensils, Flame
} from 'lucide-react';
import { generateEntryInsight } from '../services/geminiService';
import { uploadImage } from '../services/storageService';
import { JournalEntry } from '../types';

// Minimalist Mood Glyphs
const MoodGlyph: React.FC<{ type: string; active: boolean; color: string; size?: number }> = ({ 
    type, 
    active, 
    color, 
    size = 20 
}) => {
    const strokeWidth = active ? 2.5 : 1.8;
    const commonClasses = `transition-all duration-300 ${active ? color : 'text-slate-300 dark:text-slate-600'}`;

    switch (type) {
        case 'Great':
            return <Sparkles size={size} strokeWidth={strokeWidth} className={commonClasses} />;
        case 'Good':
            return <Sun size={size} strokeWidth={strokeWidth} className={commonClasses} />;
        case 'Neutral':
            return <Circle size={size} strokeWidth={strokeWidth} className={commonClasses} />;
        case 'Bad':
            return <Wind size={size} strokeWidth={strokeWidth} className={commonClasses} />;
        case 'Awful':
            return <CloudRain size={size} strokeWidth={strokeWidth} className={commonClasses} />;
        default:
            return <Circle size={size} strokeWidth={strokeWidth} className={commonClasses} />;
    }
};

const downscaleImage = (file: File, maxSize = 1024, quality = 0.8): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });

const MOODS = [
    { key: 'Great', label: 'Radiant', color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', desc: 'Inspired, high energy & fulfillment' },
    { key: 'Good', label: 'Steady', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', desc: 'Calm progress, pleasant & centered' },
    { key: 'Neutral', label: 'Still', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30', desc: 'Observant, regular routine & quiet' },
    { key: 'Bad', label: 'Turbulent', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', desc: 'Friction, stress or low energy' },
    { key: 'Awful', label: 'Heavy', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30', desc: 'Fatigued, difficult day or setback' }
] as const;

const ENTRY_STYLES = [
    { 
        id: 'log', 
        label: 'Daily Log', 
        icon: FileText, 
        badge: 'Routine & meals',
        defaultCategory: 'Daily Life',
        placeholder: 'What did you do today? What did you eat, work on, or experience?',
        template: '• What I did:\n• Meals & Snacks:\n• How the day felt:' 
    },
    { 
        id: 'win', 
        label: 'Daily Win', 
        icon: Trophy, 
        badge: 'Small victory',
        defaultCategory: 'Self-Improvement',
        placeholder: 'What went right today? What is one win or milestone you executed well?'
    },
    { 
        id: 'memory', 
        label: 'Moment', 
        icon: Coffee, 
        badge: 'Pleasant memory',
        defaultCategory: 'Relationships',
        placeholder: 'A pleasant moment, coffee with a friend, delicious food, or something that made you smile.'
    },
    { 
        id: 'spark', 
        label: 'Thought', 
        icon: Sparkles, 
        badge: 'Idea & insight',
        defaultCategory: 'Mindfulness',
        placeholder: 'What realization or interesting idea crossed your mind today?'
    }
];

const JOURNAL_CATEGORIES = [
    { id: 'Daily Life', label: 'Daily Life', icon: Coffee, desc: 'Everyday routines, meals, events & simple notes' },
    { id: 'Self-Improvement', label: 'Self-Improvement', icon: Target, desc: 'Growth, habits & mental discipline' },
    { id: 'Health', label: 'Health', icon: Heart, desc: 'Body, workouts, energy & nutrition' },
    { id: 'Career', label: 'Career', icon: Briefcase, desc: 'Work, craft, projects & momentum' },
    { id: 'Mindfulness', label: 'Mindfulness', icon: Smile, desc: 'Presence, gratitude & peace of mind' },
    { id: 'Learning', label: 'Learning', icon: BookOpen, desc: 'Books, new skills & lessons learned' },
    { id: 'Relationships', label: 'Relationships', icon: Users, desc: 'Friends, family, gatherings & connections' },
    { id: 'Creativity', label: 'Creativity', icon: Palette, desc: 'Art, music, ideas & creative projects' },
];

const QUICK_TAG_ANCHORS = [
    'Delicious Meal 🍝',
    'Workout Done 💪',
    'Morning Routine ☀️',
    'Coffee & Focus ☕',
    'Friends / Hangout ✨',
    'Work Breakthrough 🚀',
    'Quiet Evening 🌙',
    'Rest & Reset 🛋️'
];

export const Journal: React.FC = () => {
    const { 
        journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, goals, habits, user,
        themeClasses, language, dailyBriefing, preselectedGoalId, setPreselectedGoalId, circadian,
        triggerNotification
    } = useApp();
    
    // Editor Wizard State
    const [showEditor, setShowEditor] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [wizardStep, setWizardStep] = useState<number>(1);
    
    // Form Inputs
    const [entryStyle, setEntryStyle] = useState<string>('log');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [mood, setMood] = useState<'Great' | 'Good' | 'Neutral' | 'Bad' | 'Awful'>('Good');
    const [category, setCategory] = useState<string>('Daily Life');
    const [linkedGoalId, setLinkedGoalId] = useState<string>('');
    const [linkedHabitId, setLinkedHabitId] = useState<string>('');
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [showCategoryTooltip, setShowCategoryTooltip] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    // Feed UI State
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
    const [search, setSearch] = useState('');
    const [expandedEntryIds, setExpandedEntryIds] = useState<Record<string, boolean>>({});
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (preselectedGoalId) {
            setLinkedGoalId(preselectedGoalId);
            setPreselectedGoalId(null);
            setCategory('Self-Improvement');
            setEntryStyle('win');
            setWizardStep(1);
            setShowEditor(true);
        }
    }, [preselectedGoalId, setPreselectedGoalId]);

    const phaseIcon = useMemo(() => {
        switch(circadian.state) {
            case 'Morning': return <Sun size={12} className="animate-pulse" />;
            case 'Day': return <Clock size={12} />;
            case 'Evening': return <Sunset size={12} />;
            default: return <Moon size={12} />;
        }
    }, [circadian.state]);

    // Sorting: Latest created reflections FIRST
    const sortedEntries = useMemo(() => {
        return [...journalEntries].sort((a, b) => {
            const timeA = new Date(a.date).getTime() || 0;
            const timeB = new Date(b.date).getTime() || 0;
            return timeB - timeA;
        });
    }, [journalEntries]);

    // Category counts for filter tabs
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: journalEntries.length };
        JOURNAL_CATEGORIES.forEach(c => {
            counts[c.id] = journalEntries.filter(e => (e.category || 'Daily Life') === c.id).length;
        });
        return counts;
    }, [journalEntries]);

    // Filtered by category and search
    const filteredEntries = useMemo(() => {
        return sortedEntries.filter(entry => {
            const entryCat = entry.category || 'Daily Life';
            const matchesCategory = selectedCategoryFilter === 'All' || entryCat === selectedCategoryFilter;
            const matchesSearch = !search.trim() || 
                (entry.title && entry.title.toLowerCase().includes(search.toLowerCase())) ||
                entry.content.toLowerCase().includes(search.toLowerCase()) ||
                (entry.category && entry.category.toLowerCase().includes(search.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [sortedEntries, selectedCategoryFilter, search]);

    const toggleExpandEntry = (id: string) => {
        setExpandedEntryIds(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleSelectEntryStyle = (styleId: string) => {
        setEntryStyle(styleId);
        const styleCfg = ENTRY_STYLES.find(s => s.id === styleId);
        if (styleCfg) {
            setCategory(styleCfg.defaultCategory);
        }
    };

    const handleApplyTemplate = () => {
        const currentStyle = ENTRY_STYLES.find(s => s.id === entryStyle);
        if (currentStyle?.template) {
            setContent(prev => (prev ? `${prev}\n\n${currentStyle.template}` : currentStyle.template || ''));
        }
    };

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntryId(entry.id);
        setTitle(entry.title || '');
        setContent(entry.content);
        setMood(entry.mood);
        setCategory(entry.category || 'Daily Life');
        setLinkedGoalId(entry.linkedGoalId || '');
        setLinkedHabitId(entry.linkedHabitId || '');
        setAttachedImage(entry.imageData || null);
        setWizardStep(1);
        setShowEditor(true);
    };

    const resetEditor = () => {
        setTitle('');
        setContent('');
        setMood('Good');
        setCategory('Daily Life');
        setEntryStyle('log');
        setLinkedGoalId('');
        setLinkedHabitId('');
        setAttachedImage(null);
        setEditingEntryId(null);
        setWizardStep(1);
        setShowCategoryTooltip(false);
        setShowEditor(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        downscaleImage(file).then(setAttachedImage).catch(console.error);
        e.target.value = '';
    };

    const handleSubmit = () => {
        if (!content.trim()) return;
        
        const targetId = editingEntryId || Date.now().toString();
        const generatedTitle = title.trim() || content.trim().split('\n')[0].slice(0, 48) || 'Daily Note';
        const rawContent = content.trim();
        const selectedMood = mood;
        const selectedCategory = category;
        const currentAttachedImage = attachedImage;
        const goalId = linkedGoalId || undefined;
        const habitId = linkedHabitId || undefined;

        // 1. Instant optimistic save (0ms latency, closes immediately)
        if (editingEntryId) {
            updateJournalEntry(editingEntryId, {
                title: generatedTitle,
                content: rawContent,
                category: selectedCategory,
                mood: selectedMood,
                linkedGoalId: goalId,
                linkedHabitId: habitId,
                imageData: currentAttachedImage || undefined,
            });
            triggerNotification('Saved ✨', `"${generatedTitle}" has been updated.`, 'achievement');
        } else {
            addJournalEntry({
                id: targetId,
                date: new Date().toISOString(),
                title: generatedTitle,
                category: selectedCategory,
                content: rawContent, 
                mood: selectedMood, 
                activities: [],
                prompt: dailyBriefing?.journalPrompt || "What's on your mind?",
                linkedGoalId: goalId,
                linkedHabitId: habitId,
                imageData: currentAttachedImage || undefined
            });
            triggerNotification('Saved ✨', `"${generatedTitle}" logged to timeline.`, 'achievement');
        }

        // Close modal immediately
        resetEditor();

        // 2. Asynchronous background synthesis (AI insight & cloud image storage)
        (async () => {
            try {
                let finalImageUrl = currentAttachedImage;
                if (currentAttachedImage && currentAttachedImage.startsWith('data:image') && user) {
                    try {
                        const uploadedUrl = await uploadImage('journal', `${user.id}/${targetId}`, currentAttachedImage);
                        if (uploadedUrl) finalImageUrl = uploadedUrl;
                    } catch (e) {
                        console.warn('Background image upload error:', e);
                    }
                }

                const linkedGoal = goals.find(g => g.id === goalId);
                const linkedHabit = habits.find(h => h.id === habitId);
                
                const insight = await generateEntryInsight(
                    rawContent, 
                    selectedMood, 
                    linkedGoal?.title || null, 
                    linkedHabit?.title || null,
                    currentAttachedImage, 
                    language
                );

                if (insight || (finalImageUrl && finalImageUrl !== currentAttachedImage)) {
                    updateJournalEntry(targetId, {
                        aiInsight: insight || undefined,
                        imageData: finalImageUrl || undefined
                    });
                }
            } catch (err) {
                console.warn('Background insight generation error:', err);
            }
        })();
    };

    const currentStyleConfig = ENTRY_STYLES.find(s => s.id === entryStyle) || ENTRY_STYLES[0];

    return (
        <div className="pb-32 space-y-4 animate-in fade-in duration-500">
            {/* HERO BANNER (WARM, UPLIFTING & LOW FRICTION) */}
            <div className={`-mx-6 -mt-6 p-6 pt-12 rounded-b-[2rem] bg-gradient-to-br ${themeClasses?.gradient || 'from-indigo-600 to-blue-600'} shadow-lg relative overflow-hidden`}>
                <div className="absolute top-4 right-6 opacity-20 text-white">{phaseIcon}</div>
                <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center backdrop-blur-md text-white">
                            <Coffee size={11} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Daily Log & Moments</span>
                    </div>
                    
                    <h1 className="text-xl font-bold tracking-tight leading-snug pr-8 text-white">
                        {dailyBriefing?.journalPrompt || "What did today bring? A win, what you ate, a memory, or an insight."}
                    </h1>

                    <div className="flex gap-2 pt-1">
                        <button 
                            onClick={() => {
                                resetEditor();
                                handleSelectEntryStyle('log');
                                setShowEditor(true);
                            }} 
                            className="flex-1 bg-white/20 hover:bg-white/25 px-4 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider active:scale-[0.97] transition-all flex items-center justify-center gap-2 border border-white/10 text-white shadow-sm"
                        >
                            <PenLine size={14} className="text-white" />
                            <span>Log Today / Notes</span>
                        </button>
                        <button 
                            onClick={() => {
                                resetEditor();
                                handleSelectEntryStyle('win');
                                setShowEditor(true);
                            }} 
                            className="bg-white/15 hover:bg-white/20 px-3.5 py-2.5 rounded-xl font-semibold text-xs tracking-wider active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 border border-white/10 text-white shadow-sm"
                            title="Capture a Win"
                        >
                            <Trophy size={14} />
                            <span className="hidden sm:inline">Record Win</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* CATEGORY FILTER PILL BAR */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
                <button
                    onClick={() => setSelectedCategoryFilter('All')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                        selectedCategoryFilter === 'All'
                            ? `${themeClasses.primary} text-white border-transparent shadow-sm`
                            : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-700'
                    }`}
                >
                    <Sparkles size={11} />
                    <span>All</span>
                    <span className="text-[10px] opacity-70">({categoryCounts.All || 0})</span>
                </button>
                {JOURNAL_CATEGORIES.map(cat => {
                    const CatIcon = cat.icon;
                    const isActive = selectedCategoryFilter === cat.id;
                    const count = categoryCounts[cat.id] || 0;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryFilter(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                                isActive
                                    ? `${themeClasses.primary} text-white border-transparent shadow-sm`
                                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-700'
                            }`}
                        >
                            <CatIcon size={11} />
                            <span>{cat.label}</span>
                            <span className="text-[10px] opacity-70">({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* SEARCH BAR (WHEN ENTRIES EXIST) */}
            {journalEntries.length > 0 && (
                <div className="relative group px-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-400 transition-colors" size={15} />
                    <input 
                        placeholder={`Search ${selectedCategoryFilter === 'All' ? 'memories, meals, logs' : selectedCategoryFilter}...`}
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl pl-10 pr-4 text-xs font-normal outline-none shadow-sm transition-all dark:text-white placeholder:text-slate-400" 
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={13} />
                        </button>
                    )}
                </div>
            )}

            {/* FEED: COMPACT CARDS (LATEST FIRST) */}
            <div className="space-y-2.5 min-h-[35vh] flex flex-col px-1">
                {filteredEntries.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-14 px-6 text-center space-y-3 bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Coffee size={30} className="text-slate-300 dark:text-slate-700" />
                        <div>
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {selectedCategoryFilter !== 'All' ? `No notes in ${selectedCategoryFilter}` : 'Your life log is open'}
                            </h2>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                                {selectedCategoryFilter !== 'All' 
                                    ? `Log what happened, meals, or thoughts in ${selectedCategoryFilter}.` 
                                    : 'A simple note, meals, a workout, or a victory—every day has moments worth capturing.'}
                            </p>
                        </div>
                        <button 
                            onClick={() => {
                                resetEditor();
                                if (selectedCategoryFilter !== 'All') {
                                    setCategory(selectedCategoryFilter);
                                }
                                setShowEditor(true);
                            }}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br ${themeClasses.gradient} text-white text-xs font-semibold uppercase tracking-wider shadow-md active:scale-95 transition-all mt-2`}
                        >
                            <PenLine size={13} /> 
                            <span>{selectedCategoryFilter !== 'All' ? `Log in ${selectedCategoryFilter}` : 'Start Quick Log'}</span>
                        </button>
                    </div>
                ) : (
                    filteredEntries.map((entry) => {
                        const linkedGoal = goals.find(g => g.id === entry.linkedGoalId);
                        const linkedHabit = habits.find(h => h.id === entry.linkedHabitId);
                        const moodCfg = MOODS.find(m => m.key === entry.mood) || MOODS[1];
                        const isExpanded = !!expandedEntryIds[entry.id];
                        const entryDate = entry.date ? new Date(entry.date) : new Date();
                        const formattedDate = entryDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        const entryTitle = entry.title || (entry.content.split('\n')[0].slice(0, 48) || 'Daily Note');
                        const catMeta = JOURNAL_CATEGORIES.find(c => c.id === entry.category) || JOURNAL_CATEGORIES[0];
                        const CatIcon = catMeta.icon;

                        return (
                            <div 
                                key={entry.id} 
                                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 group overflow-hidden ${
                                    isExpanded 
                                        ? 'border-indigo-200 dark:border-indigo-900/60 shadow-md ring-1 ring-indigo-500/20' 
                                        : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-slate-200 dark:hover:border-slate-700'
                                }`}
                            >
                                {/* COMPACT HEADER ROW */}
                                <div className="p-3.5 sm:p-4 pb-2">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            {/* Mood Pill */}
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${moodCfg.bg} border ${moodCfg.border}`}>
                                                <MoodGlyph type={entry.mood} active={true} color={moodCfg.color} size={13} />
                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${moodCfg.color}`}>
                                                    {moodCfg.label}
                                                </span>
                                            </div>

                                            {/* Category Badge */}
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                                                <CatIcon size={10} className="text-slate-400" />
                                                <span className="text-[10px] font-medium tracking-wide">
                                                    {entry.category || 'Daily Life'}
                                                </span>
                                            </div>

                                            {/* Date */}
                                            <span className="text-[11px] font-medium text-slate-400 ml-0.5">
                                                {formattedDate}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(entry);
                                                }} 
                                                className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                                                title="Edit"
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteJournalEntry(entry.id);
                                                }} 
                                                className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                                                title="Delete"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                            <button 
                                                onClick={() => toggleExpandEntry(entry.id)}
                                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                                                title={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* HEADING (CLEAN, COMPACT) */}
                                    <h3 
                                        onClick={() => toggleExpandEntry(entry.id)}
                                        className="font-semibold text-sm sm:text-[15px] leading-snug text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                                    >
                                        {entryTitle}
                                    </h3>

                                    {/* EXCERPT: Truncated when collapsed */}
                                    <p 
                                        onClick={() => toggleExpandEntry(entry.id)}
                                        className={`text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5 cursor-pointer whitespace-pre-line ${
                                            isExpanded ? '' : 'line-clamp-2'
                                        }`}
                                    >
                                        {entry.content}
                                    </p>
                                </div>

                                {/* ATTACHED IMAGE (EXPANDED OR THUMBNAIL) */}
                                {entry.imageData && (
                                    <div className="px-3.5 sm:px-4 pb-2">
                                        {isExpanded ? (
                                            <div className="w-full h-48 rounded-xl overflow-hidden shadow-inner border border-slate-100 dark:border-slate-800 mt-2">
                                                <img src={entry.imageData} className="w-full h-full object-cover" alt="Memory" />
                                            </div>
                                        ) : (
                                            <div 
                                                onClick={() => toggleExpandEntry(entry.id)}
                                                className="flex items-center gap-2 mt-1 cursor-pointer text-slate-400 hover:text-slate-600"
                                            >
                                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                                                    <img src={entry.imageData} className="w-full h-full object-cover" alt="Thumb" />
                                                </div>
                                                <span className="text-[11px] text-slate-400 font-medium">1 photo attached</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* AI INSIGHT (WARM & ENCOURAGING OBSERVATION) */}
                                {entry.aiInsight && isExpanded && (
                                    <div className="px-3.5 sm:px-4 pb-3">
                                        <div className={`${themeClasses.secondary} ${themeClasses.text} p-3 rounded-xl text-xs font-medium flex items-start gap-2.5 border ${themeClasses.border} animate-in fade-in`}>
                                            <Sparkles size={14} className="animate-pulse shrink-0 mt-0.5" />
                                            <span className="italic leading-relaxed">"{entry.aiInsight}"</span>
                                        </div>
                                    </div>
                                )}

                                {/* FOOTER ROW: LINKED CONTEXT & EXPAND TOGGLE */}
                                <div className="px-3.5 sm:px-4 py-2 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-2 overflow-hidden truncate">
                                        {linkedGoal && (
                                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate">
                                                <Target size={11} className={themeClasses.text} />
                                                <span className="truncate">{linkedGoal.title}</span>
                                            </div>
                                        )}
                                        {linkedHabit && (
                                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate">
                                                <Zap size={11} className="text-amber-500" />
                                                <span className="truncate">{linkedHabit.title}</span>
                                            </div>
                                        )}
                                        {!linkedGoal && !linkedHabit && entry.aiInsight && !isExpanded && (
                                            <div className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                                                <Sparkles size={11} />
                                                <span>Observation included</span>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => toggleExpandEntry(entry.id)}
                                        className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center gap-1 shrink-0 ml-2"
                                    >
                                        <span>{isExpanded ? 'Show less' : 'Read more'}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* STEP-BY-STEP CREATION WIZARD MODAL */}
            {showEditor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl" onClick={resetEditor} />
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-6 sm:p-7 shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 dark:border-slate-800">
                        
                        {/* WIZARD HEADER */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Step {wizardStep} of 4
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className={`text-[11px] font-semibold tracking-wide ${themeClasses.text}`}>
                                        {wizardStep === 1 ? 'Style & Vibe' : wizardStep === 2 ? 'Life Domain' : wizardStep === 3 ? 'Write & Photo' : 'System Alignment'}
                                    </span>
                                </div>
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-white mt-0.5">
                                    {editingEntryId ? 'Refine Entry' : 'Log a Moment'}
                                </h2>
                            </div>
                            <button 
                                onClick={resetEditor}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* STEP PROGRESS PILL BAR */}
                        <div className="grid grid-cols-4 gap-2 pt-3 pb-2 shrink-0">
                            {[
                                { step: 1, label: 'Style' },
                                { step: 2, label: 'Domain' },
                                { step: 3, label: 'Write' },
                                { step: 4, label: 'Save' }
                            ].map(item => {
                                const isCurrent = wizardStep === item.step;
                                const isPassed = wizardStep > item.step;
                                const canNavigate = item.step === 1 || content.trim().length > 0 || editingEntryId;
                                return (
                                    <button
                                        key={item.step}
                                        type="button"
                                        disabled={!canNavigate}
                                        onClick={() => {
                                            if (canNavigate) setWizardStep(item.step);
                                        }}
                                        className="flex flex-col gap-1 text-left group transition-all disabled:opacity-40"
                                    >
                                        <div className={`h-1.5 rounded-full transition-all ${
                                            isCurrent 
                                                ? `${themeClasses.primary} shadow-sm` 
                                                : isPassed 
                                                    ? 'bg-slate-300 dark:bg-slate-700' 
                                                    : 'bg-slate-100 dark:bg-slate-800'
                                        }`} />
                                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                                            isCurrent 
                                                ? themeClasses.text 
                                                : isPassed 
                                                    ? 'text-slate-600 dark:text-slate-300' 
                                                    : 'text-slate-400'
                                        }`}>
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* WIZARD CONTENT BODY */}
                        <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-4">
                            
                            {/* STEP 1: ENTRY STYLE & VIBE */}
                            {wizardStep === 1 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                                    {/* 1. Pick Entry Style */}
                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                                            What would you like to record?
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {ENTRY_STYLES.map(style => {
                                                const StyleIcon = style.icon;
                                                const isSelected = entryStyle === style.id;
                                                return (
                                                    <button
                                                        key={style.id}
                                                        type="button"
                                                        onClick={() => handleSelectEntryStyle(style.id)}
                                                        className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                                                            isSelected
                                                                ? `${themeClasses.secondary} ${themeClasses.border} ring-1 ring-inset ring-current shadow-sm`
                                                                : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-200'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-xl shrink-0 ${
                                                            isSelected ? `${themeClasses.primary} text-white` : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                                        }`}>
                                                            <StyleIcon size={14} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className={`text-xs font-bold leading-tight ${isSelected ? themeClasses.text : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {style.label}
                                                            </h4>
                                                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                                                                {style.badge}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Mood / Energy Selection */}
                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                                            How did today feel?
                                        </label>
                                        <div className="space-y-1.5">
                                            {MOODS.map(m => {
                                                const isSelected = mood === m.key;
                                                return (
                                                    <button
                                                        key={m.key}
                                                        type="button"
                                                        onClick={() => setMood(m.key as any)}
                                                        className={`w-full p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between text-left transition-all ${
                                                            isSelected
                                                                ? `${m.bg} ${m.border} shadow-sm ring-1 ring-inset ring-current`
                                                                : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-xl ${m.bg} flex items-center justify-center shrink-0`}>
                                                                <MoodGlyph type={m.key} active={isSelected} color={m.color} size={16} />
                                                            </div>
                                                            <div>
                                                                <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? m.color : 'text-slate-700 dark:text-slate-200'}`}>
                                                                    {m.label}
                                                                </span>
                                                                <p className="text-[10px] text-slate-400 leading-snug">
                                                                    {m.desc}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                                                            isSelected 
                                                                ? `${themeClasses.primary} text-white border-transparent` 
                                                                : 'border-slate-200 dark:border-slate-700 text-transparent'
                                                        }`}>
                                                            <Check size={10} strokeWidth={3} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 3. Quick Anchor Sparks */}
                                    <div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                                            Quick Activity Tag
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {QUICK_TAG_ANCHORS.map(tag => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => {
                                                        if (!title) setTitle(tag);
                                                    }}
                                                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    + {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: LIFE DOMAIN / CATEGORY */}
                            {wizardStep === 2 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                                Which life category?
                                            </label>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                Pick "Daily Life" for general logs, or a specific domain.
                                            </p>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowCategoryTooltip(!showCategoryTooltip)}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <HelpCircle size={15} />
                                        </button>
                                    </div>

                                    {showCategoryTooltip && (
                                        <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-3 rounded-2xl text-xs text-indigo-900 dark:text-indigo-200 animate-in fade-in leading-relaxed">
                                            💡 <b>Organized Timeline:</b> Tagging entries lets you easily filter your memories later (e.g. review all delicious meals or career breakthroughs) and provides signal to your Growth Audit.
                                        </div>
                                    )}

                                    {/* Category Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {JOURNAL_CATEGORIES.map(cat => {
                                            const CatIcon = cat.icon;
                                            const isSelected = category === cat.id;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setCategory(cat.id)}
                                                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                                                        isSelected
                                                            ? `${themeClasses.secondary} ${themeClasses.border} shadow-sm ring-1 ring-inset ring-current`
                                                            : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                                    }`}
                                                >
                                                    <div className={`p-2 rounded-xl shrink-0 ${
                                                        isSelected ? `${themeClasses.primary} text-white shadow-sm` : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500'
                                                    }`}>
                                                        <CatIcon size={15} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className={`text-xs font-bold leading-tight ${isSelected ? themeClasses.text : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {cat.label}
                                                            </h4>
                                                            {isSelected && <Check size={12} className={themeClasses.text} />}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-1">
                                                            {cat.desc}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: WRITE & PHOTO */}
                            {wizardStep === 3 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                                    {/* Headline Input */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                Entry Title (Optional)
                                            </label>
                                            <span className="text-[10px] text-slate-400">Quick headline</span>
                                        </div>
                                        <input 
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="e.g. Pasta night with friends, Great gym session, Morning walk..."
                                            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>

                                    {/* Content Textarea & Starter Template */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                Notes & Memories
                                            </label>
                                            {currentStyleConfig.template && (
                                                <button
                                                    type="button"
                                                    onClick={handleApplyTemplate}
                                                    className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                                                >
                                                    + Insert Day Template
                                                </button>
                                            )}
                                        </div>
                                        <textarea 
                                            autoFocus
                                            rows={6}
                                            value={content} 
                                            onChange={e => setContent(e.target.value)} 
                                            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs font-normal text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed" 
                                            placeholder={currentStyleConfig.placeholder}
                                        />
                                    </div>

                                    {/* Photo Section */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                Photo of the Day (Optional)
                                            </span>
                                            <button 
                                                type="button" 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 transition-colors"
                                            >
                                                <ImageIcon size={13} />
                                                <span>{attachedImage ? 'Replace Photo' : 'Attach Photo'}</span>
                                            </button>
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                onChange={handleImageUpload} 
                                                accept="image/*" 
                                                className="hidden" 
                                            />
                                        </div>

                                        {attachedImage && (
                                            <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm animate-in zoom-in-95">
                                                <img src={attachedImage} className="w-full h-full object-cover" alt="Attached memory" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setAttachedImage(null)} 
                                                    className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: ALIGNMENT & LIVE PREVIEW */}
                            {wizardStep === 4 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                                    {/* Goal Connection */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                            Related Goal (Optional)
                                        </label>
                                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                            <button 
                                                type="button"
                                                onClick={() => setLinkedGoalId('')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                                                    linkedGoalId === '' 
                                                        ? `${themeClasses.primary} text-white border-transparent shadow-sm` 
                                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                                                }`}
                                            >
                                                None
                                            </button>
                                            {goals.map(g => (
                                                <button 
                                                    key={g.id} 
                                                    type="button"
                                                    onClick={() => setLinkedGoalId(g.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                                                        linkedGoalId === g.id 
                                                            ? `${themeClasses.primary} text-white border-transparent shadow-sm` 
                                                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                                                    }`}
                                                >
                                                    <Target size={11} />
                                                    <span>{g.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Ritual Connection */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                                            Related Ritual (Optional)
                                        </label>
                                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                            <button 
                                                type="button"
                                                onClick={() => setLinkedHabitId('')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                                                    linkedHabitId === '' 
                                                        ? `${themeClasses.primary} text-white border-transparent shadow-sm` 
                                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                                                }`}
                                            >
                                                None
                                            </button>
                                            {habits.map(h => (
                                                <button 
                                                    key={h.id} 
                                                    type="button"
                                                    onClick={() => setLinkedHabitId(h.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                                                        linkedHabitId === h.id 
                                                            ? `${themeClasses.primary} text-white border-transparent shadow-sm` 
                                                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                                                    }`}
                                                >
                                                    <Zap size={11} />
                                                    <span>{h.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* LIVE COMPACT PREVIEW */}
                                    <div className="pt-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                                            Feed Card Preview
                                        </span>
                                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500">
                                                    {mood}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    {category}
                                                </span>
                                                <span className="text-[11px] text-slate-400">Just now</span>
                                            </div>
                                            <h4 className="font-semibold text-xs text-slate-800 dark:text-white line-clamp-1">
                                                {title.trim() || 'Daily Note'}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed whitespace-pre-line">
                                                {content.trim() || 'No text written yet.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* WIZARD NAVIGATION FOOTER */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                            {wizardStep > 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setWizardStep(prev => prev - 1)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                                >
                                    <ArrowLeft size={14} />
                                    <span>Back</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={resetEditor}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                            )}

                            {wizardStep < 4 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (wizardStep === 3 && !content.trim()) return;
                                        setWizardStep(prev => prev + 1);
                                    }}
                                    disabled={wizardStep === 3 && !content.trim()}
                                    className={`px-5 py-2 rounded-xl text-white font-semibold text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 bg-gradient-to-br ${themeClasses.gradient} disabled:opacity-40 transition-all`}
                                >
                                    <span>Next</span>
                                    <ArrowRight size={14} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={!content.trim()}
                                    className={`px-6 py-2.5 rounded-xl text-white font-semibold text-xs uppercase tracking-wider shadow-md flex items-center gap-2 bg-gradient-to-br ${themeClasses.gradient} disabled:opacity-40 active:scale-[0.98] transition-all`}
                                >
                                    <CheckCircle2 size={14} />
                                    <span>{editingEntryId ? 'Update Entry' : 'Save to Timeline'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
