
export enum GoalCategory {
  Health = 'Health',
  Career = 'Career',
  Personal = 'Personal',
  Financial = 'Financial',
  Learning = 'Learning',
  Relationships = 'Relationships',
  Creativity = 'Creativity'
}

export type GoalOutcome = 'Integrated' | 'Evolved' | 'Paused' | 'Paused with Insight' | 'Completed' | 'Redirected';

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  title: string;
  whyStatement?: string;
  category: GoalCategory;
  progress: number; 
  deadline?: string;
  completed: boolean;
  milestones: Milestone[];
  isPaused?: boolean;
  outcomeLabel?: GoalOutcome;
  identityImpact?: string;
  whatStayed?: string;
  whatShifted?: string;
  archivedAt?: string;
  startDate?: string;
  lastUpdated?: number;
}

export interface HabitReward {
  title: string;              // e.g. "Gaming", "Guilt-free Netflix", "Podcast walk"
  amount: number;             // e.g. 30
  unit: string;               // e.g. "min", "episodes", "pages"
  bankedBalance: number;      // Current available balance (>= 0)
  totalEarned: number;        // Lifetime earned
  totalRedeemed: number;      // Lifetime redeemed
}

export interface Habit {
  id: string;
  title: string;
  category: GoalCategory;
  trigger?: string; 
  description?: string;
  duration?: string;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Anytime';
  daysOfWeek: number[]; // [0,1,2,3,4,5,6] where 0 is Sunday
  scheduleType?: 'weekly' | 'monthly';
  monthlyDays?: number[]; // [1, 15, 30] for specific dates of the month
  reminderTime?: string; 
  linkedGoalId?: string; 
  streak: number;
  completedDates: string[]; 
  targetAmount?: number;      // Optional measurable amount, e.g. 20
  targetUnit?: string;        // Optional measurable unit, e.g. "pages", "reps", "min"
  reward?: HabitReward;       // Optional Premack principle temptation bundle reward
  createdAt: string; 
  lastUpdated?: number;
}

export interface JournalEntry {
  id: string;
  date: string; 
  title?: string;
  category?: string;
  content: string;
  prompt: string;
  mood: 'Great' | 'Good' | 'Neutral' | 'Bad' | 'Awful';
  activities: string[];
  aiInsight?: string;
  linkedGoalId?: string; 
  linkedHabitId?: string;
  imageData?: string; 
  lastUpdated?: number;
}

export type ThemeColor = 'indigo' | 'emerald' | 'rose' | 'amber' | 'blue';
export type AppLanguage = 'English' | 'French' | 'German' | 'Ukrainian' | 'Spanish';

export interface DailyBriefing {
  motivation: string;
  focus: string;
  tip: string;
  journalPrompt: string;
  priorityTask?: string; 
}

export interface WeeklyReview {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  completionRate: number;
  habitsDone: number;
  habitsTotal: number;
  topHabits: string[];
  wins: string[];
  suggestedAdjustment: string;
  upcomingFocus: string;
  summary?: string;
  reflection?: string;
  savedAt?: string;
}

export interface AppNotification {
  id: string;
  type: 'achievement' | 'motivation' | 'reminder';
  title: string;
  message: string;
}

export interface UserState {
  name: string;
  avatar: string; 
  goals: Goal[];
  habits: Habit[];
  journalEntries: JournalEntry[];
  deletedIds: {
    goals: string[];
    habits: string[];
    journalEntries: string[];
  };
  theme: 'light' | 'dark';
  themeColor: ThemeColor;
  language: AppLanguage; 
  dailyBriefing?: DailyBriefing;
  lastBriefingUpdate?: number;
  lastWeeklyReview?: WeeklyReview;
  aiConsentGranted?: boolean;
  securitySettings: {
    pinCode: string | null;
    pinHashed?: boolean;
    incognitoMode?: boolean;
    aiDisabled?: boolean;
  };
  dashboardLayout: {
    showGrow: boolean;
    showCommunity: boolean;
    showDailyWisdom?: boolean;
  };
  notificationSettings: {
    enabled: boolean;
    routineTimeline: {
      Morning: string;   // "HH:MM"
      Afternoon: string; // "HH:MM"
      Evening: string;   // "HH:MM"
    };
    types: {
      habits: boolean;
      goals: boolean;
      journal: boolean;
      motivation: boolean;
    };
  };
  notifications: AppNotification[];
  posts: Post[];
  events: AppEvent[];
  resources: Resource[];
  modules: LearningModule[];
  quizzes: Quiz[];
  savedResourceIds: string[];
  syncStatus?: {
    lastSync?: number;
    status: 'synced' | 'pending' | 'error' | 'disconnected';
    remoteUrl?: string;
  };
}

export interface Post { id: string; author: string; avatar: string; category: string; title: string; content: string; likes: number; likedBy: string[]; comments: Comment[]; timestamp: string; type: 'discussion' | 'question' | 'share'; }
export interface Comment { id: string; author: string; avatar: string; content: string; timestamp: string; isExpert?: boolean; }
export interface Resource { id: string; title: string; author: string; category: string; image: string; type: 'video' | 'podcast' | 'article'; duration: string; rating: number; }
export interface LearningModule { id: string; title: string; description: string; image: string; completedLessons: number; totalLessons: number; }
export interface Quiz { id: string; title: string; description: string; image: string; questionsCount: number; }
export interface AppEvent { id: string; title: string; description: string; image: string; date: string; participants: number; type: string; joined: boolean; }
