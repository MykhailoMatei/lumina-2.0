/**
 * Returns YYYY-MM-DD in the user's LOCAL timezone.
 * Replaces `new Date().toISOString().split('T')[0]`, which returns the UTC date
 * and flips to the wrong day around midnight for anyone not on UTC.
 */
export const toLocalDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};