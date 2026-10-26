import { toLocalDateString, parseLocalDate } from './date';

export interface HabitStreakResult {
  currentStreak: number;
  longestStreak: number;
  isCompletedToday: boolean;
  canRecoverToday: boolean; // Missed yesterday, but doing it today preserves momentum
  missedYesterday: boolean;
}

/**
 * Deterministically calculates habit streak and momentum from completed dates.
 * Adheres to Atomic Habits:
 * 1. Today is always considered ongoing (does not break streak if not done yet).
 * 2. Unscheduled days (e.g. weekends for a weekday habit) do not break streaks.
 * 3. Never-miss-twice detection: alerts if yesterday was missed but today can recover.
 */
export const calculateHabitStreak = (
  completedDates: string[] = [],
  daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6],
  referenceDateStr?: string,
  scheduleType: 'weekly' | 'monthly' = 'weekly',
  monthlyDays: number[] = []
): HabitStreakResult => {
  const todayStr = referenceDateStr || toLocalDateString();
  const dateSet = new Set(completedDates);

  const isDayScheduled = (d: Date): boolean => {
    if (scheduleType === 'monthly') {
      const dayNum = d.getDate();
      const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if ((monthlyDays || []).includes(dayNum)) return true;
      if (dayNum === lastDayOfMonth && (monthlyDays || []).some(md => md >= dayNum)) return true;
      return false;
    }
    const scheduledDays = new Set(daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]);
    return scheduledDays.has(d.getDay());
  };

  const isCompletedToday = dateSet.has(todayStr);

  // 1. Walk backward from today
  let streak = 0;
  let missedYesterday = false;
  let canRecoverToday = false;

  const todayDate = parseLocalDate(todayStr);

  // If completed today, start counting streak from today
  let checkDate = new Date(todayDate);

  if (isCompletedToday) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // Today is not completed yet; check if yesterday was completed
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Walk backward day by day to count consecutive scheduled completions
  let lookbackDays = 0;
  let scheduledOccurrencesSeen = 0;
  const MAX_LOOKBACK = 730; // 2 years safety limit

  while (lookbackDays < MAX_LOOKBACK) {
    lookbackDays++;
    const dateStr = toLocalDateString(checkDate);

    // Skip unscheduled days
    if (!isDayScheduled(checkDate)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    // It was a scheduled day
    scheduledOccurrencesSeen++;
    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Missed the most recent scheduled occurrence prior to today
      if (scheduledOccurrencesSeen === 1 && !isCompletedToday) {
        missedYesterday = true;
        canRecoverToday = true;
      }
      break;
    }
  }

  // 2. Calculate all-time longest streak
  const sortedDates = Array.from(dateSet)
    .sort()
    .map(d => parseLocalDate(d));

  let longest = streak;
  if (sortedDates.length > 0) {
    let tempStreak = 0;
    let prevScheduledDate: Date | null = null;

    for (const d of sortedDates) {
      if (!isDayScheduled(d)) continue;

      if (!prevScheduledDate) {
        tempStreak = 1;
      } else {
        // Count how many scheduled days between prevScheduledDate and d
        let cursor = new Date(prevScheduledDate);
        cursor.setDate(cursor.getDate() + 1);
        let scheduledDaysBetween = 0;

        while (toLocalDateString(cursor) < toLocalDateString(d)) {
          if (isDayScheduled(cursor)) {
            scheduledDaysBetween++;
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        if (scheduledDaysBetween === 0) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }

      if (tempStreak > longest) longest = tempStreak;
      prevScheduledDate = d;
    }
  }

  return {
    currentStreak: streak,
    longestStreak: Math.max(streak, longest),
    isCompletedToday,
    canRecoverToday,
    missedYesterday
  };
};
