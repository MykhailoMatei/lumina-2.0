/**
 * Local date utilities to prevent UTC midnight timezone off-by-one shifts.
 */

export const toLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr: string): Date => {
  const cleanStr = dateStr.split('T')[0];
  const [year, month, day] = cleanStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

export const isSunday = (d: Date = new Date()): boolean => d.getDay() === 0;

export const getPast7Days = (endDate: Date = new Date()): { dateStr: string; dayName: string; dayNum: number; date: Date }[] => {
  const days: { dateStr: string; dayName: string; dayNum: number; date: Date }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Calculate Monday of the current week (or previous if Sunday)
  const d = new Date(endDate);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
  d.setDate(diff);

  for (let i = 0; i < 7; i++) {
    const current = new Date(d);
    current.setDate(d.getDate() + i);
    days.push({
      dateStr: toLocalDateString(current),
      dayName: dayNames[current.getDay()],
      dayNum: current.getDate(),
      date: current
    });
  }
  return days;
};

export const getWeekRangeString = (endDate: Date = new Date()): { startStr: string; endStr: string; label: string } => {
  const days = getPast7Days(endDate);
  const start = days[0];
  const end = days[days.length - 1];
  const startMonth = start.date.toLocaleDateString(undefined, { month: 'short' });
  const endMonth = end.date.toLocaleDateString(undefined, { month: 'short' });
  const label = startMonth === endMonth 
    ? `${startMonth} ${start.dayNum} – ${end.dayNum}` 
    : `${startMonth} ${start.dayNum} – ${endMonth} ${end.dayNum}`;
  return { startStr: start.dateStr, endStr: end.dateStr, label };
};
