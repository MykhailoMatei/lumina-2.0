
import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Clock, Bell, Trophy, Zap } from 'lucide-react';
import { AppNotification } from '../types';

const NotificationSystem: React.FC = () => {
    const { notifications, dismissNotification, snoozeNotification, themeClasses, t } = useApp();

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0">
            {notifications.map((n: AppNotification) => (
                <div 
                    key={n.id} 
                    className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 p-4 animate-in slide-in-from-right-full fade-in duration-300 flex gap-3 relative overflow-hidden"
                >
                    <div className={`w-1 absolute left-0 top-0 bottom-0 ${
                        n.type === 'achievement' ? 'bg-amber-400' : 
                        n.type === 'motivation' ? 'bg-emerald-400' : themeClasses.primary
                    }`} />
                    
                    <div className={`p-2 rounded-full h-fit shrink-0 ${
                        n.type === 'achievement' ? 'bg-amber-50 text-amber-500' : 
                        n.type === 'motivation' ? 'bg-emerald-50 text-emerald-500' : 
                        `${themeClasses.secondary} ${themeClasses.text}`
                    }`}>
                        {n.type === 'achievement' ? <Trophy size={20} /> : 
                         n.type === 'motivation' ? <Zap size={20} /> : <Bell size={20} />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{n.title}</h4>
                            <button onClick={() => dismissNotification(n.id)} className="text-slate-300 hover:text-slate-500">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                        
                        {n.type === 'reminder' && (
                            <div className="mt-3 flex gap-2">
                                <button 
                                    onClick={() => snoozeNotification(n.id)}
                                    className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                >
                                    <Clock size={12} /> {t('snooze_btn')}
                                </button>
                                <button 
                                    onClick={() => dismissNotification(n.id)}
                                    className={`text-[10px] font-bold text-white ${themeClasses.primary} px-3 py-1.5 rounded-lg shadow-sm hover:opacity-90 transition-opacity`}
                                >
                                    {t('done_btn')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NotificationSystem;
