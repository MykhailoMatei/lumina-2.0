
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { 
  UserState, Goal, Habit, JournalEntry, ThemeColor, AppLanguage, 
  DailyBriefing, AppNotification, Post, Comment, WeeklyReview
} from '../types';
import { performCloudSync } from '../services/syncService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { sendSystemNotification, requestNotificationPermission } from '../services/notificationService';
import { calculateHabitStreak } from '../services/habitService';
import { toLocalDateString } from '../services/date';

export const APP_VERSION = '1.5.7-modern';

export const THEMES: Record<ThemeColor, any> = {
  indigo: { name: 'accent_indigo', primary: 'bg-indigo-600', text: 'text-indigo-600', secondary: 'bg-indigo-50 dark:bg-indigo-900/20', gradient: 'from-indigo-600 to-blue-600', ring: 'ring-indigo-500', border: 'border-indigo-100 dark:border-indigo-900/30' },
  emerald: { name: 'accent_emerald', primary: 'bg-emerald-600', text: 'text-emerald-600', secondary: 'bg-emerald-50 dark:bg-emerald-900/20', gradient: 'from-emerald-600 to-teal-600', ring: 'ring-emerald-500', border: 'border-emerald-100 dark:border-emerald-900/30' },
  rose: { name: 'accent_rose', primary: 'bg-rose-600', text: 'text-rose-600', secondary: 'bg-rose-50 dark:bg-rose-900/20', gradient: 'from-rose-600 to-pink-600', ring: 'ring-rose-500', border: 'border-rose-100 dark:border-rose-900/30' },
  amber: { name: 'accent_amber', primary: 'bg-amber-500', text: 'text-amber-600', secondary: 'bg-amber-50 dark:bg-amber-900/20', gradient: 'from-amber-500 to-orange-500', ring: 'ring-amber-500', border: 'border-amber-100 dark:border-amber-900/30' },
  blue: { name: 'accent_blue', primary: 'bg-blue-600', text: 'text-blue-600', secondary: 'bg-blue-50 dark:bg-blue-900/20', gradient: 'from-blue-600 to-indigo-600', ring: 'ring-blue-500', border: 'border-blue-100 dark:border-blue-900/30' }
};

const BASE_TRANSLATIONS = {
  home: 'Home',
  goals: 'Goals',
  journal: 'Journal',
  insights: 'Insights',
  profile: 'Profile',
  good_morning: 'Good Morning',
  good_afternoon: 'Good Afternoon',
  good_evening: 'Good Evening',
  daily_wisdom: 'Daily Wisdom',
  daily_wisdom_desc: 'Display on Home page',
  habit_rate: 'Habit Success',
  routine_desc: 'Your daily momentum',
  momentum_desc: 'Active growth paths',
  keystone: 'Keystone Task',
  identity: 'Identity',
  upload_photo: 'Upload Photo',
  edit: 'Edit',
  settings: 'Settings',
  language: 'Language',
  dark_mode: 'Dark Mode',
  accent_palette: 'Accent Palette',
  ai_connection: 'AI Connection',
  api_test: 'Test AI',
  notifications_hub: 'Notifications',
  enable_push: 'Enable Notifications',
  security: 'Security',
  app_lock: 'App Lock',
  set_pin: 'Set PIN',
  disable: 'Disable',
  export_data: 'Export',
  import_data: 'Import',
  delete_account: 'Delete Data',
  accent_indigo: 'Indigo',
  accent_emerald: 'Emerald',
  accent_rose: 'Rose',
  accent_amber: 'Amber',
  accent_blue: 'Blue',
  persistence_on: 'Cloud persistence',
  storage_label: 'LocalStorage active',
  choose_avatar: 'Choose Avatar',
  growth_traveler: 'Mindful Explorer',
  import_success: 'Data imported successfully.',
  import_failed: 'Import failed. Check file format.',
  cloud_core: 'Cloud Sync',
  sync_now: 'Sync Now',
  last_sync: 'Last synced',
  syncing: 'Syncing...',
  remote_url_label: 'Cloud Status',
  remote_ph: 'Connect to Cloud...',
  sync_success: 'Cloud data synchronized.',
  sync_failed: 'Could not sync with cloud.',
  disconnected: 'Local Only',
  auth_title: 'Authentication',
  check_email_msg: 'Success! Please check your email to confirm.',
  welcome_back: 'Welcome back to Lumina.',
  auth_error: 'Auth Error',
  create_account: 'Join Lumina',
  sync_desc_auth: 'Sync your habits and journal across devices',
  email_label: 'Email Address',
  password_label: 'Password',
  sign_up_btn: 'Create Account',
  sign_in_btn: 'Sign In',
  already_have_account: 'Already have an account?',
  no_account_yet: 'First time here?',
  sign_in_switch: 'Sign In Instead',
  sign_up_switch: 'Create Account',
  account_connected: 'Account Linked',
  connect_cloud: 'Connect Account',
  sign_out: 'Sign Out',
  pin_prompt: 'Enter your PIN to continue',
  delete_key: 'Delete',
  encrypted_secure: 'Device PIN Protection',
  snooze_btn: 'Snooze',
  done_btn: 'Done',
  privacy_policy: 'Privacy Policy',
  adjust_photo: 'Adjust Photo',
  resize_identity: 'Adjust profile photo',
  drag_move: 'Drag to move',
  zoom_label: 'Zoom',
  back: 'Back',
  save: 'Save',
  delete_account_confirm: 'Are you sure? This will delete all your local data.'
};

export const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  English: BASE_TRANSLATIONS,
  French: { ...BASE_TRANSLATIONS, home: 'Accueil', goals: 'Objectifs' },
  German: { ...BASE_TRANSLATIONS, home: 'Startseite' },
  Ukrainian: { ...BASE_TRANSLATIONS, home: 'Головна' },
  Spanish: { ...BASE_TRANSLATIONS, home: 'Inicio' }
};

interface AppContextType extends UserState {
  t: (key: string) => string;
  themeClasses: any;
  circadian: {
    state: string;
    label: string;
    headerGradient: string;
    appBg: string;
    buttonStyle: string;
    iconContrast: boolean;
  };
  isLocked: boolean;
  user: any;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addHabit: (habit: Omit<Habit, 'createdAt' | 'daysOfWeek'> & { createdAt?: string; daysOfWeek?: number[] }) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitCompletion: (id: string, date: string) => void;
  redeemHabitReward: (habitId: string, amount?: number) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;
  saveWeeklyReview: (review: WeeklyReview, postToJournal?: boolean) => void;
  updateUserPreferences: (prefs: Partial<UserState>) => void;
  unlockApp: (pin: string) => boolean;
  setPinCode: (pin: string | null) => void;
  deleteAccount: () => void;
  exportData: () => void;
  exportJournalMarkdown: () => void;
  importData: (json: string) => void;
  preselectedGoalId: string | null;
  setPreselectedGoalId: (id: string | null) => void;
  isPersistent: boolean;
  requestPersistence: () => Promise<boolean>;
  syncWithCloud: () => Promise<void>;
  signOut: () => Promise<void>;
  triggerNotification: (title: string, message: string, type: 'achievement' | 'motivation' | 'reminder') => void;
  dismissNotification: (id: string) => void;
  snoozeNotification: (id: string) => void;
  toggleResourceFavorite: (id: string) => void;
  addPost: (post: Post) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  addComment: (postId: string, comment: Comment) => Promise<void>;
  toggleEventJoin: (eventId: string) => void;
  refreshCommunity: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<UserState>(() => {
    const defaultState: UserState = {
      name: 'Growth Traveler',
      avatar: '🌱',
      goals: [],
      habits: [],
      journalEntries: [],
      deletedIds: { goals: [], habits: [], journalEntries: [] },
      theme: 'light',
      themeColor: 'indigo',
      language: 'English',
      securitySettings: { pinCode: null },
      dashboardLayout: { showGrow: true, showCommunity: false, showDailyWisdom: true },
      notificationSettings: { 
        enabled: true, 
        routineTimeline: { Morning: "08:00", Afternoon: "13:00", Evening: "19:00" },
        types: { habits: true, goals: true, journal: true, motivation: true } 
      },
      notifications: [],
      posts: [],
      events: [],
      resources: [],
      modules: [],
      quizzes: [],
      savedResourceIds: []
    };

    const saved = localStorage.getItem('lumina_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultState, 
          ...parsed,
          dashboardLayout: {
            ...defaultState.dashboardLayout,
            ...(parsed.dashboardLayout || {})
          }
        };
      } catch (e) {
        return defaultState;
      }
    }
    return defaultState;
  });

  const [isLocked, setIsLocked] = useState(!!state.securitySettings.pinCode);
  const [preselectedGoalId, setPreselectedGoalId] = useState<string | null>(null);
  const [isPersistent, setIsPersistent] = useState(false);
  const [user, setUser] = useState<any>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const lastCheckedMinute = useRef<string | null>(null);
  const themeClasses = useMemo(() => THEMES[state.themeColor], [state.themeColor]);

  const circadian = useMemo(() => {
    const hour = new Date().getHours();
    let state = 'Day';
    let label = 'Daily Momentum';
    if (hour >= 5 && hour < 12) {
      state = 'Morning';
      label = 'Morning Focus';
    } else if (hour >= 12 && hour < 17) {
      state = 'Afternoon';
      label = 'Afternoon Momentum';
    } else if (hour >= 17 && hour < 22) {
      state = 'Evening';
      label = 'Evening Reflection';
    } else {
      state = 'Night';
      label = 'Night Rhythm';
    }

    return {
      state,
      label,
      headerGradient: themeClasses?.gradient || 'from-indigo-600 to-blue-600',
      appBg: 'bg-slate-50 dark:bg-slate-950',
      buttonStyle: 'bg-white/20 hover:bg-white/25 text-white',
      iconContrast: false
    };
  }, [themeClasses]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (lastCheckedMinute.current === timeStr) return;
      lastCheckedMinute.current = timeStr;

      const { routineTimeline, enabled } = state.notificationSettings;
      if (!enabled || !routineTimeline) return;

      const phases: ('Morning' | 'Afternoon' | 'Evening')[] = ['Morning', 'Afternoon', 'Evening'];
      const today = now.toISOString().split('T')[0];
      const todayDayNum = now.getDay();

      phases.forEach(phase => {
        if (routineTimeline[phase] === timeStr) {
          const habitsToNudge = state.habits.filter(h => 
            h.timeOfDay === phase && 
            h.daysOfWeek.includes(todayDayNum) &&
            !h.completedDates.includes(today)
          );
          
          if (habitsToNudge.length > 0) {
            const title = `${phase} Routine`;
            const msg = `You have ${habitsToNudge.length} habit${habitsToNudge.length > 1 ? 's' : ''} planned for this ${phase.toLowerCase()}.`;
            
            triggerNotification(title, msg, 'reminder');
            sendSystemNotification(title, { body: msg });
          }
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [state.habits, state.notificationSettings]);

  useEffect(() => {
    localStorage.setItem('lumina_state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
            performCloudSync(state).then(res => {
                if (res.success && res.data) setState(s => ({ ...s, ...res.data }));
            });
        }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const triggerAutoSync = useCallback((data: UserState) => {
    if (!user || !isSupabaseConfigured) return;
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    
    setState(s => ({ ...s, syncStatus: { ...s.syncStatus, status: 'pending' } }));
    
    syncTimeoutRef.current = window.setTimeout(async () => {
        const res = await performCloudSync(data);
        if (res.success && res.data) {
            setState(s => ({
              ...s, 
              ...res.data,
              deletedIds: { goals: [], habits: [], journalEntries: [] }
            }));
        } else {
            setState(s => ({ ...s, syncStatus: { ...s.syncStatus, status: 'error' } }));
        }
    }, 2000);
  }, [user]);

  const t = useCallback((key: string) => {
    return TRANSLATIONS[state.language][key] || key;
  }, [state.language]);

  const addGoal = (goal: Goal) => {
    setState(prev => {
      const newState = { ...prev, goals: [{ ...goal, lastUpdated: Date.now() }, ...prev.goals] };
      triggerAutoSync(newState);
      return newState;
    });
  };
  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setState(prev => {
      const newState = { ...prev, goals: prev.goals.map(g => g.id === id ? { ...g, ...updates, lastUpdated: Date.now() } : g) };
      triggerAutoSync(newState);
      return newState;
    });
  };
  const deleteGoal = (id: string) => {
    setState(prev => {
      const newState = { 
        ...prev, 
        goals: prev.goals.filter(g => g.id !== id),
        deletedIds: { ...prev.deletedIds, goals: [...(prev.deletedIds?.goals || []), id] }
      };
      triggerAutoSync(newState);
      return newState;
    });
  };

  const addHabit = (habit: Omit<Habit, 'createdAt' | 'daysOfWeek'> & { createdAt?: string; daysOfWeek?: number[] }) => {
    setState(prev => {
      const daysOfWeek = habit.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      const completedDates = habit.completedDates || [];
      const { currentStreak } = calculateHabitStreak(completedDates, daysOfWeek);
      const newHabit: Habit = {
        ...habit,
        createdAt: habit.createdAt || new Date().toISOString(),
        daysOfWeek,
        completedDates,
        streak: currentStreak,
        lastUpdated: Date.now()
      } as Habit;
      const newState = { ...prev, habits: [newHabit, ...prev.habits] };
      triggerAutoSync(newState);
      return newState;
    });
  };
  const updateHabit = (id: string, updates: Partial<Habit>) => {
    setState(prev => {
      const newState = { 
        ...prev, 
        habits: prev.habits.map(h => {
          if (h.id === id) {
            const updated = { ...h, ...updates, lastUpdated: Date.now() };
            if (updates.completedDates || updates.daysOfWeek) {
              const { currentStreak } = calculateHabitStreak(updated.completedDates, updated.daysOfWeek);
              updated.streak = currentStreak;
            }
            return updated;
          }
          return h;
        }) 
      };
      triggerAutoSync(newState);
      return newState;
    });
  };
  const deleteHabit = (id: string) => {
    setState(prev => {
      const newState = { 
        ...prev, 
        habits: prev.habits.filter(h => h.id !== id),
        deletedIds: { ...prev.deletedIds, habits: [...(prev.deletedIds?.habits || []), id] }
      };
      triggerAutoSync(newState);
      return newState;
    });
  };
  
  const toggleHabitCompletion = (id: string, date: string) => {
    let earnedRewardMessage: { title: string; amount: number; unit: string } | null = null;
    setState(prev => {
      const updatedHabits = prev.habits.map(h => {
        if (h.id === id) {
          const completed = h.completedDates.includes(date);
          const newDates = completed ? h.completedDates.filter(d => d !== date) : [...h.completedDates, date];
          const { currentStreak } = calculateHabitStreak(newDates, h.daysOfWeek);
          
          let updatedReward = h.reward;
          if (h.reward && h.reward.amount > 0) {
            if (!completed) {
              // Just completed habit -> earn reward!
              const earnAmt = h.reward.amount;
              updatedReward = {
                ...h.reward,
                bankedBalance: (h.reward.bankedBalance || 0) + earnAmt,
                totalEarned: (h.reward.totalEarned || 0) + earnAmt
              };
              earnedRewardMessage = {
                title: h.reward.title,
                amount: earnAmt,
                unit: h.reward.unit
              };
            } else {
              // Unchecking habit -> remove banked reward safely
              const earnAmt = h.reward.amount;
              updatedReward = {
                ...h.reward,
                bankedBalance: Math.max(0, (h.reward.bankedBalance || 0) - earnAmt),
                totalEarned: Math.max(0, (h.reward.totalEarned || 0) - earnAmt)
              };
            }
          }

          return { 
            ...h, 
            completedDates: newDates, 
            streak: currentStreak, 
            reward: updatedReward,
            lastUpdated: Date.now() 
          };
        }
        return h;
      });
      const newState = { ...prev, habits: updatedHabits };
      triggerAutoSync(newState);
      return newState;
    });

    if (earnedRewardMessage) {
      const rewardInfo = earnedRewardMessage as { title: string; amount: number; unit: string };
      const msg = `+${rewardInfo.amount} ${rewardInfo.unit} of ${rewardInfo.title} banked!`;
      triggerNotification('Reward Earned 🎁', msg, 'achievement');
    }
  };

  const redeemHabitReward = (habitId: string, amount?: number) => {
    let redeemedInfo: { title: string; amount: number; unit: string } | null = null;
    setState(prev => {
      const updatedHabits = prev.habits.map(h => {
        if (h.id === habitId && h.reward) {
          const available = h.reward.bankedBalance || 0;
          const toDeduct = amount !== undefined ? amount : available;
          const actualDeduct = Math.min(available, Math.max(0, toDeduct));
          if (actualDeduct <= 0) return h;

          redeemedInfo = {
            title: h.reward.title,
            amount: actualDeduct,
            unit: h.reward.unit
          };

          return {
            ...h,
            reward: {
              ...h.reward,
              bankedBalance: Math.max(0, available - actualDeduct),
              totalRedeemed: (h.reward.totalRedeemed || 0) + actualDeduct
            },
            lastUpdated: Date.now()
          };
        }
        return h;
      });

      const newState = { ...prev, habits: updatedHabits };
      triggerAutoSync(newState);
      return newState;
    });

    if (redeemedInfo) {
      const info = redeemedInfo as { title: string; amount: number; unit: string };
      triggerNotification(
        'Guilt-Free Time Enjoyed ✨', 
        `Enjoyed ${info.amount} ${info.unit} of ${info.title}. You earned every bit of it.`, 
        'motivation'
      );
    }
  };

  const addJournalEntry = (entry: JournalEntry) => {
    setState(prev => {
      const newState = { ...prev, journalEntries: [{ ...entry, lastUpdated: Date.now() }, ...prev.journalEntries] };
      triggerAutoSync(newState);
      return newState;
    });
  };
  const updateJournalEntry = (id: string, updates: Partial<JournalEntry>) => {
    setState(prev => {
      const newState = { ...prev, journalEntries: prev.journalEntries.map(e => e.id === id ? { ...e, ...updates, lastUpdated: Date.now() } : e) };
      triggerAutoSync(newState);
      return newState;
    });
  };
  const deleteJournalEntry = (id: string) => {
    setState(prev => {
      const newState = { 
        ...prev, 
        journalEntries: prev.journalEntries.filter(e => e.id !== id),
        deletedIds: { ...prev.deletedIds, journalEntries: [...(prev.deletedIds?.journalEntries || []), id] }
      };
      triggerAutoSync(newState);
      return newState;
    });
  };

  const saveWeeklyReview = (review: WeeklyReview, postToJournal: boolean = false) => {
    setState(prev => {
      let updatedJournal = prev.journalEntries;
      if (postToJournal) {
        const journalTitle = `Weekly Reflection (${review.weekStartDate} – ${review.weekEndDate})`;
        const exists = prev.journalEntries.some(j => j.title === journalTitle);
        if (!exists) {
          const entry: JournalEntry = {
            id: 'review-' + Date.now().toString(),
            date: toLocalDateString(),
            title: journalTitle,
            category: 'Growth',
            content: `Weekly Review Summary:\n\n• Habits: ${review.habitsDone}/${review.habitsTotal} completed (${review.completionRate}% consistency)\n• Wins:\n${review.wins.length > 0 ? review.wins.map(w => `  - ${w}`).join('\n') : '  - Quiet, steady progress'}\n• Focus for Next Week: ${review.upcomingFocus}\n${review.suggestedAdjustment ? `• Suggested Adjustment: ${review.suggestedAdjustment}\n` : ''}${review.reflection ? `\nNotes:\n${review.reflection}` : ''}`,
            prompt: 'Sunday Weekly Review',
            mood: review.completionRate >= 70 ? 'Great' : 'Good',
            activities: ['reflection', 'weekly-review'],
            lastUpdated: Date.now()
          };
          updatedJournal = [entry, ...prev.journalEntries];
        }
      }

      const newState = {
        ...prev,
        lastWeeklyReview: review,
        journalEntries: updatedJournal
      };
      triggerAutoSync(newState);
      return newState;
    });
  };

  const updateUserPreferences = (prefs: Partial<UserState>) => setState(s => ({ ...s, ...prefs }));

  const unlockApp = (pin: string) => {
    if (pin === state.securitySettings.pinCode) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const setPinCode = (pin: string | null) => {
    setState(s => ({ ...s, securitySettings: { ...s.securitySettings, pinCode: pin } }));
    if (!pin) setIsLocked(false);
  };

  const deleteAccount = () => {
    localStorage.removeItem('lumina_state');
    window.location.reload();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJournalMarkdown = () => {
    let md = `# Lumina Journal Export\nExported on ${new Date().toLocaleDateString()}\n\n---\n\n`;
    state.journalEntries.forEach(entry => {
      const dateStr = entry.date ? new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
      md += `## ${entry.title || 'Daily Note'} — ${dateStr}\n`;
      md += `**Folder:** ${entry.category || 'Daily'} | **Energy:** ${entry.mood}\n\n`;
      md += `${entry.content}\n\n`;
      if (entry.aiInsight) {
        md += `> *Observation:* ${entry.aiInsight}\n\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina_journal_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (json: string) => {
    try {
      const data = JSON.parse(json);
      setState(data);
    } catch (e) {
      alert(t('import_failed'));
    }
  };

  const requestPersistence = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const persistent = await navigator.storage.persist();
      setIsPersistent(persistent);
      return persistent;
    }
    return false;
  };

  const syncWithCloud = async () => {
    const res = await performCloudSync(state);
    if (res.success && res.data) {
      setState(s => ({ 
        ...s, 
        ...res.data,
        deletedIds: { goals: [], habits: [], journalEntries: [] }
      }));
      triggerNotification(t('cloud_core'), t('sync_success'), 'achievement');
    } else {
      triggerNotification(t('cloud_core'), res.message || t('sync_failed'), 'reminder');
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  };

  const triggerNotification = (title: string, message: string, type: 'achievement' | 'motivation' | 'reminder') => {
    const id = Date.now().toString();
    setState(s => ({ ...s, notifications: [{ id, title, message, type }, ...(s.notifications || [])] }));
  };

  const dismissNotification = (id: string) => setState(s => ({ ...s, notifications: s.notifications.filter(n => n.id !== id) }));
  const snoozeNotification = (id: string) => {
    dismissNotification(id);
    setTimeout(() => triggerNotification('Reminder', 'Snoozed notification is back', 'reminder'), 300000);
  };

  const toggleResourceFavorite = (id: string) => {
    setState(s => {
      const isSaved = (s.savedResourceIds || []).includes(id);
      const newSaved = isSaved ? s.savedResourceIds.filter(rid => rid !== id) : [...(s.savedResourceIds || []), id];
      return { ...s, savedResourceIds: newSaved };
    });
  };

  const addPost = async (post: Post) => {
    setState(s => ({ ...s, posts: [post, ...(s.posts || [])] }));
  };

  const likePost = async (postId: string) => {
    setState(s => ({
      ...s,
      posts: (s.posts || []).map(p => {
        if (p.id === postId) {
          const isLiked = p.likedBy.includes(user?.id || 'me');
          const newLikedBy = isLiked 
            ? p.likedBy.filter(uid => uid !== (user?.id || 'me')) 
            : [...p.likedBy, user?.id || 'me'];
          return { ...p, likedBy: newLikedBy, likes: isLiked ? p.likes - 1 : p.likes + 1 };
        }
        return p;
      })
    }));
  };

  const addComment = async (postId: string, comment: Comment) => {
    setState(s => ({
      ...s,
      posts: (s.posts || []).map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p)
    }));
  };

  const toggleEventJoin = (eventId: string) => {
    setState(s => ({
      ...s,
      events: (s.events || []).map(e => {
        if (e.id === eventId) {
          const joined = !e.joined;
          return { ...e, joined, participants: joined ? e.participants + 1 : e.participants - 1 };
        }
        return e;
      })
    }));
  };

  const refreshCommunity = async () => {
    return new Promise<void>(resolve => setTimeout(resolve, 800));
  };

  const value: AppContextType = {
    ...state,
    t,
    themeClasses,
    circadian,
    isLocked,
    user,
    addGoal,
    updateGoal,
    deleteGoal,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    redeemHabitReward,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    saveWeeklyReview,
    updateUserPreferences,
    unlockApp,
    setPinCode,
    deleteAccount,
    exportData,
    exportJournalMarkdown,
    importData,
    preselectedGoalId,
    setPreselectedGoalId,
    isPersistent,
    requestPersistence,
    syncWithCloud,
    signOut,
    triggerNotification,
    dismissNotification,
    snoozeNotification,
    toggleResourceFavorite,
    addPost,
    likePost,
    addComment,
    toggleEventJoin,
    refreshCommunity
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useApp must be used within an AppProvider');
  return context;
};
