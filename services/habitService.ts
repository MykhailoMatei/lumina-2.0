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
  referenceDateStr?: string
): HabitStreakResult => {
  const todayStr = referenceDateStr || toLocalDateString();
  const dateSet = new Set(completedDates);
  const scheduledDays = new Set(daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6]);

  const isCompletedToday = dateSet.has(todayStr);

  // 1. Walk backward from today
  let streak = 0;
  let missedYesterday = false;
  let canRecoverToday = false;

  const todayDate = parseLocalDate(todayStr);
  const todayDayOfWeek = todayDate.getDay();

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
  const MAX_LOOKBACK = 730; // 2 years safety limit
  let missedDaysCount = 0;

  while (lookbackDays < MAX_LOOKBACK) {
    lookbackDays++;
    const dayOfWeek = checkDate.getDay();
    const dateStr = toLocalDateString(checkDate);

    // Skip unscheduled days
    if (!scheduledDays.has(dayOfWeek)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    // It was a scheduled day
    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Missed a scheduled day
      if (lookbackDays === 1 && !isCompletedToday) {
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
      if (!scheduledDays.has(d.getDay())) continue;

      if (!prevScheduledDate) {
        tempStreak = 1;
      } else {
        // Count how many scheduled days between prevScheduledDate and d
        let cursor = new Date(prevScheduledDate);
        cursor.setDate(cursor.getDate() + 1);
        let scheduledDaysBetween = 0;

        while (toLocalDateString(cursor) < toLocalDateString(d)) {
          if (scheduledDays.has(cursor.getDay())) {
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
