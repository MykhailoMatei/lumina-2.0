
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Book, PenLine, X, Send, Sparkles, Search, Trash2, 
    ImageIcon, Loader2, Target, Calendar, Camera, Pencil,
    Sun, Moon, Clock, Sunset, BookOpen, Zap, CloudRain, Shield,
    Activity, Circle, Wind
} from 'lucide-react';
import { generateEntryInsight } from '../services/geminiService';
import { uploadImage } from '../services/storageService';
import { JournalEntry } from '../types';

// Custom Minimalist Mood Glyphs to fit the "Lumina" aesthetic
const MoodGlyph: React.FC<{ type: string; active: boolean; color: string }> = ({ type, active, color }) => {
    // Re-balanced sizes: A bit bigger to feel substantial, but still contained
    const size = active ? 26 : 20;
    const strokeWidth = active ? 2.5 : 1.8;
    const commonClasses = `transition-all duration-500 ${active ? color : 'text-slate-300 dark:text-slate-700'}`;

    switch (type) {
        case 'Great':
            return (
                <div className="relative">
                    <Sparkles size={size} strokeWidth={strokeWidth} className={commonClasses} />
                </div>
            );
        case 'Good':
            return (
                <div className="relative">
                    <Sun size={size} strokeWidth={strokeWidth} className={commonClasses} />
                </div>
            );
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

export const Journal: React.FC = () => {
    const { 
        journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry, goals, habits, user,
        t, themeClasses, language, dailyBriefing, preselectedGoalId, setPreselectedGoalId, circadian
    } = useApp();
    
    const [showEditor, setShowEditor] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [content, setContent] = useState('');
    
    // Defaulting to Neutral ('Still') as requested
    const [mood, setMood] = useState<'Great' | 'Good' | 'Neutral' | 'Bad' | 'Awful'>('Neutral');
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [linkedGoalId, setLinkedGoalId] = useState<string>('');
    const [linkedHabitId, setLinkedHabitId] = useState<string>('');
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [linkFilter, setLinkFilter] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (preselectedGoalId) {
            setLinkedGoalId(preselectedGoalId);
            setPreselectedGoalId(null);
            setShowEditor(true);
        }
    }, [preselectedGoalId]);

    const phaseIcon = useMemo(() => {
        switch(circadian.state) {
            case 'Morning': return <Sun size={12} className="animate-pulse" />;
            case 'Day': return <Clock size={12} />;
            case 'Evening': return <Sunset size={12} />;
            default: return <Moon size={12} />;
        }
    }, [circadian.state]);

    const MOODS = [
        { key: 'Great', label: 'Radiant', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        { key: 'Good', label: 'Steady', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { key: 'Neutral', label: 'Still', color: 'text-slate-400', bg: 'bg-slate-400/10' },
        { key: 'Bad', label: 'Turbulent', color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { key: 'Awful', label: 'Heavy', color: 'text-rose-500', bg: 'bg-rose-500/10' }
    ];

    const sortedGoals = useMemo(() => {
        return goals.filter(g => g.title.toLowerCase().includes(linkFilter.toLowerCase()));
    }, [goals, linkFilter]);

    const handleSubmit = async () => {
        if (!content.trim()) return;
        setSubmitting(true);
        
        let imageUrl = attachedImage;
        
        if (attachedImage && attachedImage.startsWith('data:image') && user) {
            const uploadedUrl = await uploadImage('journal', `${user.id}/${Date.now()}`, attachedImage);
            if (uploadedUrl) imageUrl = uploadedUrl;
        }

        const linkedGoal = goals.find(g => g.id === linkedGoalId);
        const linkedHabit = habits.find(h => h.id === linkedHabitId);
        
        const entryToEdit = journalEntries.find(e => e.id === editingEntryId);
        let insight = entryToEdit?.aiInsight;
        
        if (!entryToEdit || entryToEdit.content !== content) {
            insight = await generateEntryInsight(
                content, 
                mood, 
                linkedGoal?.title || null, 
                linkedHabit?.title || null,
                attachedImage, 
                language
            );
        }

        if (editingEntryId) {
            updateJournalEntry(editingEntryId, {
                content,
                mood,
                linkedGoalId: linkedGoalId || undefined,
                linkedHabitId: linkedHabitId || undefined,
                imageData: imageUrl || undefined,
                aiInsight: insight
            });
        } else {
            addJournalEntry({
                id: Date.now().toString(),
                date: new Date().toISOString(),
                content, 
                mood, 
                activities: [],
                prompt: dailyBriefing?.journalPrompt || "What's on your mind?",
                aiInsight: insight,
                linkedGoalId: linkedGoalId || undefined,
                linkedHabitId: linkedHabitId || undefined,
                imageData: imageUrl || undefined
            });
        }

        setSubmitting(false);
        resetEditor();
    };

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntryId(entry.id);
        setContent(entry.content);
        setMood(entry.mood);
        setLinkedGoalId(entry.linkedGoalId || '');
        setLinkedHabitId(entry.linkedHabitId || '');
        setAttachedImage(entry.imageData || null);
        setShowEditor(true);
    };

    const resetEditor = () => {
        setContent('');
        setMood('Neutral');
        setLinkedGoalId('');
        setLinkedHabitId('');
        setAttachedImage(null);
        setLinkFilter('');
        setEditingEntryId(null);
        setShowEditor(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setAttachedImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const filtered = journalEntries.filter((e: any) => 
        e.content.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="pb-32 space-y-4 animate-in fade-in duration-500">
            <div className={`-mx-6 -mt-6 p-6 pt-12 rounded-b-[2rem] bg-gradient-to-br ${themeClasses?.gradient || 'from-indigo-600 to-blue-600'} shadow-lg relative overflow-hidden`}>
                <div className="absolute top-4 right-6 opacity-20 text-white">{phaseIcon}</div>
                <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center backdrop-blur-md text-white">
                            <Sparkles size={11} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Daily Reflection</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight leading-snug pr-8 text-white">
                        {dailyBriefing?.journalPrompt || 'How did today shape who you are becoming?'}
                    </h1>
                    <button 
                        onClick={() => setShowEditor(true)} 
                        className="w-full bg-white/20 hover:bg-white/25 px-4 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider active:scale-[0.97] transition-all flex items-center justify-center gap-2 group border border-white/10 text-white shadow-sm"
                    >
                        <PenLine size={14} className="transition-transform group-hover:rotate-12 text-white" />
                        <span className="text-white">Capture Moment</span>
                    </button>
                </div>
            </div>

            {journalEntries.length > 0 && (
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-400 transition-colors" size={16} />
                    <input 
                        placeholder="Search memories..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl pl-11 pr-4 text-xs font-normal outline-none shadow-sm transition-all dark:text-white" 
                    />
                </div>
            )}

            <div className="space-y-3 min-h-[40vh] flex flex-col">
                {journalEntries.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center space-y-3">
                        <BookOpen size={32} className="text-slate-300 dark:text-slate-700" />
                        <h2 className="text-base font-bold text-slate-700 dark:text-white opacity-60">The first page is yours</h2>
                        <button 
                            onClick={() => setShowEditor(true)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-br ${themeClasses.gradient} text-white text-xs font-semibold uppercase tracking-wider shadow-md active:scale-95 transition-all`}
                        >
                            <PenLine size={13} /> Start Reflection
                        </button>
                    </div>
                ) : (
                    filtered.map((entry) => {
                        const linkedGoal = goals.find(g => g.id === entry.linkedGoalId);
                        const moodCfg = MOODS.find(m => m.key === entry.mood);
                        return (
                            <div key={entry.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group animate-in slide-in-from-bottom-2">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl ${moodCfg?.bg} flex items-center justify-center shadow-inner`}>
                                            <MoodGlyph type={entry.mood} active={true} color={moodCfg?.color || 'text-slate-400'} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                                                {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </span>
                                            <div className="flex gap-2 mt-0.5">
                                                {linkedGoal && (
                                                    <div className="flex items-center gap-1">
                                                        <Target size={11} className={themeClasses.text} />
                                                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${themeClasses.text}`}>{linkedGoal.title}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(entry)} className="p-1.5 text-slate-400 hover:text-indigo-500 transition-all">
                                            <Pencil size={15}/>
                                        </button>
                                        <button onClick={() => deleteJournalEntry(entry.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-all">
                                            <Trash2 size={15}/>
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {entry.imageData && (
                                        <div className="w-full h-40 rounded-xl overflow-hidden shadow-inner border border-slate-100 dark:border-slate-800">
                                            <img src={entry.imageData} className="w-full h-full object-cover" alt="Memory" />
                                        </div>
                                    )}
                                    <p className="text-slate-700 dark:text-slate-200 text-sm font-normal leading-relaxed">{entry.content}</p>
                                </div>
                                {entry.aiInsight && (
                                    <div className={`mt-3 ${themeClasses.secondary} ${themeClasses.text} p-3 rounded-xl text-xs font-medium flex items-center gap-2.5 border ${themeClasses.border}`}>
                                        <Sparkles size={13} className="animate-pulse shrink-0" />
                                        <span className="italic leading-snug">"{entry.aiInsight}"</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {showEditor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" onClick={resetEditor} />
                    <div className={`bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] overflow-hidden border border-white/10`}>
                        <div className="flex justify-between items-center mb-5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400`}>
                                    <Calendar size={18} />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight dark:text-white">
                                    {editingEntryId ? 'Refine Entry' : 'Seal Moment'}
                                </h2>
                            </div>
                            <button onClick={resetEditor} className="p-2 text-slate-400 hover:text-slate-600 transition-all"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1">
                            <div className={`p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border-l-4 ${themeClasses.border} shadow-sm`}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Reflective Spark</p>
                                <p className="text-xs font-normal text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                    {dailyBriefing?.journalPrompt || "How did today contribute to your long-term vision?"}
                                </p>
                            </div>

                            <div className="space-y-2.5 bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">Neural Context</label>
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <Search size={11} className="text-slate-400" />
                                        <input 
                                            value={linkFilter}
                                            onChange={e => setLinkFilter(e.target.value)}
                                            placeholder="Find..."
                                            className="bg-transparent text-xs font-normal outline-none w-16 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                        <button 
                                            onClick={() => setLinkedGoalId('')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${linkedGoalId === '' ? `${themeClasses.primary} text-white border-transparent shadow-sm` : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:text-slate-700'}`}
                                        >
                                            No Context
                                        </button>
                                        {sortedGoals.map(g => (
                                            <button 
                                                key={g.id} 
                                                onClick={() => setLinkedGoalId(g.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${linkedGoalId === g.id ? `${themeClasses.primary} text-white border-transparent shadow-sm` : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:text-slate-700'}`}
                                            >
                                                <Target size={11} strokeWidth={2.5} />
                                                {g.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <textarea 
                                    autoFocus
                                    value={content} 
                                    onChange={e => setContent(e.target.value)} 
                                    className="w-full min-h-[140px] bg-transparent resize-none outline-none text-sm font-normal text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 leading-relaxed" 
                                    placeholder="Speak your truth..."
                                />
                                {attachedImage && (
                                    <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm animate-in zoom-in-95">
                                        <img src={attachedImage} className="w-full h-full object-cover" alt="Memory" />
                                        <button onClick={() => setAttachedImage(null)} className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white p-1.5 rounded-full"><X size={12}/></button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider ml-1">Vibration</p>
                                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 h-14 overflow-hidden">
                                    {MOODS.map(m => (
                                        <button 
                                            key={m.key} 
                                            onClick={() => setMood(m.key as any)} 
                                            className={`flex-1 h-full flex flex-col items-center justify-center transition-all duration-300 relative rounded-xl ${mood === m.key ? `bg-white dark:bg-slate-800 shadow-sm` : 'opacity-35 grayscale hover:opacity-100'}`}
                                        >
                                            <MoodGlyph type={m.key} active={mood === m.key} color={m.color} />
                                            {mood === m.key && (
                                                <span className={`text-[9px] font-semibold uppercase tracking-wider ${m.color} mt-0.5 animate-in fade-in`}>
                                                    {m.label}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 shrink-0">
                             <div className="flex gap-2">
                                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"><ImageIcon size={18}/></button>
                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                <button className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 active:scale-95 transition-all"><Camera size={18}/></button>
                             </div>
                             <button 
                                onClick={handleSubmit} 
                                disabled={!content.trim() || submitting} 
                                className={`px-6 py-2.5 rounded-xl text-white font-semibold text-xs uppercase tracking-wider shadow-md flex items-center gap-2 bg-gradient-to-br ${themeClasses.gradient} disabled:opacity-50 active:scale-[0.98] transition-all`}
                             >
                                {submitting ? <Loader2 className="animate-spin" size={14}/> : <Send size={14}/>}
                                {submitting ? (editingEntryId ? 'Uploading' : 'Saving') : (editingEntryId ? 'Update' : 'Seal Entry')}
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
