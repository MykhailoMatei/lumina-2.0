import React from 'react';
import { Shield, X, Lock, Database, UserCheck, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
    onClose: () => void;
}

export const PrivacyPolicy: React.FC<Props> = ({ onClose }) => {
    const { t } = useApp();
    
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 border border-slate-100 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <Shield className="text-emerald-500" size={24} />
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('privacy_policy')}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto space-y-8 text-sm text-slate-600 dark:text-slate-400 leading-relaxed no-scrollbar">
                    <section>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><Database size={16}/> 1. {t('policy_sec_1_title')}</h3>
                        <p>{t('policy_sec_1_text')}</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><Lock size={16}/> 2. {t('policy_sec_2_title')}</h3>
                        <p>{t('policy_sec_2_text')}</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><EyeOff size={16}/> 3. {t('policy_sec_3_title')}</h3>
                        <p>{t('policy_sec_3_text')}</p>
                    </section>
                    
                    <section>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><UserCheck size={16}/> 4. {t('policy_sec_4_title')}</h3>
                        <p>{t('policy_sec_4_text')}</p>
                    </section>

                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-indigo-800 dark:text-indigo-300 text-xs font-medium">
                        <strong>{t('ai_note_title')}</strong> {t('ai_note_text')}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-center">
                    <button onClick={onClose} className="bg-slate-800 dark:bg-slate-700 text-white px-10 py-3 rounded-2xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all">
                        {t('done_btn')}
                    </button>
                </div>
            </div>
        </div>
    );
};