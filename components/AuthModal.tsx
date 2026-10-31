
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { X, Mail, Lock, Loader2, ShieldCheck, Chrome, Info } from 'lucide-react';

interface AuthModalProps {
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
    const { themeClasses, t, triggerNotification } = useApp();
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                triggerNotification(t('auth_title'), t('check_email_msg'), 'achievement');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                triggerNotification(t('auth_title'), t('welcome_back'), 'achievement');
                onClose();
            }
        } catch (error: any) {
            triggerNotification(t('auth_error'), error.message || 'Authentication failed', 'reminder');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
            // Using window.location.origin ensures we return to the root of the app
            const redirectTo = window.location.origin;
            
            console.group('Lumina Auth Debug');
            console.log('Target Redirect (Site URL):', redirectTo);
            console.log('Google Callback (GCP Console): https://woxthjwqqlpmnlqtpced.supabase.co/auth/v1/callback');
            console.groupEnd();

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account',
                    },
                }
            });
            
            if (error) throw error;
            
        } catch (error: any) {
            console.error('Google Auth Error:', error);
            triggerNotification(
                t('auth_error'), 
                error.message === 'provider_not_supported' 
                    ? 'Google login is not enabled in Supabase' 
                    : error.message || 'Google login failed', 
                'reminder'
            );
            setGoogleLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Overlay */}
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
            
            {/* Centered Modal - Compact & Premium */}
            <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2.5rem] p-7 shadow-2xl relative animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 ${themeClasses.primary} opacity-5 rounded-full blur-3xl -mr-16 -mt-16`} />
                
                <div className="flex justify-between items-start mb-5 pt-1">
                    <div className="space-y-0.5">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </h2>
                        <p className="text-xs font-normal text-slate-400">
                            {isSignUp ? 'Sync your habits and reflections' : 'Sign in to sync your data'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Social Login Section */}
                <div className="space-y-2 mb-5">
                    <button 
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-3 rounded-2xl shadow-sm active:scale-[0.98] transition-all hover:bg-slate-50 disabled:opacity-50"
                    >
                        {googleLoading ? (
                            <Loader2 size={15} className="animate-spin text-slate-400" />
                        ) : (
                            <Chrome size={15} className="text-slate-700 dark:text-white" />
                        )}
                        <span className="text-xs font-semibold tracking-wide text-slate-700 dark:text-white">
                            {googleLoading ? 'Connecting...' : 'Google Login'}
                        </span>
                    </button>

                    <button 
                        onClick={() => setShowHelp(!showHelp)}
                        className="w-full text-center text-[10px] font-medium text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mt-1 transition-colors"
                    >
                        <Info size={11} /> Login issues?
                    </button>

                    {showHelp && (
                        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs font-normal text-slate-500 dark:text-slate-400 space-y-1.5 animate-in slide-in-from-top-2">
                            <p>1. Ensure <b>Google Provider</b> is enabled in Supabase Auth Dashboard.</p>
                            <p>2. Set GCP Redirect URI to the Supabase callback URL.</p>
                            <p>3. Add <b>{window.location.origin}</b> to Supabase <span className="text-indigo-500">Redirect URLs</span>.</p>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-3 py-1.5 mt-1">
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Or email</span>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                    </div>
                </div>

                <form onSubmit={handleAuth} className="space-y-3">
                    <div className="space-y-2">
                        <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                            <input 
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl pl-9 pr-3.5 py-3 text-sm font-normal border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none dark:text-white transition-all"
                                placeholder="Email"
                            />
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                            <input 
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl pl-9 pr-3.5 py-3 text-sm font-normal border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none dark:text-white transition-all"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3.5 rounded-2xl bg-gradient-to-br ${themeClasses.gradient} text-white font-semibold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 mt-1`}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} strokeWidth={2.5} />}
                        {isSignUp ? 'Create Account' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button 
                        onClick={() => setIsSignUp(!isSignUp)}
                        className={`text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all flex flex-col items-center gap-0.5 mx-auto`}
                    >
                        <span>{isSignUp ? 'Already have an account?' : 'New to Lumina?'}</span>
                        <span className={`${themeClasses.text} font-semibold`}>{isSignUp ? 'Sign In Instead' : 'Create an Account'}</span>
                    </button>
                </div>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400">
                    <Lock size={10} /> Secured by Supabase Auth
                </div>
            </div>
        </div>
    );
};
