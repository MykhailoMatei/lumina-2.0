import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Search, Bookmark, Star, PlayCircle, BookOpen, Headphones, 
    ChevronRight, User, Plus
} from 'lucide-react';
import { Resource, LearningModule, Quiz } from '../types';

export const Inspiration: React.FC = () => {
    const { resources, modules, quizzes, themeClasses, savedResourceIds, toggleResourceFavorite, triggerNotification, t } = useApp();
    const [activeTab, setActiveTab] = useState<'Library' | 'Learn' | 'Quizzes'>('Library');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const CATEGORIES = ['All', 'Habits', 'Mindfulness', 'Productivity', 'Finance', 'Health'];

    const filteredResources = resources.filter((r: Resource) => 
        (selectedCategory === 'All' || r.category === selectedCategory) &&
        (r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.author.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleStartQuiz = (title: string) => {
        triggerNotification(t('start_btn'), title, "achievement");
    };
    
    const handleSubmitResource = () => {
        triggerNotification(t('contrib_received'), t('contrib_thanks'), "achievement");
    };

    return (
        <div className="pb-24 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('grow_explore')}</h1>
                <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex text-xs font-bold">
                    {[
                      { id: 'Library', label: t('library') },
                      { id: 'Learn', label: t('learn_tab') },
                      { id: 'Quizzes', label: t('quizzes_tab') }
                    ].map((tab: any) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'Library' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="relative h-48 rounded-2xl overflow-hidden shadow-md group cursor-pointer">
                         <img src="https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=600&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={t('stillness_alt')} />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                         <div className="absolute bottom-0 left-0 p-5 text-white">
                             <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 inline-block">{t('editors_pick')}</span>
                             <h2 className="text-xl font-bold leading-tight mb-1">{t('stillness_title')}</h2>
                             <p className="text-xs text-white/80">{t('stillness_desc')}</p>
                         </div>
                    </div>

                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                value={searchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                placeholder={t('search_resources')}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-indigo-300 shadow-sm dark:text-white"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {CATEGORIES.map((cat: string) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${selectedCategory === cat ? `${themeClasses.primary} text-white border-transparent shadow-sm` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-50'}`}
                                >
                                    {cat === 'All' ? t('all_label') || 'All' : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredResources.map((r: Resource) => {
                            const isSaved = savedResourceIds.includes(r.id);
                            return (
                                <div key={r.id} className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex gap-4 hover:border-indigo-100 transition-colors group">
                                    <div className="w-20 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden relative">
                                        <img src={r.image} className="w-full h-full object-cover" alt={r.title} />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            {r.type === 'video' ? <PlayCircle className="text-white" size={24} /> : 
                                             r.type === 'podcast' ? <Headphones className="text-white" size={24} /> : 
                                             <BookOpen className="text-white" size={24} />}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight line-clamp-2">{r.title}</h3>
                                                <button onClick={() => toggleResourceFavorite(r.id)} className={`shrink-0 ${isSaved ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-slate-500'}`}>
                                                    <Bookmark size={16} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.author}</p>
                                        </div>
                                        <div className="flex justify-between items-end mt-2">
                                            <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">{r.duration}</span>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                                <Star size={10} className="text-amber-400 fill-amber-400" /> {r.rating}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/30 text-center">
                        <h3 className="font-bold text-indigo-900 dark:text-indigo-400 mb-2">{t('share_title')}</h3>
                        <p className="text-xs text-indigo-600 dark:text-indigo-500 mb-4 px-4">{t('share_desc')}</p>
                        <button onClick={handleSubmitResource} className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 mx-auto hover:bg-indigo-50 dark:hover:bg-slate-700">
                            <Plus size={14} /> {t('submit_resource')}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'Learn' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                     <div>
                        <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">{t('your_modules')}</h2>
                        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar">
                            {modules.map((m: LearningModule) => (
                                <div key={m.id} className="min-w-[260px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                                    <div className="h-32 bg-slate-200 dark:bg-slate-800 relative">
                                        <img src={m.image} className="w-full h-full object-cover" alt={m.title} />
                                        <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            {m.completedLessons}/{m.totalLessons}
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{m.title}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{m.description}</p>
                                        </div>
                                        <div className="mt-4">
                                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                                                <div className={`h-full ${themeClasses.primary}`} style={{ width: `${(m.completedLessons / m.totalLessons) * 100}%` }} />
                                            </div>
                                            <button className={`w-full py-2 rounded-xl text-xs font-bold ${m.completedLessons > 0 ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : `${themeClasses.primary} text-white`}`}>
                                                {m.completedLessons > 0 ? t('continue_btn') : t('start_module')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>

                     <div>
                        <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">{t('recommended_for_you')}</h2>
                        <div className="space-y-3">
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex gap-4 items-center">
                                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{t('expert_masterclass')}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('masterclass_desc')}</p>
                                </div>
                                <ChevronRight className="ml-auto text-slate-300 dark:text-slate-700" size={20} />
                            </div>
                        </div>
                     </div>
                </div>
            )}

            {activeTab === 'Quizzes' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    {quizzes.map((q: Quiz) => (
                        <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex">
                            <div className="w-24 bg-slate-200 dark:bg-slate-800 relative">
                                <img src={q.image} className="w-full h-full object-cover" alt={q.title} />
                            </div>
                            <div className="p-4 flex-1">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{q.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{q.description}</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">{q.questionsCount} {t('questions_count')}</span>
                                    <button 
                                        onClick={() => handleStartQuiz(q.title)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${themeClasses.primary}`}
                                    >
                                        {t('start_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    <div className="p-6 text-center text-slate-400">
                        <Plus className="mx-auto mb-2 opacity-50" size={32} />
                        <p className="text-sm">{t('quizzes_soon')}</p>
                    </div>
                </div>
            )}
        </div>
    );
};