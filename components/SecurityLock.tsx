import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, ShieldCheck } from 'lucide-react';

export const SecurityLock: React.FC = () => {
    const { unlockApp, themeClasses, t } = useApp();
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const handleNumClick = (num: string) => {
        if (pin.length < 4) {
            setPin((prev: string) => prev + num);
            setError(false);
        }
    };

    const handleDelete = () => {
        setPin((prev: string) => prev.slice(0, -1));
    };

    useEffect(() => {
        if (pin.length === 4) {
            setTimeout(() => {
                const success = unlockApp(pin);
                if (!success) {
                    setError(true);
                    setPin('');
                }
            }, 200);
        }
    }, [pin, unlockApp]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300 transition-colors">
            <div className={`w-16 h-16 rounded-full ${themeClasses.primary} text-white flex items-center justify-center mb-6 shadow-xl`}>
                <Lock size={32} />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t('welcome_back')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">{t('pin_prompt')}</p>

            <div className="flex gap-4 mb-8">
                {[0, 1, 2, 3].map((i: number) => (
                    <div 
                        key={i} 
                        className={`w-4 h-4 rounded-full transition-all duration-200 ${
                            i < pin.length 
                            ? `${themeClasses.primary} scale-110` 
                            : 'bg-slate-200 dark:bg-slate-800'
                        } ${error ? 'bg-red-500 animate-pulse' : ''}`}
                    />
                ))}
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num: number) => (
                    <button
                        key={num}
                        onClick={() => handleNumClick(num.toString())}
                        className="h-16 w-16 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 text-2xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-105 transition-all active:scale-95"
                    >
                        {num}
                    </button>
                ))}
                <div className="h-16 w-16" />
                <button
                    onClick={() => handleNumClick('0')}
                    className="h-16 w-16 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 text-2xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-105 transition-all active:scale-95"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    className="h-16 w-16 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 font-bold uppercase text-xs"
                >
                    {t('delete_key')}
                </button>
            </div>
            
            <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600">
                <ShieldCheck size={14} /> {t('encrypted_secure')}
            </div>
        </div>
    );
};