/**
 * Day-streak helpers. Dates are keyed by the user's LOCAL calendar day
 * (not UTC), so "consecutive days on the app" matches what the user sees on
 * their device regardless of timezone.
 */

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return localDateKey(now);
}

export function yesterdayKey(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

/**
 * Streak length after registering a visit "now":
 *  - same calendar day as the last visit → unchanged (already counted today)
 *  - the day immediately after the last visit → +1 (consecutive)
 *  - any larger gap, or no prior visit → reset to 1
 */
export function computeNextStreak(
  lastActiveDate: string | null,
  streakDays: number,
  now: Date = new Date(),
): number {
  if (lastActiveDate === todayKey(now)) {
    return streakDays;
  }
  if (lastActiveDate === yesterdayKey(now)) {
    return streakDays + 1;
  }
  return 1;
}
